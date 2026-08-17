import { z } from 'zod';

import { newsArticleSchema } from '@/features/market/schemas';

export const NEWS_SENTIMENTS = ['bullish', 'bearish', 'neutral', 'mixed'] as const;
export type NewsSentiment = (typeof NEWS_SENTIMENTS)[number];

export const newsSummarySchema = z.object({
  symbol: z.string(),
  summaryDate: z.string(),
  sentiment: z.enum(NEWS_SENTIMENTS),
  summary: z.string(),
  keyDrivers: z.array(z.string()),
  articleCount: z.number(),
  model: z.string(),
  generatedAt: z.string(),
});
export type NewsSummary = z.infer<typeof newsSummarySchema>;

export const newsFeedResponseSchema = z.object({
  articles: z.array(newsArticleSchema),
  summaries: z.array(newsSummarySchema),
  aiEnabled: z.boolean(),
  quotaExhausted: z.boolean().optional(),
});
