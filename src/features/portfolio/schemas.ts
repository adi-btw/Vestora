import { z } from 'zod';

export const orderSchema = z.object({
  id: z.string(),
  portfolio_id: z.string(),
  user_id: z.string(),
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  order_type: z.enum(['market', 'limit']),
  quantity: z.coerce.number(),
  limit_price: z.coerce.number().nullable(),
  status: z.enum(['filled', 'pending', 'rejected', 'canceled']),
  filled_price: z.coerce.number().nullable(),
  filled_at: z.string().nullable(),
  reject_reason: z.string().nullable(),
  created_at: z.string(),
});
export type Order = z.infer<typeof orderSchema>;

export const tradeResponseSchema = z.object({
  order: orderSchema,
  marketPrice: z.number().nullable().optional(),
});

export const cancelResponseSchema = z.object({ order: orderSchema });

export type Position = {
  symbol: string;
  quantity: number;
  avgCost: number;
  realizedPnl: number;
  /** Null while the quote for this symbol is still loading. */
  price: number | null;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPercent: number | null;
  dayChangePercent: number | null;
};

export type PortfolioSummary = {
  cash: number;
  startingCash: number;
  positionsValue: number;
  equity: number;
  /** Equity minus what the account started with. */
  totalReturn: number;
  totalReturnPercent: number;
  unrealizedPnl: number;
  realizedPnl: number;
  positions: Position[];
};
