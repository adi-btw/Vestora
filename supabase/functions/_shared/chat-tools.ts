import type { SupabaseClient } from './deps.ts';
import { HttpError } from './http.ts';
import {
  getBars,
  getCompanySnapshot,
  getNews,
  getQuotes,
  searchSymbols,
} from './market-service.ts';
import type { FunctionDeclaration } from './providers/gemini.ts';

/**
 * Tools the advisor may call.
 *
 * Everything here is a thin wrapper over the same cached market service the app
 * uses, which is what keeps answers grounded: the model can only talk about
 * numbers it fetched through one of these.
 */

export type ToolContext = {
  /** RLS-scoped client - required for anything touching the user's own rows. */
  db: SupabaseClient;
  /** Service-role client for shared market caches. */
  admin: SupabaseClient;
  userId: string;
};

type ToolHandler = (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;

type ToolDefinition = {
  declaration: FunctionDeclaration;
  handler: ToolHandler;
  /** Write tools are never executed without an explicit user confirmation. */
  mutates: boolean;
};

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(400, 'invalid_tool_args', `Tool argument "${key}" must be a string.`);
  }
  return value.trim().toUpperCase();
}

function requireSymbolList(args: Record<string, unknown>, key: string): string[] {
  const value = args[key];
  const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const symbols = list
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 10);

  if (symbols.length === 0) {
    throw new HttpError(
      400,
      'invalid_tool_args',
      `Tool argument "${key}" needs at least one symbol.`,
    );
  }
  return symbols;
}

const TIMEFRAMES = ['1D', '1W', '1M', '3M', '1Y', '5Y'] as const;

export const TOOLS: Record<string, ToolDefinition> = {
  get_quotes: {
    mutates: false,
    declaration: {
      name: 'get_quotes',
      description:
        'Current price, day change and day range for up to 10 tickers. Use this before discussing any price.',
      parameters: {
        type: 'object',
        properties: {
          symbols: {
            type: 'array',
            items: { type: 'string' },
            description: 'Ticker symbols, e.g. ["AAPL","MSFT"].',
          },
        },
        required: ['symbols'],
      },
    },
    handler: async (args, { admin }) => {
      const { quotes } = await getQuotes(admin, requireSymbolList(args, 'symbols'));
      return { quotes };
    },
  },

  get_company: {
    mutates: false,
    declaration: {
      name: 'get_company',
      description:
        'Company profile, valuation ratios, growth and margin metrics, analyst consensus and peer tickers for one symbol.',
      parameters: {
        type: 'object',
        properties: { symbol: { type: 'string', description: 'A single ticker symbol.' } },
        required: ['symbol'],
      },
    },
    handler: (args, { admin }) => getCompanySnapshot(admin, requireString(args, 'symbol')),
  },

  get_news: {
    mutates: false,
    declaration: {
      name: 'get_news',
      description: 'Recent news headlines for up to 10 tickers, newest first.',
      parameters: {
        type: 'object',
        properties: {
          symbols: { type: 'array', items: { type: 'string' } },
          limit: { type: 'integer', description: 'Maximum headlines to return (default 8).' },
        },
        required: ['symbols'],
      },
    },
    handler: async (args, { admin }) => {
      const limit = typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 15) : 8;
      const articles = await getNews(admin, requireSymbolList(args, 'symbols'), limit);
      // Strip images and ids: they cost tokens and the model cannot use them.
      return {
        articles: articles.map(({ headline, source, publishedAt, symbol, summary }) => ({
          symbol,
          headline,
          source,
          publishedAt,
          summary: summary?.slice(0, 300) ?? null,
        })),
      };
    },
  },

  get_price_history: {
    mutates: false,
    declaration: {
      name: 'get_price_history',
      description:
        'Daily or intraday closing prices for one ticker over a window. Use it to reason about trends, not to quote an exact current price.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          timeframe: { type: 'string', enum: [...TIMEFRAMES] },
        },
        required: ['symbol', 'timeframe'],
      },
    },
    handler: async (args, { admin }) => {
      const timeframe = String(args.timeframe ?? '1M') as (typeof TIMEFRAMES)[number];
      if (!TIMEFRAMES.includes(timeframe)) {
        throw new HttpError(400, 'invalid_tool_args', `Unsupported timeframe "${timeframe}".`);
      }

      const bars = await getBars(admin, requireString(args, 'symbol'), timeframe);
      // Downsample to ~30 points: the shape is what matters and full series blow
      // through the context window.
      const step = Math.max(1, Math.ceil(bars.length / 30));
      return {
        timeframe,
        points: bars
          .filter((_, index) => index % step === 0)
          .map((bar) => ({ t: bar.t, c: bar.c })),
        first: bars[0]?.c ?? null,
        last: bars[bars.length - 1]?.c ?? null,
      };
    },
  },

  search_symbols: {
    mutates: false,
    declaration: {
      name: 'search_symbols',
      description: 'Resolve a company name to a ticker symbol.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
    handler: async (args, { admin }) => {
      const query = typeof args.query === 'string' ? args.query : '';
      return { results: (await searchSymbols(admin, query)).slice(0, 8) };
    },
  },

  get_watchlist: {
    mutates: false,
    declaration: {
      name: 'get_watchlist',
      description:
        "The tickers the user follows, with any notes they wrote. Call this whenever the user says 'my watchlist', 'my stocks' or asks for something personalised.",
      parameters: { type: 'object', properties: {} },
    },
    handler: async (_args, { db }) => {
      const { data, error } = await db
        .from('watchlist_items')
        .select('symbol, notes')
        .order('sort_order', { ascending: true });

      if (error) throw new HttpError(500, 'watchlist_read_failed', error.message);
      return { items: data ?? [] };
    },
  },

  add_to_watchlist: {
    mutates: true,
    declaration: {
      name: 'add_to_watchlist',
      description:
        'Add a ticker to the user watchlist. Only call this when the user clearly asks to follow or add a stock.',
      parameters: {
        type: 'object',
        properties: { symbol: { type: 'string' } },
        required: ['symbol'],
      },
    },
    handler: async (args, { db, userId }) => {
      const symbol = requireString(args, 'symbol');

      const { data: watchlist, error: watchlistError } = await db
        .from('watchlists')
        .select('id')
        .eq('is_default', true)
        .maybeSingle();

      if (watchlistError) throw new HttpError(500, 'watchlist_read_failed', watchlistError.message);
      if (!watchlist) throw new HttpError(404, 'watchlist_missing', 'No default watchlist found.');

      const { error } = await db
        .from('watchlist_items')
        .upsert(
          { watchlist_id: watchlist.id, user_id: userId, symbol },
          { onConflict: 'watchlist_id,symbol' },
        );

      if (error) throw new HttpError(500, 'watchlist_write_failed', error.message);
      return { added: symbol };
    },
  },
};

export const TOOL_DECLARATIONS: FunctionDeclaration[] = Object.values(TOOLS).map(
  (tool) => tool.declaration,
);

export function isWriteTool(name: string): boolean {
  return TOOLS[name]?.mutates ?? false;
}

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<unknown> {
  const tool = TOOLS[name];
  if (!tool) throw new HttpError(400, 'unknown_tool', `Unknown tool "${name}".`);
  return await tool.handler(args, context);
}

/** Human-readable prompt shown when a write tool needs confirmation. */
export function describeWriteAction(name: string, args: Record<string, unknown>): string {
  if (name === 'add_to_watchlist') {
    return `Add ${String(args.symbol ?? '').toUpperCase()} to your watchlist?`;
  }
  return `Run ${name}?`;
}
