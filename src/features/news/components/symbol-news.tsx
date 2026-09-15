import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ErrorView } from '@/components/ui/error-view';
import { GroupedSection } from '@/components/ui/grouped-section';
import { Skeleton } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import { AiSummary } from '@/features/news/components/ai-summary';
import { NewsRow } from '@/features/news/components/news-row';
import { useSymbolNews } from '@/features/news/hooks';

export function SymbolNews({ symbol }: { symbol: string }) {
  const { articles, summary, aiEnabled, quotaExhausted, isLoading, isError, error, refetch } =
    useSymbolNews(symbol);

  return (
    <GroupedSection title="News" subtitle={`Latest coverage of ${symbol}`}>
      {isError ? (
        <ErrorView error={error} onRetry={refetch} compact />
      ) : isLoading ? (
        <View style={styles.loading}>
          <Skeleton height={72} />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </View>
      ) : articles.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText type="small" themeColor="textMuted">
            No recent news for {symbol}.
          </ThemedText>
        </View>
      ) : (
        <View>
          {summary ? (
            <View style={styles.summary}>
              <AiSummary summary={summary} />
            </View>
          ) : null}

          {!summary && aiEnabled && quotaExhausted ? (
            <ThemedText type="caption" themeColor="textMuted" style={styles.quota}>
              The daily AI summary quota is used up - headlines only for now.
            </ThemedText>
          ) : null}

          {articles.map((article) => (
            <NewsRow key={`${article.symbol}:${article.id}`} article={article} />
          ))}
        </View>
      )}
    </GroupedSection>
  );
}

const styles = StyleSheet.create({
  loading: {
    gap: Spacing.two,
    padding: Spacing.three,
  },
  empty: {
    padding: Spacing.three,
  },
  summary: {
    padding: Spacing.three,
    paddingBottom: Spacing.two,
  },
  quota: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
});
