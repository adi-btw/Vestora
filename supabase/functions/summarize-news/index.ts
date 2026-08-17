// Returns a news feed plus one AI sentiment summary per symbol per day.
//
// The summary is cached in Postgres keyed by (symbol, date): the first user to
// open a ticker pays for the model call, everyone else reads the row.

import { requireUser } from '../_shared/clients.ts';
import { mapWithConcurrency } from '../_shared/concurrency.ts';
import { z } from '../_shared/deps.ts';
import { HttpError, jsonResponse, parseJsonBody, serveJson } from '../_shared/http.ts';
import { getNews } from '../_shared/market-service.ts';
import {
  readSummaries,
  summarizeSymbol,
  todayInUtc,
  type NewsSummary,
} from '../_shared/news-summary.ts';
import * as gemini from '../_shared/providers/gemini.ts';
import { enforceRateLimit, RATE_LIMITS } from '../_shared/rate-limit.ts';

const requestSchema = z.object({
  symbols: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(12)
        .regex(/^[A-Za-z0-9.\-]+$/)
        .transform((value) => value.toUpperCase()),
    )
    .min(1)
    .max(12),
  limit: z.number().int().min(1).max(50).optional(),
  /** Skip the model entirely - used by the combined feed, which only needs articles. */
  includeSummaries: z.boolean().optional(),
});

Deno.serve(
  serveJson(async (request) => {
    const { userId, admin } = await requireUser(request);
    await enforceRateLimit(admin, userId, RATE_LIMITS.summarizeNews);

    const parsed = requestSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      throw new HttpError(
        400,
        'invalid_request',
        parsed.error.issues[0]?.message ?? 'Bad request.',
      );
    }

    const { symbols, limit = 30, includeSummaries = true } = parsed.data;
    const articles = await getNews(admin, symbols, limit);

    if (!includeSummaries || !gemini.isConfigured()) {
      return jsonResponse({ articles, summaries: [], aiEnabled: gemini.isConfigured() });
    }

    const summaryDate = todayInUtc();
    const cached = await readSummaries(admin, symbols, summaryDate);
    const missing = symbols.filter((symbol) => !cached.has(symbol));

    // Free-tier Gemini allows ~10 requests/minute, so keep the fan-out small.
    const settled = await mapWithConcurrency(missing, 2, (symbol) =>
      summarizeSymbol(
        admin,
        symbol,
        articles.filter((article) => article.symbol === symbol),
        summaryDate,
      ),
    );

    const summaries: NewsSummary[] = [...cached.values()];
    let quotaExhausted = false;

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        if (result.value) summaries.push(result.value);
        continue;
      }

      // A missing summary degrades the UI gracefully; the articles still render.
      if (result.reason instanceof HttpError && result.reason.code === 'quota_exhausted') {
        quotaExhausted = true;
      }
      console.error('News summarisation failed', result.reason);
    }

    return jsonResponse({ articles, summaries, aiEnabled: true, quotaExhausted });
  }),
);
