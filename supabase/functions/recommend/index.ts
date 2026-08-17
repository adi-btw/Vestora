// Recommendation engine.
//
// Two stages on purpose: candidates are found and ranked deterministically from
// provider data, and only then does the model write the explanation for the rows
// that already won. That keeps the ranking reproducible and auditable, and means
// a model outage degrades the copy rather than the feature.

import { requireUser } from '../_shared/clients.ts';
import { mapWithConcurrency } from '../_shared/concurrency.ts';
import { z } from '../_shared/deps.ts';
import { HttpError, jsonResponse, parseJsonBody, serveJson } from '../_shared/http.ts';
import { getCompanySnapshot, getQuotes, getSparklines } from '../_shared/market-service.ts';
import * as gemini from '../_shared/providers/gemini.ts';
import { enforceRateLimit, RATE_LIMITS } from '../_shared/rate-limit.ts';
import { confidenceFrom, scoreCandidate, type ScoreFactor } from '../_shared/scoring.ts';

/** Seeds for a brand-new account with an empty watchlist. */
const COLD_START_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'JPM', 'COST', 'UNH'];

// Each candidate costs several provider calls, so the pool stays small enough
// that a full refresh fits inside the Finnhub free-tier minute budget.
const MAX_SEEDS = 4;
const MAX_CANDIDATES = 8;
const RESULT_COUNT = 5;

const requestSchema = z.object({
  /** Skip the model and use factor-derived copy. Handy for smoke tests. */
  skipNarrative: z.boolean().optional(),
});

const NARRATIVE_SYSTEM_INSTRUCTION = `You explain why a screening model surfaced a stock, for a retail investing app.

For each symbol you are given the factor scores that produced its rank.
- thesis: 2 sentences on what the factors show, citing the concrete numbers you were given.
- risks: 1 or 2 sentences on the weakest factor or the main thing that could go wrong.
- Use only the supplied numbers. Never invent data, targets, or predictions.
- Never tell the user to buy, sell, or hold, and never suggest position sizes.
- Plain sentences, no markdown, no headings.`;

const NARRATIVE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          thesis: { type: 'string' },
          risks: { type: 'string' },
        },
        required: ['symbol', 'thesis', 'risks'],
      },
    },
  },
  required: ['items'],
} as const;

type Narrative = { symbol: string; thesis: string; risks: string };

type Candidate = {
  symbol: string;
  name: string | null;
  score: number;
  confidence: number;
  factors: ScoreFactor[];
};

/** Factor-derived copy: the fallback whenever the model is unavailable. */
function fallbackNarrative(candidate: Candidate): Narrative {
  const sorted = [...candidate.factors].sort((a, b) => b.value - a.value);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return {
    symbol: candidate.symbol,
    thesis: best
      ? `Screened in mainly on ${best.label.toLowerCase()}: ${best.detail}.`
      : 'Screened in on limited available data.',
    risks: worst
      ? `Weakest factor is ${worst.label.toLowerCase()}: ${worst.detail}.`
      : 'Coverage for this symbol is thin, so treat the score as provisional.',
  };
}

async function requestNarratives(candidates: Candidate[]): Promise<Map<string, Narrative>> {
  const payload = candidates.map((candidate) => ({
    symbol: candidate.symbol,
    name: candidate.name,
    score: candidate.score,
    factors: candidate.factors.map((factor) => ({
      factor: factor.label,
      score: Math.round(factor.value * 100),
      detail: factor.detail,
    })),
  }));

  const result = await gemini.generateJson<{ items: Narrative[] }>({
    systemInstruction: NARRATIVE_SYSTEM_INSTRUCTION,
    responseSchema: NARRATIVE_SCHEMA as unknown as Record<string, unknown>,
    temperature: 0.4,
    maxOutputTokens: 1_200,
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
  });

  return new Map((result.items ?? []).map((item) => [item.symbol.toUpperCase(), item]));
}

