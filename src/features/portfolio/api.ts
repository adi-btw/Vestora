import { cancelResponseSchema, tradeResponseSchema } from '@/features/portfolio/schemas';
import type {
  OrderRow,
  PortfolioRow,
  PortfolioSnapshotRow,
  PositionRow,
} from '@/lib/database.types';
import { invokeFunction } from '@/lib/functions';
import { supabase } from '@/lib/supabase';

const FUNCTION_NAME = 'paper-trade';

/**
 * Reads the portfolio, creating it through `ensure_portfolio` for accounts that
 * predate the paper-trading migration.
 */
export async function fetchPortfolio(): Promise<PortfolioRow> {
  const { data, error } = await supabase.from('portfolios').select('*').maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { error: createError } = await supabase.rpc('ensure_portfolio');
  if (createError) throw createError;

  const { data: created, error: reReadError } = await supabase
    .from('portfolios')
    .select('*')
    .single();

  if (reReadError) throw reReadError;
  return created;
}

export async function fetchPositions(): Promise<PositionRow[]> {
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .gt('quantity', 0)
    .order('symbol', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export async function fetchEquityCurve(): Promise<PortfolioSnapshotRow[]> {
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .select('*')
    .order('captured_on', { ascending: true })
    .limit(180);

  if (error) throw error;
  return data ?? [];
}

export function placeOrder(params: {
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: number;
  limitPrice?: number;
}) {
  return invokeFunction(FUNCTION_NAME, { action: 'place', ...params }, tradeResponseSchema);
}

export function cancelOrder(orderId: string) {
  return invokeFunction(FUNCTION_NAME, { action: 'cancel', orderId }, cancelResponseSchema);
}
