/**
 * Hand-maintained mirror of the SQL in `supabase/migrations`.
 *
 * Regenerate with the CLI once the project is linked if you prefer:
 *   npx supabase gen types typescript --linked > src/lib/database.types.ts
 * The shape below is kept deliberately close to that output so swapping is a
 * drop-in replacement.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Columns the database fills in for you are optional on insert. */
type Table<Row, Generated extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, Generated> & Partial<Pick<Row, Generated>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type AlertKind = 'price_above' | 'price_below' | 'percent_move' | 'news_keyword';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'filled' | 'pending' | 'rejected' | 'canceled';
export type ChatRole = 'user' | 'assistant' | 'tool' | 'system';
export type NewsSentiment = 'bullish' | 'bearish' | 'neutral' | 'mixed';

export type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type PushTokenRow = {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  created_at: string;
  last_seen_at: string;
};

export type WatchlistRow = {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type WatchlistItemRow = {
  id: string;
  watchlist_id: string;
  user_id: string;
  symbol: string;
  notes: string | null;
  sort_order: number;
  created_at: string;
};

export type SymbolRow = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  security_type: string | null;
  currency: string | null;
  updated_at: string;
};

export type QuoteCacheRow = {
  symbol: string;
  price: number | null;
  change: number | null;
  change_percent: number | null;
  day_high: number | null;
  day_low: number | null;
  day_open: number | null;
  previous_close: number | null;
  provider: string;
  fetched_at: string;
};

export type BarCacheRow = {
  symbol: string;
  timeframe: string;
  bars: Json;
  provider: string;
  fetched_at: string;
};

export type NewsCacheRow = {
  id: number;
  symbol: string;
  external_id: string;
  headline: string;
  summary: string | null;
  source: string | null;
  url: string;
  image_url: string | null;
  published_at: string;
  fetched_at: string;
};

export type NewsSummaryRow = {
  symbol: string;
  summary_date: string;
  sentiment: NewsSentiment;
  summary: string;
  key_drivers: Json;
  article_count: number;
  model: string;
  generated_at: string;
};

export type AlertRow = {
  id: string;
  user_id: string;
  symbol: string;
  kind: AlertKind;
  threshold: number | null;
  keyword: string | null;
  is_active: boolean;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  created_at: string;
};

export type AlertEventRow = {
  id: string;
  alert_id: string;
  user_id: string;
  symbol: string;
  message: string;
  triggered_price: number | null;
  delivered: boolean;
  created_at: string;
};

export type ChatThreadRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessageRow = {
  id: string;
  thread_id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  tool_calls: Json | null;
  created_at: string;
};

export type RecommendationRow = {
  id: string;
  user_id: string;
  symbol: string;
  score: number;
  thesis: string;
  risks: string;
  confidence: number;
  signals: Json;
  generated_at: string;
  dismissed_at: string | null;
};

export type PortfolioRow = {
  id: string;
  user_id: string;
  cash: number;
  starting_cash: number;
  created_at: string;
};

export type PositionRow = {
  id: string;
  portfolio_id: string;
  user_id: string;
  symbol: string;
  quantity: number;
  avg_cost: number;
  realized_pnl: number;
  updated_at: string;
};

export type OrderRow = {
  id: string;
  portfolio_id: string;
  user_id: string;
  symbol: string;
  side: OrderSide;
  order_type: OrderType;
  quantity: number;
  limit_price: number | null;
  status: OrderStatus;
  filled_price: number | null;
  filled_at: string | null;
  reject_reason: string | null;
  created_at: string;
};

export type PortfolioSnapshotRow = {
  id: string;
  portfolio_id: string;
  user_id: string;
  captured_on: string;
  equity: number;
  cash: number;
  positions_value: number;
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow, 'created_at' | 'updated_at'>;
      push_tokens: Table<PushTokenRow, 'id' | 'created_at' | 'last_seen_at'>;
      watchlists: Table<WatchlistRow, 'id' | 'is_default' | 'created_at' | 'updated_at'>;
      watchlist_items: Table<WatchlistItemRow, 'id' | 'notes' | 'sort_order' | 'created_at'>;
      symbols: Table<SymbolRow, 'updated_at'>;
      quote_cache: Table<QuoteCacheRow, 'fetched_at'>;
      bar_cache: Table<BarCacheRow, 'fetched_at'>;
      news_cache: Table<NewsCacheRow, 'id' | 'fetched_at'>;
      news_summaries: Table<NewsSummaryRow, 'generated_at'>;
      alerts: Table<
        AlertRow,
        | 'id'
        | 'threshold'
        | 'keyword'
        | 'is_active'
        | 'cooldown_minutes'
        | 'last_triggered_at'
        | 'created_at'
      >;
      alert_events: Table<AlertEventRow, 'id' | 'triggered_price' | 'delivered' | 'created_at'>;
      chat_threads: Table<ChatThreadRow, 'id' | 'title' | 'created_at' | 'updated_at'>;
      chat_messages: Table<ChatMessageRow, 'id' | 'tool_calls' | 'created_at'>;
      recommendations: Table<RecommendationRow, 'id' | 'signals' | 'generated_at' | 'dismissed_at'>;
      portfolios: Table<PortfolioRow, 'id' | 'cash' | 'starting_cash' | 'created_at'>;
      positions: Table<PositionRow, 'id' | 'realized_pnl' | 'updated_at'>;
      orders: Table<
        OrderRow,
        | 'id'
        | 'limit_price'
        | 'status'
        | 'filled_price'
        | 'filled_at'
        | 'reject_reason'
        | 'created_at'
      >;
      portfolio_snapshots: Table<PortfolioSnapshotRow, 'id'>;
    };
    Views: { [_ in never]: never };
    Functions: {
      consume_rate_limit: {
        Args: {
          p_user_id: string;
          p_bucket: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: Json;
      };
      ensure_portfolio: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      /** Applies cash, position and order changes in one transaction. */
      place_paper_order: {
        Args: {
          p_symbol: string;
          p_side: OrderSide;
          p_order_type: OrderType;
          p_quantity: number;
          p_limit_price: number | null;
          p_market_price: number | null;
        };
        Returns: OrderRow;
      };
      /** Service-role only: fills one pending limit order. */
      fill_pending_order: {
        Args: { p_order_id: string; p_market_price: number };
        Returns: boolean;
      };
      /** Service-role only: writes today's equity for every portfolio. */
      snapshot_portfolios: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
