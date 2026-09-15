import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Spacing } from '@/constants/theme';
import type { OrderRow as OrderRecord } from '@/lib/database.types';
import { formatCurrency, formatQuantity, formatRelativeTime } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

const STATUS_TONE: Record<OrderRecord['status'], BadgeTone> = {
  filled: 'up',
  pending: 'warning',
  rejected: 'down',
  canceled: 'neutral',
};

type OrderRowProps = {
  order: OrderRecord;
  onCancel: (orderId: string) => void;
  isCanceling: boolean;
};

export function OrderRow({ order, onCancel, isCanceling }: OrderRowProps) {
  const theme = useTheme();

  const price = order.filled_price ?? order.limit_price;
  const priceLabel = order.filled_price
    ? `filled at ${formatCurrency(Number(order.filled_price))}`
    : order.limit_price
      ? `limit ${formatCurrency(Number(order.limit_price))}`
      : 'market';

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.main}>
        <ThemedText type="smallBold">
          {order.side === 'buy' ? 'Bought' : 'Sold'} {formatQuantity(Number(order.quantity))}{' '}
          {order.symbol}
        </ThemedText>
        <ThemedText type="caption" themeColor="textMuted">
          {priceLabel}
          {price ? ` - ${formatRelativeTime(order.filled_at ?? order.created_at)}` : ''}
        </ThemedText>
        {order.reject_reason ? (
          <ThemedText type="caption" color={theme.down}>
            {order.reject_reason}
          </ThemedText>
        ) : null}
      </View>

      {order.status === 'pending' ? (
        <Pressable
          onPress={() => onCancel(order.id)}
          disabled={isCanceling}
          accessibilityRole="button"
          accessibilityLabel={`Cancel ${order.symbol} order`}
          hitSlop={6}>
          <ThemedText type="captionBold" themeColor="accent">
            Cancel
          </ThemedText>
        </Pressable>
      ) : (
        <Badge label={order.status} tone={STATUS_TONE[order.status]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.three - 2,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  main: {
    flex: 1,
    gap: 1,
  },
});
