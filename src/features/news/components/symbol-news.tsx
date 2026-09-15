import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { ErrorView } from '@/components/ui/error-view';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import { AiSummary } from '@/features/news/components/ai-summary';
import { NewsRow } from '@/features/news/components/news-row';
import { useSymbolNews } from '@/features/news/hooks';

export function SymbolNews({ symbol }: { symbol: string }) {
  const { articles, summary, aiEnabled, quotaExhausted, isLoading, isError, error, refetch } =
    useSymbolNews(symbol);

  return (
    <Card>
      <SectionHeader title="News" subtitle={`Latest coverage of ${symbol}`} />

      {isError ? (
        <ErrorView error={error} onRetry={refetch} compact />
      ) : isLoading ? (
        <View style={styles.loading}>
          <Skeleton height={72} />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </View>
      ) : articles.length === 0 ? (
        <ThemedText type="small" themeColor="textMuted">
          No recent news for {symbol}.
        </ThemedText>
      ) : (
        <View>
          {summary ? <AiSummary summary={summary} /> : null}

          {!summary && aiEnabled && quotaExhausted ? (
            <ThemedText type="caption" themeColor="textMuted">
              The daily AI summary quota is used up - headlines only for now.
            </ThemedText>
          ) : null}

          <View style={styles.list}>
            {articles.map((article) => (
              <NewsRow key={`${article.symbol}:${article.id}`} article={article} />
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  loading: {
    gap: Spacing.two,
  },
  list: {
    paddingTop: Spacing.two,
  },
});
