import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorView } from '@/components/ui/error-view';
import { groupedItemStyle } from '@/components/ui/grouped-section';
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
            hitSlop={8}
            style={({ pressed }) => [{ opacity: pressed ? 0.55 : 1 }, styles.addButton]}>
            <Ionicons name="add" size={28} color={theme.accent} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/search')}
          accessibilityRole="search"
          style={[styles.searchBar, { backgroundColor: theme.backgroundSelected }]}>
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
          renderItem={({ item, index }) => (
            <View
              style={[
                { backgroundColor: theme.surfaceElevated },
                groupedItemStyle(index, items.length),
              ]}>
              <WatchlistRow
                symbol={item.symbol}
                name={namesBySymbol.get(item.symbol)}
                quote={quotes.quotesBySymbol.get(item.symbol) ?? null}
                sparkline={series[item.symbol]}
                isLoadingQuote={quotes.isLoading}
                isStale={quotes.staleSymbols.includes(item.symbol)}
                showSeparator={index < items.length - 1}
                onPress={() => router.push(`/symbol/${item.symbol}`)}
                onLongPress={() => void handleRemove(item.id, item.symbol)}
              />
            </View>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTitles: {
    flex: 1,
    gap: Spacing.one,
  },
  addButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    minHeight: 36,
    paddingHorizontal: Spacing.three - 4,
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
    paddingHorizontal: Spacing.one,
  },
});
