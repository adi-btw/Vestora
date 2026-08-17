import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorView } from '@/components/ui/error-view';
import { MarketStatusPill } from '@/components/ui/market-status-pill';
import { Screen } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';
import { Radius, Spacing } from '@/constants/theme';
import { useQuotes, useSparklines } from '@/features/market/hooks';
import { useSymbolNames } from '@/features/market/symbol-directory';
import { WatchlistRow } from '@/features/watchlist/components/watchlist-row';
import { useRemoveSymbol, useWatchlistItems } from '@/features/watchlist/hooks';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/confirm';

export default function WatchlistScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { items, symbols, isLoading, isError, error, refetch } = useWatchlistItems();
  const quotes = useQuotes(symbols);
  const { series } = useSparklines(symbols);
  const { namesBySymbol } = useSymbolNames(symbols);
  const removeSymbol = useRemoveSymbol();

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.allSettled([refetch(), quotes.refetch()]);
    setIsRefreshing(false);
  }, [refetch, quotes]);

  const handleRemove = useCallback(
    async (itemId: string, symbol: string) => {
      const confirmed = await confirmAction({
        title: `Remove ${symbol}?`,
        message: 'It will disappear from your watchlist. Alerts for it stay untouched.',
        confirmLabel: 'Remove',
        destructive: true,
      });
      if (confirmed) removeSymbol.mutate(itemId);
    },
    [removeSymbol],
  );

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitles}>
            <ThemedText type="title">Watchlist</ThemedText>
            <MarketStatusPill />
          </View>
          <Pressable
            onPress={() => router.push('/search')}
            accessibilityRole="button"
            accessibilityLabel="Add a symbol"
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Ionicons name="add" size={22} color={theme.accentText} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/search')}
          accessibilityRole="search"
          style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <ThemedText type="small" themeColor="textMuted">
            Search stocks and ETFs
          </ThemedText>
        </Pressable>
      </View>

      {isError ? (
        <ErrorView error={error} onRetry={refetch} />
      ) : isLoading ? (
        <View style={styles.listPadding}>
          <SkeletonList />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listPadding, items.length === 0 && styles.emptyContainer]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={theme.textSecondary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="list-outline"
              title="Your watchlist is empty"
              description="Add a few tickers to see live prices, news and AI recommendations built from what you follow."
              actionLabel="Find a stock"
              onAction={() => router.push('/search')}
            />
          }
          ListFooterComponent={
            items.length > 0 ? (
              <ThemedText type="caption" themeColor="textMuted" style={styles.footer}>
                Long-press a row to remove it. Prices are IEX real-time or delayed depending on the
                session.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <WatchlistRow
              symbol={item.symbol}
              name={namesBySymbol.get(item.symbol)}
              quote={quotes.quotesBySymbol.get(item.symbol) ?? null}
              sparkline={series[item.symbol]}
              isLoadingQuote={quotes.isLoading}
              isStale={quotes.staleSymbols.includes(item.symbol)}
              onPress={() => router.push(`/symbol/${item.symbol}`)}
              onLongPress={() => void handleRemove(item.id, item.symbol)}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitles: {
    gap: Spacing.one + 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  listPadding: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  footer: {
    paddingTop: Spacing.three,
  },
});
