import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Stat = {
  label: string;
  value: string;
  /** Optional emphasis color, for example a gain or loss. */
  color?: string;
};

/** Label-left, value-right rows used for fundamentals and position details. */
export function StatGrid({ stats }: { stats: Stat[] }) {
  const theme = useTheme();

  return (
    <View>
      {stats.map((stat, index) => (
        <View
          key={stat.label}
          style={[
            styles.row,
            index < stats.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.border,
            },
          ]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
            {stat.label}
          </ThemedText>
          <ThemedText type="smallBold" color={stat.color} numberOfLines={1}>
            {stat.value}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 44,
    paddingVertical: Spacing.two + 2,
  },
  label: {
    flexShrink: 1,
  },
});
