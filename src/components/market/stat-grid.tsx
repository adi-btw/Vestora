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

/** Two-column key/value grid used for fundamentals and position details. */
export function StatGrid({ stats }: { stats: Stat[] }) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {stats.map((stat) => (
        <View key={stat.label} style={[styles.cell, { borderBottomColor: theme.border }]}>
          <ThemedText type="caption" themeColor="textSecondary">
            {stat.label}
          </ThemedText>
          <ThemedText type="smallBold" color={stat.color}>
            {stat.value}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
    gap: 2,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
