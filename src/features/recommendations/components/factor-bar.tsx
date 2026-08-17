import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { ScoreFactor } from '@/features/recommendations/schemas';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shows the factor behind a score rather than just the number, so the ranking is
 * inspectable instead of a black box.
 */
export function FactorBar({ factor }: { factor: ScoreFactor }) {
  const theme = useTheme();
  const percent = Math.round(Math.min(Math.max(factor.value, 0), 1) * 100);
  const tone = percent >= 66 ? theme.up : percent >= 33 ? theme.warning : theme.down;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
          {factor.label}
        </ThemedText>
        <ThemedText type="caption" themeColor="textMuted">
          {percent}
        </ThemedText>
      </View>

      <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: tone }]} />
      </View>

      <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>
        {factor.detail}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 3,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  label: {
    flex: 1,
  },
  track: {
    height: 5,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
});
