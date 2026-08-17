import type { SupabaseClient } from './deps.ts';
import type { NewsArticle } from './market-types.ts';
import * as gemini from './providers/gemini.ts';

export type NewsSentiment = 'bullish' | 'bearish' | 'neutral' | 'mixed';

export type NewsSummary = {
  symbol: string;
  summaryDate: string;
  sentiment: NewsSentiment;
  summary: string;
  keyDrivers: string[];
  articleCount: number;
  model: string;
  generatedAt: string;
};

const SYSTEM_INSTRUCTION = `You summarise financial news for a retail investing app.
Rules:
- Use only the headlines provided. Never introduce facts, numbers or events that are not in them.
- Be specific about what happened; avoid filler like "investors are watching closely".
- sentiment reflects the tone of the coverage, not a price prediction.
- Never give buy, sell or hold advice.
- summary must be 2 sentences or fewer.
- keyDrivers must contain 1 to 3 short noun phrases, each under 8 words.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    sentiment: { type: 'string', enum: ['bullish', 'bearish', 'neutral', 'mixed'] },
    summary: { type: 'string' },
    keyDrivers: { type: 'array', items: { type: 'string' } },
  },
  required: ['sentiment', 'summary', 'keyDrivers'],
} as const;

type ModelOutput = {
  sentiment: NewsSentiment;
  summary: string;
  keyDrivers: string[];
};

export function todayInUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

type SummaryRow = {
  symbol: string;
  summary_date: string;
  sentiment: NewsSentiment;
  summary: string;
  key_drivers: unknown;
  article_count: number;
  model: string;
  generated_at: string;
};

function rowToSummary(row: SummaryRow): NewsSummary {
  return {
    symbol: row.symbol,
    summaryDate: row.summary_date,
    sentiment: row.sentiment,
    summary: row.summary,
    keyDrivers: Array.isArray(row.key_drivers) ? (row.key_drivers as string[]) : [],
    articleCount: row.article_count,
    model: row.model,
    generatedAt: row.generated_at,
  };
}

export async function readSummaries(
  admin: SupabaseClient,
  symbols: string[],
  summaryDate: string,
): Promise<Map<string, NewsSummary>> {
  const result = new Map<string, NewsSummary>();
  if (symbols.length === 0) return result;

  const { data, error } = await admin
    .from('news_summaries')
    .select('*')
    .in('symbol', symbols)
    .eq('summary_date', summaryDate);

  if (error) {
    console.error('News summary read failed', error);
    return result;
  }

  for (const row of (data ?? []) as SummaryRow[]) {
    result.set(row.symbol, rowToSummary(row));
  }

  return result;
}

/**
 * Summarises one symbol's recent headlines in a single model call and stores the
 * result under today's date, so the same symbol is never summarised twice in a day
 * regardless of how many users request it.
 */
export async function summarizeSymbol(
  admin: SupabaseClient,
  symbol: string,
  articles: NewsArticle[],
  summaryDate = todayInUtc(),
): Promise<NewsSummary | null> {
  if (articles.length === 0) return null;

  const headlines = articles
    .slice(0, 12)
    .map((article, index) => {
      const detail = article.summary ? ` - ${article.summary.slice(0, 220)}` : '';
      return `${index + 1}. [${article.source ?? 'unknown'}] ${article.headline}${detail}`;
    })
    .join('\n');

  const output = await gemini.generateJson<ModelOutput>({
    systemInstruction: SYSTEM_INSTRUCTION,
    responseSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    temperature: 0.2,
    maxOutputTokens: 512,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Symbol: ${symbol}\nRecent headlines:\n${headlines}\n\nSummarise the coverage.`,
          },
        ],
      },
    ],
  });

  const summary: NewsSummary = {
    symbol,
    summaryDate,
    sentiment: output.sentiment,
    summary: output.summary.trim(),
    keyDrivers: (output.keyDrivers ?? [])
      .map((driver) => driver.trim())
      .filter(Boolean)
      .slice(0, 3),
    articleCount: articles.length,
    model: gemini.modelName(),
    generatedAt: new Date().toISOString(),
  };

  const { error } = await admin.from('news_summaries').upsert(
    {
      symbol: summary.symbol,
      summary_date: summary.summaryDate,
      sentiment: summary.sentiment,
      summary: summary.summary,
      key_drivers: summary.keyDrivers,
      article_count: summary.articleCount,
      model: summary.model,
      generated_at: summary.generatedAt,
    },
    { onConflict: 'symbol,summary_date' },
  );

  if (error) console.error('News summary write failed', error);

  return summary;
}
