// Single entry point for every market read the client performs.
//
// Keeping this behind one function means provider keys, caching and rate limiting
// live in exactly one place, and the app only ever talks to Supabase.

import { requireUser } from '../_shared/clients.ts';
import { z } from '../_shared/deps.ts';
import { HttpError, jsonResponse, parseJsonBody, serveJson } from '../_shared/http.ts';
import {
  getBars,
  getCompanySnapshot,
  getNews,
  getQuotes,
  getSparklines,
  searchSymbols,
} from '../_shared/market-service.ts';
import { TIMEFRAMES } from '../_shared/market-types.ts';
import { enforceRateLimit, RATE_LIMITS } from '../_shared/rate-limit.ts';

const symbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(12)
  .regex(/^[A-Za-z0-9.\-]+$/, 'Symbols may only contain letters, numbers, dots and dashes.')
  .transform((value) => value.toUpperCase());

const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('quotes'),
    symbols: z.array(symbolSchema).min(1).max(60),
  }),
  z.object({
    action: z.literal('bars'),
    symbol: symbolSchema,
    timeframe: z.enum(TIMEFRAMES),
  }),
  z.object({
    action: z.literal('sparklines'),
    symbols: z.array(symbolSchema).min(1).max(40),
  }),
  z.object({
    action: z.literal('search'),
    query: z.string().trim().min(1).max(40),
  }),
  z.object({
    action: z.literal('company'),
    symbol: symbolSchema,
  }),
  z.object({
    action: z.literal('news'),
    symbols: z.array(symbolSchema).min(1).max(25),
    limit: z.number().int().min(1).max(50).optional(),
  }),
]);

Deno.serve(
  serveJson(async (request) => {
    const { userId, admin } = await requireUser(request);
    await enforceRateLimit(admin, userId, RATE_LIMITS.marketData);

    const parsed = requestSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      throw new HttpError(
        400,
        'invalid_request',
        parsed.error.issues[0]?.message ?? 'Bad request.',
      );
    }
    const body = parsed.data;

    switch (body.action) {
      case 'quotes': {
        const { quotes, staleSymbols } = await getQuotes(admin, body.symbols);
        return jsonResponse({ quotes, staleSymbols });
      }
      case 'bars': {
        const bars = await getBars(admin, body.symbol, body.timeframe);
        return jsonResponse({ symbol: body.symbol, timeframe: body.timeframe, bars });
      }
      case 'sparklines': {
        const series = await getSparklines(admin, body.symbols);
        return jsonResponse({ series });
      }
      case 'search': {
        const results = await searchSymbols(admin, body.query);
        return jsonResponse({ results });
      }
      case 'company': {
        const snapshot = await getCompanySnapshot(admin, body.symbol);
        return jsonResponse({ symbol: body.symbol, ...snapshot });
      }
      case 'news': {
        const articles = await getNews(admin, body.symbols, body.limit ?? 30);
        return jsonResponse({ articles });
      }
    }
  }),
);
