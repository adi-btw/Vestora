// Paper trading endpoint.
//
// The function's only real job is pricing: it fetches the quote through the shared
// cache and hands it to `place_paper_order`, which applies the cash and position
// changes in one transaction. Prices never come from the client, so a crafted
// request cannot buy at a price of its choosing.

import { requireUser } from '../_shared/clients.ts';
import { z } from '../_shared/deps.ts';
import { HttpError, jsonResponse, parseJsonBody, serveJson } from '../_shared/http.ts';
import { getQuotes, normalizeSymbol } from '../_shared/market-service.ts';
import { enforceRateLimit, RATE_LIMITS } from '../_shared/rate-limit.ts';

const symbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(12)
  .regex(/^[A-Za-z0-9.\-]+$/, 'That does not look like a ticker symbol.');

const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('place'),
    symbol: symbolSchema,
    side: z.enum(['buy', 'sell']),
    orderType: z.enum(['market', 'limit']),
    // Fractional shares are allowed, but a zero or absurd size is not.
    quantity: z.number().positive().max(1_000_000),
    limitPrice: z.number().positive().max(1_000_000).optional(),
  }),
  z.object({
    action: z.literal('cancel'),
    orderId: z.string().uuid(),
  }),
]);

Deno.serve(
  serveJson(async (request) => {
    const { userId, db, admin } = await requireUser(request);
    await enforceRateLimit(admin, userId, RATE_LIMITS.paperTrade);

    const parsed = requestSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      throw new HttpError(
        400,
        'invalid_request',
        parsed.error.issues[0]?.message ?? 'Bad request.',
      );
    }

    if (parsed.data.action === 'cancel') {
      const { data, error } = await db
        .from('orders')
        .update({ status: 'canceled' })
        .eq('id', parsed.data.orderId)
        .eq('status', 'pending')
        .select()
        .maybeSingle();

      if (error) throw new HttpError(500, 'cancel_failed', error.message);
      if (!data) {
        throw new HttpError(409, 'not_cancelable', 'That order is no longer pending.');
      }

      return jsonResponse({ order: data });
    }

    const { symbol, side, orderType, quantity, limitPrice } = parsed.data;

    if (orderType === 'limit' && limitPrice === undefined) {
      throw new HttpError(400, 'invalid_request', 'A limit order needs a limit price.');
    }

    const normalized = normalizeSymbol(symbol);
    const { quotes } = await getQuotes(admin, [normalized]);
    const price = quotes[0]?.price ?? null;

    if (orderType === 'market' && price === null) {
      throw new HttpError(
        503,
        'no_price',
        `No live price for ${normalized} right now. Try again shortly.`,
      );
    }

    const { data, error } = await db.rpc('place_paper_order', {
      p_symbol: normalized,
      p_side: side,
      p_order_type: orderType,
      p_quantity: quantity,
      p_limit_price: limitPrice ?? null,
      p_market_price: price,
    });

    if (error) throw new HttpError(500, 'order_failed', error.message);

    return jsonResponse({ order: data, marketPrice: price });
  }),
);
