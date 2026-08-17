import type { SupabaseClient } from './deps.ts';
import { HttpError } from './http.ts';

export type RateLimitRule = {
  bucket: string;
  limit: number;
  windowSeconds: number;
};

/**
 * Per-user quotas, enforced in Postgres so they hold across function instances.
 * The provider-wide free-tier ceiling is protected by caching; this protects it
 * from a single user hammering the app.
 */
export const RATE_LIMITS = {
  marketData: { bucket: 'market_data', limit: 120, windowSeconds: 60 },
  aiChat: { bucket: 'ai_chat', limit: 20, windowSeconds: 60 },
  aiChatDaily: { bucket: 'ai_chat_daily', limit: 120, windowSeconds: 86_400 },
  recommend: { bucket: 'recommend', limit: 10, windowSeconds: 3_600 },
  summarizeNews: { bucket: 'summarize_news', limit: 30, windowSeconds: 3_600 },
  paperTrade: { bucket: 'paper_trade', limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

type ConsumeResult = {
  allowed: boolean;
  count: number;
  limit: number;
  retry_after_seconds: number;
};

export async function enforceRateLimit(
  admin: SupabaseClient,
  userId: string,
  rule: RateLimitRule,
): Promise<void> {
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_user_id: userId,
    p_bucket: rule.bucket,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
  });

  if (error) {
    // A limiter outage should not take the whole feature down.
    console.error('Rate limit check failed, allowing request', error);
    return;
  }

  const result = data as ConsumeResult;
  if (!result.allowed) {
    throw new HttpError(
      429,
      'rate_limited',
      `Too many requests. Try again in ${result.retry_after_seconds}s.`,
      result.retry_after_seconds,
    );
  }
}
