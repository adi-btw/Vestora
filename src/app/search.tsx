import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorView } from '@/components/ui/error-view';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useSymbolSearch } from '@/features/market/hooks';
import { useAddSymbol, useWatchlistItems } from '@/features/watchlist/hooks';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';

/** Shown before the user types, so the screen is never a blank box. */
const STARTER_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'TSLA', 'SPY', 'QQQ'];

export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);

  const { symbols } = useWatchlistItems();
  const addSymbol = useAddSymbol();
  const search = useSymbolSearch(debouncedQuery);

  const watchedSymbols = useMemo(() => new Set(symbols), [symbols]);
  const results = search.data?.results ?? [];
  const isSearching = debouncedQuery.trim().length > 0;

  async function handleAdd(symbol: string) {
    if (watchedSymbols.has(symbol)) {
      router.push(`/symbol/${symbol}`);
      return;
    }
    try {
      await addSymbol.mutateAsync(symbol);
    } catch {
      // The mutation error is surfaced inline below; nothing to do here.
    }
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <ThemedText type="title">Add a symbol</ThemedText>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close search"
            hitSlop={8}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </Pressable>
        </View>

        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Ticker or company name"
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
        />

        {addSymbol.isError ? (
          <ThemedText type="small" themeColor="down">
            {addSymbol.error instanceof Error ? addSymbol.error.message : 'Could not add symbol.'}
          </ThemedText>
        ) : null}
      </View>

      {!isSearching ? (
        <View style={styles.starterSection}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Popular starting points
          </ThemedText>
          <View style={styles.chips}>
            {STARTER_SYMBOLS.map((symbol) => (
              <Pressable
                key={symbol}
                onPress={() => void handleAdd(symbol)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: watchedSymbols.has(symbol)
                      ? theme.backgroundSelected
                      : theme.surface,
                    borderColor: theme.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                <ThemedText type="smallBold">{symbol}</ThemedText>
                {watchedSymbols.has(symbol) ? (
                  <Ionicons name="checkmark" size={14} color={theme.up} />
                ) : (
                  <Ionicons name="add" size={14} color={theme.textSecondary} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      ) : search.isError ? (
        <ErrorView error={search.error} onRetry={search.refetch} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.symbol}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            search.isLoading ? (
              <ActivityIndicator style={styles.loader} color={theme.textSecondary} />
            ) : (
              <EmptyState
                title={`Nothing matches "${debouncedQuery.trim()}"`}
                description="Free-tier search covers US stocks and ETFs. Try the exact ticker."
              />
            )
          }
          renderItem={({ item }) => {
            const isWatched = watchedSymbols.has(item.symbol);
            return (
              <Pressable
                onPress={() => void handleAdd(item.symbol)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.resultRow,
                  { borderBottomColor: theme.border },
                  pressed && { backgroundColor: theme.backgroundElement },
                ]}>
                <View style={styles.resultText}>
                  <View style={styles.resultTitleRow}>
                    <ThemedText type="bodyBold">{item.symbol}</ThemedText>
                    {item.exchange ? <Badge label={item.exchange} /> : null}
                  </View>
                  {item.name ? (
                    <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                      {item.name}
                    </ThemedText>
                  ) : null}
                </View>
                <Ionicons
                  name={isWatched ? 'checkmark-circle' : 'add-circle-outline'}
                  size={24}
                  color={isWatched ? theme.up : theme.accent}
                />
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.three,
    padding: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  starterSection: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.three - 4,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  loader: {
    paddingVertical: Spacing.four,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.three - 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultText: {
    flex: 1,
    gap: 2,
  },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
