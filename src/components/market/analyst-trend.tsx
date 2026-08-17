import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { RecommendationTrend } from '@/features/market/schemas';
import { useTheme } from '@/hooks/use-theme';

/**
 * Collapses the five analyst buckets into a single label. Weighted rather than
 * "most votes wins" so 40% strong-buy against 45% hold does not read as neutral.
 */
export function summarizeTrend(trend: RecommendationTrend): {
  label: string;
  score: number;
  total: number;
} {
  const total = trend.strongBuy + trend.buy + trend.hold + trend.sell + trend.strongSell;
  if (total === 0) return { label: 'No coverage', score: 0, total: 0 };

  const weighted = (trend.strongBuy * 2 + trend.buy - trend.sell - trend.strongSell * 2) / total;

  const label =
    weighted > 1
      ? 'Strong buy'
      : weighted > 0.3
        ? 'Buy'
        : weighted > -0.3
          ? 'Hold'
          : weighted > -1
            ? 'Sell'
            : 'Strong sell';

  return { label, score: weighted, total };
}

export function AnalystTrend({ trend }: { trend: RecommendationTrend }) {
  const theme = useTheme();
  const { label, total } = summarizeTrend(trend);

  const segments = [
    { key: 'strongBuy', count: trend.strongBuy, color: theme.up },
    { key: 'buy', count: trend.buy, color: theme.upSoft },
    { key: 'hold', count: trend.hold, color: theme.borderStrong },
    { key: 'sell', count: trend.sell, color: theme.downSoft },
    { key: 'strongSell', count: trend.strongSell, color: theme.down },
  ].filter((segment) => segment.count > 0);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {total} analyst{total === 1 ? '' : 's'}
          {trend.period ? ` - ${trend.period}` : ''}
        </ThemedText>
      </View>

      <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
        {segments.map((segment) => (
          <View key={segment.key} style={{ flex: segment.count, backgroundColor: segment.color }} />
        ))}
      </View>

      <View style={styles.legend}>
        <ThemedText type="caption" themeColor="textMuted">
          {trend.strongBuy + trend.buy} buy
        </ThemedText>
        <ThemedText type="caption" themeColor="textMuted">
          {trend.hold} hold
        </ThemedText>
        <ThemedText type="caption" themeColor="textMuted">
          {trend.sell + trend.strongSell} sell
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
