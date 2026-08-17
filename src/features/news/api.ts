import { newsFeedResponseSchema } from '@/features/news/schemas';
import { invokeFunction } from '@/lib/functions';

const FUNCTION_NAME = 'summarize-news';

export function fetchNewsFeed(params: {
  symbols: string[];
  limit?: number;
  includeSummaries?: boolean;
}) {
  return invokeFunction(FUNCTION_NAME, { ...params }, newsFeedResponseSchema);
}
