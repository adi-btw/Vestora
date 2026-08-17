import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api-error';

type ErrorViewProps = {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
};

/** Turns an unknown thrown value into something a user can act on. */
export function describeError(error: unknown): { title: string; detail: string } {
  if (error instanceof ApiError) {
    if (error.isRateLimited) {
      return {
        title: 'Hitting the data limit',
        detail: 'The free market data quota is saturated. Prices will refresh in a moment.',
      };
    }
    if (error.isQuotaExhausted) {
      return {
        title: 'Daily AI limit reached',
        detail: 'The free Gemini quota resets at midnight Pacific. Everything else still works.',
      };
    }
    return { title: 'Request failed', detail: error.message };
  }
  if (error instanceof Error) {
    return { title: 'Something went wrong', detail: error.message };
  }
  return { title: 'Something went wrong', detail: 'Unexpected error.' };
}

export function ErrorView({ error, onRetry, compact = false }: ErrorViewProps) {
  const theme = useTheme();
  const { title, detail } = describeError(error);

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <Ionicons name="alert-circle-outline" size={compact ? 20 : 28} color={theme.down} />
      <ThemedText type={compact ? 'smallBold' : 'subtitle'} style={styles.centered}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {detail}
      </ThemedText>
      {onRetry ? (
        <Button label="Try again" onPress={onRetry} variant="secondary" size="sm" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  compact: {
    paddingVertical: Spacing.three,
  },
  centered: {
    textAlign: 'center',
  },
});
