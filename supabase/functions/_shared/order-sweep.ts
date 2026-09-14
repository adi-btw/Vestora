import type { SupabaseClient } from './deps.ts';
import { getQuotes } from './market-service.ts';

/**
 * Pending limit orders and the daily equity snapshot.
 *
 * Both run from the same scheduled pass as the alert scan so the free tier only
 * has to support one cron: the quotes a scan already needs are reused here.
 */

const MAX_SYMBOLS = 40;

export type SweepResult = { pending: number; filled: number; snapshots: number };

type PendingOrder = { id: string; symbol: string };

export async function sweepPendingOrders(admin: SupabaseClient): Promise<SweepResult> {
  const result: SweepResult = { pending: 0, filled: 0, snapshots: 0 };

  const { data, error } = await admin
    .from('orders')
    .select('id, symbol')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.error('Pending order read failed', error);
  } else {
    const orders = (data ?? []) as PendingOrder[];
    result.pending = orders.length;

    if (orders.length > 0) {
      const symbols = [...new Set(orders.map((order) => order.symbol))].slice(0, MAX_SYMBOLS);
      const { quotes } = await getQuotes(admin, symbols);
      const priceBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote.price]));

      for (const order of orders) {
        const price = priceBySymbol.get(order.symbol);
        if (price == null) continue;

        // The limit comparison and the money movement both live in Postgres, so a
        // price that has moved between the read and the write cannot fill wrongly.
        const { data: filled, error: fillError } = await admin.rpc('fill_pending_order', {
          p_order_id: order.id,
          p_market_price: price,
        });

        if (fillError) {
          console.error('Fill attempt failed', { orderId: order.id, error: fillError });
          continue;
        }
        if (filled === true) result.filled += 1;
      }
    }
  }

  const { data: snapshotCount, error: snapshotError } = await admin.rpc('snapshot_portfolios');
  if (snapshotError) {
    console.error('Portfolio snapshot failed', snapshotError);
  } else if (typeof snapshotCount === 'number') {
    result.snapshots = snapshotCount;
  }

  return result;
}
