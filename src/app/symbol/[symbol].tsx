import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnalystTrend } from '@/components/market/analyst-trend';
import { ChangePill } from '@/components/market/change-pill';
import { PriceChart } from '@/components/market/price-chart';
import { StatGrid, type Stat } from '@/components/market/stat-grid';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorView } from '@/components/ui/error-view';
import { GroupedSection } from '@/components/ui/grouped-section';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Skeleton } from '@/components/ui/skeleton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useBars, useCompany, useQuote } from '@/features/market/hooks';
import { TIMEFRAMES, type Bar, type Timeframe } from '@/features/market/schemas';
import { SymbolNews } from '@/features/news/components/symbol-news';
import { useWatchlistEntry } from '@/features/watchlist/hooks';
import { useTheme } from '@/hooks/use-theme';
import {
  formatCompact,
  formatCurrency,
  formatDateTime,
  formatMarketCap,
  formatPercent,
} from '@/lib/format';

const TIMEFRAME_OPTIONS = TIMEFRAMES.map((value) => ({ value, label: value }));

export default function SymbolDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ symbol: string }>();
  const symbol = (params.symbol ?? '').toUpperCase();

  const [timeframe, setTimeframe] = useState<Timeframe>('1M');
  const [scrubbed, setScrubbed] = useState<Bar | null>(null);

  const { quote, isLoading: isQuoteLoading, isError, error, refetch } = useQuote(symbol);
  const bars = useBars(symbol, timeframe);
  const company = useCompany(symbol);
  const watchlist = useWatchlistEntry(symbol);

  const profile = company.data?.profile ?? null;
  const financials = company.data?.financials ?? null;
  const trend = company.data?.recommendationTrend ?? null;
  const peers = [...new Set((company.data?.peers ?? []).filter(Boolean))];

  const displayPrice = scrubbed?.c ?? quote?.price ?? null;

  const handleScrub = useCallback((bar: Bar | null) => setScrubbed(bar), []);

  const stats = useMemo<Stat[]>(() => {
    const dayRange =
      quote?.dayLow != null && quote?.dayHigh != null
        ? `${formatCurrency(quote.dayLow)} - ${formatCurrency(quote.dayHigh)}`
        : '--';
    const yearRange =
      financials?.week52Low != null && financials?.week52High != null
        ? `${formatCurrency(financials.week52Low)} - ${formatCurrency(financials.week52High)}`
        : '--';

    return [
      { label: 'Previous close', value: formatCurrency(quote?.previousClose) },
      { label: 'Open', value: formatCurrency(quote?.dayOpen) },
      { label: 'Day range', value: dayRange },
      { label: '52-week range', value: yearRange },
      { label: 'Market cap', value: formatMarketCap(profile?.marketCapMillions) },
      { label: 'P/E (TTM)', value: financials?.peRatio ? financials.peRatio.toFixed(1) : '--' },
      { label: 'Price / book', value: financials?.pbRatio ? financials.pbRatio.toFixed(2) : '--' },
      { label: 'Beta', value: financials?.beta ? financials.beta.toFixed(2) : '--' },
      { label: 'Dividend yield', value: formatPercent(financials?.dividendYield) },
      {
        label: 'Shares out',
        value: profile?.shareOutstanding
          ? formatCompact(profile.shareOutstanding * 1_000_000)
          : '--',
      },
    ];
  }, [quote, financials, profile]);

  if (!symbol) {
    return <ErrorView error={new Error('No symbol provided.')} onRetry={() => router.back()} />;
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.six },
      ]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.accent} />
        </Pressable>

        <Pressable
          onPress={watchlist.toggle}
          disabled={watchlist.isPending}
          accessibilityRole="button"
          accessibilityLabel={watchlist.isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
          style={({ pressed }) => [{ opacity: pressed || watchlist.isPending ? 0.55 : 1 }]}>
          <ThemedText type="body" themeColor="accent">
            {watchlist.isWatched ? 'Watching' : 'Add'}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.identity}>
        <ThemedText type="title">{symbol}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {profile?.name ?? (company.isLoading ? 'Loading company profile...' : symbol)}
        </ThemedText>
      </View>

      {isError ? (
        <ErrorView error={error} onRetry={refetch} compact />
      ) : (
        <View style={styles.priceBlock}>
          {isQuoteLoading && !quote ? (
            <Skeleton width={180} height={40} />
          ) : (
            <ThemedText type="display">{formatCurrency(displayPrice)}</ThemedText>
          )}

          {scrubbed ? (
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(scrubbed.t)}
            </ThemedText>
          ) : quote ? (
            <View style={styles.changeRow}>
              <ChangePill change={quote.change} changePercent={quote.changePercent} showAbsolute />
              <ThemedText type="caption" themeColor="textMuted">
                as of {formatDateTime(quote.asOf)}
              </ThemedText>
            </View>
          ) : null}
        </View>
      )}

      {bars.isError ? (
        <ErrorView error={bars.error} onRetry={bars.refetch} compact />
      ) : bars.isLoading ? (
        <Skeleton height={220} radius={Radius.md} />
      ) : bars.data && bars.data.bars.length > 1 ? (
        <PriceChart
          bars={bars.data.bars}
          baseline={timeframe === '1D' ? (quote?.previousClose ?? null) : null}
          onScrub={handleScrub}
        />
      ) : (
        <View style={styles.chartFallback}>
          <ThemedText type="small" themeColor="textMuted">
            No price history available for this window.
          </ThemedText>
        </View>
      )}

      <SegmentedControl
        options={TIMEFRAME_OPTIONS}
        value={timeframe}
        onChange={(next) => {
          setTimeframe(next);
          setScrubbed(null);
        }}
      />

      <View style={styles.actions}>
        <Button
          label="Trade"
          onPress={() => router.push(`/trade/${symbol}`)}
          style={styles.actionButton}
          icon={<Ionicons name="swap-horizontal" size={16} color={theme.accentText} />}
        />
        <Button
          label="Set alert"
          onPress={() => router.push(`/alert/${symbol}`)}
          variant="secondary"
          style={styles.actionButton}
          icon={<Ionicons name="notifications-outline" size={16} color={theme.text} />}
        />
      </View>

      <GroupedSection title="Statistics" padded>
        <StatGrid stats={stats} />
        {profile?.industry ? (
          <ThemedText type="caption" themeColor="textMuted" style={styles.industry}>
            {profile.industry}
            {profile.exchange ? ` · ${profile.exchange}` : ''}
          </ThemedText>
        ) : null}
      </GroupedSection>

      {trend ? (
        <GroupedSection title="Analyst consensus" padded>
          <AnalystTrend trend={trend} />
        </GroupedSection>
      ) : null}

      <SymbolNews symbol={symbol} />

      {peers.length > 0 ? (
        <GroupedSection title="Similar companies" subtitle="Used to seed AI recommendations" padded>
          <View style={styles.peers}>
            {peers.slice(0, 10).map((peer) => (
              <Pressable
                key={peer}
                onPress={() => router.push(`/symbol/${peer}`)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.peerChip,
                  {
                    backgroundColor: theme.backgroundElement,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}>
                <ThemedText type="captionBold">{peer}</ThemedText>
              </Pressable>
            ))}
          </View>
        </GroupedSection>
      ) : null}

      <ThemedText type="caption" themeColor="textMuted">
        Quotes from {quote?.provider ?? 'Finnhub'}; history from Alpaca IEX. Free-tier data can be
        delayed.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  identity: {
    gap: 2,
  },
  priceBlock: {
    gap: Spacing.one,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  chartFallback: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
  industry: {
    paddingTop: Spacing.two,
  },
  peers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  peerChip: {
    paddingHorizontal: Spacing.three - 4,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
  },
});
