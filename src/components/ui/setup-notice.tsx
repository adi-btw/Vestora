import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { missingEnvKeys } from '@/lib/env';

/**
 * Shown instead of the app when Supabase credentials are absent, so a fresh
 * clone explains itself rather than crashing on the first query.
 */
export function SetupNotice() {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Card style={styles.card}>
        <Ionicons name="construct-outline" size={28} color={theme.accent} />
        <ThemedText type="title">Finish the setup</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Copy <ThemedText type="mono">.env.example</ThemedText> to{' '}
          <ThemedText type="mono">.env</ThemedText> and add your Supabase project URL and anon key,
          then restart the dev server with <ThemedText type="mono">npx expo start -c</ThemedText>.
        </ThemedText>
        <View style={styles.list}>
          {missingEnvKeys.map((key) => (
            <View key={key} style={styles.listItem}>
              <Ionicons name="close-circle" size={14} color={theme.down} />
              <ThemedText type="mono">{key}</ThemedText>
            </View>
          ))}
        </View>
        <ThemedText type="caption" themeColor="textMuted">
          Full walkthrough in README.md
        </ThemedText>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    gap: Spacing.two,
    maxWidth: 460,
  },
  list: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
