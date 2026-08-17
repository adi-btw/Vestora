import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { WatchlistNews } from '@/features/news/components/watchlist-news';
import { RecommendationList } from '@/features/recommendations/components/recommendation-list';
import { useWatchlistItems } from '@/features/watchlist/hooks';
import { queryKeys } from '@/lib/query-keys';

export default function DiscoverScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { symbols } = useWatchlistItems();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pull-to-refresh re-reads stored ideas and headlines; it deliberately does not
  // re-run the scoring pass, which costs provider and model quota.
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.news.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.all }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  return (
    <Screen scroll onRefresh={refresh} refreshing={isRefreshing} contentStyle={styles.content}>
      <View style={styles.header}>
        <ThemedText type="title">Discover</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          News and ideas built from the tickers you follow.
        </ThemedText>
      </View>

      <RecommendationList />

      <WatchlistNews symbols={symbols} onBrowseSymbols={() => router.push('/search')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
  },
  header: {
    gap: 2,
    paddingTop: Spacing.two,
  },
});
