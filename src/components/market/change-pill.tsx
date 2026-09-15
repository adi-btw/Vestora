import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { directionOf, formatSignedCurrency, formatSignedPercent } from '@/lib/format';

type ChangePillProps = {
  change: number | null | undefined;
  changePercent: number | null | undefined;
  /** Include the dollar move next to the percent, as on a quote header. */
  showAbsolute?: boolean;
};

/**
 * Apple Stocks-style capsule for a day's move. Saturated fill, white type;
 * gray when the change is flat or missing.
 */
export function ChangePill({ change, changePercent, showAbsolute = false }: ChangePillProps) {
  const theme = useTheme();
  const direction = directionOf(changePercent ?? change);
  const background =
    direction === 'up' ? theme.up : direction === 'down' ? theme.down : theme.neutral;
  const label = showAbsolute
    ? `${formatSignedCurrency(change)} (${formatSignedPercent(changePercent)})`
    : formatSignedPercent(changePercent);

  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      <ThemedText type="captionBold" color={theme.accentText} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
});
