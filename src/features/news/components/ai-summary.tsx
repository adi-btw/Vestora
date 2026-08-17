import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { SentimentBadge } from '@/features/news/components/sentiment-badge';
import type { NewsSummary } from '@/features/news/schemas';
import { useTheme } from '@/hooks/use-theme';

/**
 * The AI block is visually separated from the article list so it is always obvious
 * which text was written by a model rather than a publisher.
 */
export function AiSummary({ summary }: { summary: NewsSummary }) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.accentSoft }]}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={14} color={theme.accent} />
        <ThemedText type="captionBold" themeColor="accent" style={styles.label}>
          AI summary
        </ThemedText>
        <SentimentBadge sentiment={summary.sentiment} />
      </View>

      <ThemedText type="small">{summary.summary}</ThemedText>

      {summary.keyDrivers.length > 0 ? (
        <View style={styles.drivers}>
          {summary.keyDrivers.map((driver) => (
            <View key={driver} style={[styles.driver, { backgroundColor: theme.surface }]}>
              <ThemedText type="caption" themeColor="textSecondary">
                {driver}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      <ThemedText type="caption" themeColor="textMuted">
        Generated from {summary.articleCount} headline{summary.articleCount === 1 ? '' : 's'}. Not
        investment advice.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.md,
    padding: Spacing.three - 4,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  label: {
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  drivers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  driver: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
});