Deno.serve(
  serveJson(async (request) => {
    const { userId, db, admin } = await requireUser(request);
    await enforceRateLimit(admin, userId, RATE_LIMITS.recommend);

    const parsed = requestSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      throw new HttpError(400, 'invalid_request', 'Bad request.');
    }

    const { data: watchlistRows, error: watchlistError } = await db
      .from('watchlist_items')
      .select('symbol')
      .order('created_at', { ascending: false });

    if (watchlistError) {
      throw new HttpError(500, 'watchlist_read_failed', watchlistError.message);
    }

    const owned = new Set(((watchlistRows ?? []) as { symbol: string }[]).map((row) => row.symbol));
    const seeds = [...owned].slice(0, MAX_SEEDS);

    // Peers of what the user already follows are the candidate pool: it is one
    // provider call per seed and it keeps suggestions adjacent to their interests.
    const peerResults = await mapWithConcurrency(seeds, 2, async (symbol) => {
      const snapshot = await getCompanySnapshot(admin, symbol);
      return snapshot.peers ?? [];
    });

    const candidateSymbols = new Set<string>();
    for (const result of peerResults) {
      if (result.status !== 'fulfilled') {
        console.error('Peer lookup failed', result.reason);
        continue;
      }
      for (const peer of result.value) {
        if (!owned.has(peer) && candidateSymbols.size < MAX_CANDIDATES) {
          candidateSymbols.add(peer);
        }
      }
    }

    for (const symbol of COLD_START_SYMBOLS) {
      if (candidateSymbols.size >= MAX_CANDIDATES) break;
      if (!owned.has(symbol)) candidateSymbols.add(symbol);
    }

    const symbols = [...candidateSymbols];
    if (symbols.length === 0) {
      return jsonResponse({ recommendations: [], aiEnabled: gemini.isConfigured() });
    }

    const [{ quotes }, sparklines] = await Promise.all([
      getQuotes(admin, symbols),
      getSparklines(admin, symbols),
    ]);
    const quoteBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));

    const snapshots = await mapWithConcurrency(symbols, 3, (symbol) =>
      getCompanySnapshot(admin, symbol),
    );

    const scored: Candidate[] = [];
    symbols.forEach((symbol, index) => {
      const snapshot = snapshots[index];
      if (snapshot.status !== 'fulfilled') {
        console.error('Snapshot failed', { symbol, reason: snapshot.reason });
        return;
      }

      const result = scoreCandidate({
        quote: quoteBySymbol.get(symbol) ?? null,
        financials: snapshot.value.financials,
        trend: snapshot.value.recommendationTrend,
        closes: sparklines[symbol] ?? [],
      });

      // Nothing to say about a symbol with no usable factors.
      if (result.factors.length === 0) return;

      scored.push({
        symbol,
        name: snapshot.value.profile?.name ?? null,
        score: result.score,
        confidence: confidenceFrom(result),
        factors: result.factors,
      });
    });

    const top = scored.sort((a, b) => b.score - a.score).slice(0, RESULT_COUNT);
    if (top.length === 0) {
      return jsonResponse({ recommendations: [], aiEnabled: gemini.isConfigured() });
    }

    let narratives = new Map<string, Narrative>();
    let aiEnabled = gemini.isConfigured() && !parsed.data.skipNarrative;

    if (aiEnabled) {
      try {
        narratives = await requestNarratives(top);
      } catch (error) {
        console.error('Narrative generation failed', error);
        aiEnabled = false;
      }
    }

    const rows = top.map((candidate) => {
      const narrative = narratives.get(candidate.symbol) ?? fallbackNarrative(candidate);
      return {
        user_id: userId,
        symbol: candidate.symbol,
        score: candidate.score,
        thesis: narrative.thesis,
        risks: narrative.risks,
        confidence: candidate.confidence,
        signals: {
          name: candidate.name,
          aiGenerated: narratives.has(candidate.symbol),
          factors: candidate.factors,
        },
        generated_at: new Date().toISOString(),
        dismissed_at: null,
      };
    });

    const { error: upsertError } = await db
      .from('recommendations')
      .upsert(rows, { onConflict: 'user_id,symbol' });

    if (upsertError) throw new HttpError(500, 'write_failed', upsertError.message);

    // Drop anything from a previous run that no longer ranks, so the screen shows
    // exactly the current set.
    const { error: pruneError } = await db
      .from('recommendations')
      .delete()
      .eq('user_id', userId)
      .not('symbol', 'in', `(${top.map((candidate) => candidate.symbol).join(',')})`);

    if (pruneError) console.error('Pruning stale recommendations failed', pruneError);

    return jsonResponse({
      recommendations: rows.map((row) => ({
        symbol: row.symbol,
        score: row.score,
        thesis: row.thesis,
        risks: row.risks,
        confidence: row.confidence,
        signals: row.signals,
        generatedAt: row.generated_at,
      })),
      aiEnabled,
    });
  }),
);
