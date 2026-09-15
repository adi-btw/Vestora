import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChangePill } from '@/components/market/change-pill';
import { useDirectionColor } from '@/components/market/price-change';
import { Sparkline } from '@/components/market/sparkline';
import { ThemedText } from '@/components/themed-text';
import { Skeleton } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import type { Quote } from '@/features/market/schemas';
import { useTheme } from '@/hooks/use-theme';
import { formatCurrency } from '@/lib/format';

type WatchlistRowProps = {
  symbol: string;
  name?: string | null;
  quote: Quote | null;
  sparkline?: number[];
  isLoadingQuote: boolean;
  isStale?: boolean;
  showSeparator?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

export function WatchlistRow({
  symbol,
  name,
  quote,
  sparkline,
  isLoadingQuote,
  isStale = false,
  showSeparator = true,
  onPress,
  onLongPress,
}: WatchlistRowProps) {
  const theme = useTheme();
  const trendColor = useDirectionColor(quote?.changePercent);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${symbol}${quote?.price ? `, ${formatCurrency(quote.price)}` : ''}`}
      style={({ pressed }) => [
        styles.row,
        showSeparator && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      <View style={styles.identity}>
        <ThemedText type="bodyBold">{symbol}</ThemedText>
        {name ? (
          <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>
            {name}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.chart}>
        {sparkline && sparkline.length > 1 ? (
          <Sparkline values={sparkline} color={trendColor} />
        ) : null}
      </View>

      <View style={styles.values}>
        {isLoadingQuote && !quote ? (
          <>
            <Skeleton width={72} height={18} />
            <Skeleton width={52} height={20} />
          </>
        ) : quote ? (
          <>
            <View style={styles.priceLine}>
              {isStale ? (
                <Ionicons name="cloud-offline-outline" size={12} color={theme.textMuted} />
              ) : null}
              <ThemedText type="bodyBold">{formatCurrency(quote.price)}</ThemedText>
            </View>
            <ChangePill change={quote.change} changePercent={quote.changePercent} />
          </>
        ) : (
          <ThemedText type="caption" themeColor="textMuted">
            No data
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  identity: {
    flex: 1,
    gap: 1,
  },
  chart: {
    width: 64,
    alignItems: 'center',
  },
  values: {
    alignItems: 'flex-end',
    gap: 4,
    minWidth: 88,
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
