import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const DISCLAIMER_TEXT =
  'For educational purposes only. Not financial advice. Data may be delayed and AI output can be wrong - verify before acting.';

/**
 * Rendered on every AI-generated and recommendation surface. Deliberately not
 * dismissible.
 */
export function Disclaimer({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.warningSoft }, compact && styles.compact]}>
      <Ionicons name="information-circle-outline" size={16} color={theme.warning} />
      <ThemedText type="caption" color={theme.warning} style={styles.text}>
        {DISCLAIMER_TEXT}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
    padding: Spacing.two + 2,
    borderRadius: Radius.md,
  },
  compact: {
    padding: Spacing.two,
  },
  text: {
    flex: 1,
  },
});
