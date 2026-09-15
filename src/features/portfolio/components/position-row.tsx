import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChangePill } from '@/components/market/change-pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Position } from '@/features/portfolio/schemas';
import { useTheme } from '@/hooks/use-theme';
import { formatCurrency, formatQuantity } from '@/lib/format';

export function PositionRow({ position }: { position: Position }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/symbol/${position.symbol}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${position.symbol}`}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.border },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <View style={styles.left}>
        <ThemedText type="smallBold">{position.symbol}</ThemedText>
        <ThemedText type="caption" themeColor="textMuted">
          {formatQuantity(position.quantity)} @ {formatCurrency(position.avgCost)}
        </ThemedText>
      </View>

      <View style={styles.right}>
        <ThemedText type="smallBold">{formatCurrency(position.marketValue)}</ThemedText>
        <ChangePill change={position.unrealizedPnl} changePercent={position.unrealizedPercent} />
      </View>
    </Pressable>
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
  left: {
    gap: 1,
  },
  right: {
    alignItems: 'flex-end',
    gap: 1,
  },
});
