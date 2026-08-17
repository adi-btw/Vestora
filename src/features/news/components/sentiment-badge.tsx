import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { NewsSentiment } from '@/features/news/schemas';

const TONE_BY_SENTIMENT: Record<NewsSentiment, BadgeTone> = {
  bullish: 'up',
  bearish: 'down',
  neutral: 'neutral',
  mixed: 'warning',
};

const LABEL_BY_SENTIMENT: Record<NewsSentiment, string> = {
  bullish: 'Bullish coverage',
  bearish: 'Bearish coverage',
  neutral: 'Neutral coverage',
  mixed: 'Mixed coverage',
};

export function SentimentBadge({ sentiment }: { sentiment: NewsSentiment }) {
  return <Badge label={LABEL_BY_SENTIMENT[sentiment]} tone={TONE_BY_SENTIMENT[sentiment]} />;
}
