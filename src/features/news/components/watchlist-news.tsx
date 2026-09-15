import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorView } from '@/components/ui/error-view';
import { GroupedSection } from '@/components/ui/grouped-section';
import { Skeleton } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import { NewsRow } from '@/features/news/components/news-row';
import { useWatchlistNews } from '@/features/news/hooks';

type WatchlistNewsProps = {
  symbols: string[];
  onBrowseSymbols?: () => void;
};

/**
 * One merged, newest-first feed across the watchlist. Summaries are deliberately
 * absent here - per-symbol AI runs on the detail screen where it is asked for.
 */
export function WatchlistNews({ symbols, onBrowseSymbols }: WatchlistNewsProps) {
  const { articles, isLoading, isError, error, refetch } = useWatchlistNews(symbols);

  if (symbols.length === 0) {
    return (
      <EmptyState
        icon="newspaper-outline"
        title="No news yet"
        description="Add a few tickers to your watchlist and their headlines will show up here."
        actionLabel={onBrowseSymbols ? 'Find symbols' : undefined}
        onAction={onBrowseSymbols}
      />
    );
  }

  return (
    <GroupedSection title="Your news" subtitle="Headlines across your watchlist">
      {isError ? (
        <ErrorView error={error} onRetry={refetch} compact />
      ) : isLoading ? (
        <View style={styles.loading}>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} height={56} />
          ))}
        </View>
      ) : articles.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            icon="newspaper-outline"
            title="Nothing new"
            description="No recent coverage for the tickers you follow."
          />
        </View>
      ) : (
        articles.map((article) => (
          <NewsRow key={`${article.symbol}:${article.id}`} article={article} showSymbol />
        ))
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
});
