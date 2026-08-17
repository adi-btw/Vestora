import { StyleSheet, View } from 'react-native';

import { ThemedText, type ThemedTextType } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { directionOf, formatSignedCurrency, formatSignedPercent } from '@/lib/format';

type PriceChangeProps = {
  change: number | null | undefined;
  changePercent: number | null | undefined;
  /** Hide the absolute dollar move when space is tight (list rows). */
  showAbsolute?: boolean;
  type?: ThemedTextType;
};

export function useDirectionColor(value: number | null | undefined): string {
  const theme = useTheme();
  const direction = directionOf(value);
  if (direction === 'up') return theme.up;
  if (direction === 'down') return theme.down;
  return theme.textSecondary;
}

export function PriceChange({
  change,
  changePercent,
  showAbsolute = true,
  type = 'small',
}: PriceChangeProps) {
  const color = useDirectionColor(changePercent ?? change);

  return (
    <View style={styles.row}>
      {showAbsolute ? (
        <ThemedText type={type} color={color}>
          {formatSignedCurrency(change)}
        </ThemedText>
      ) : null}
      <ThemedText type={type} color={color}>
        {formatSignedPercent(changePercent)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
});
