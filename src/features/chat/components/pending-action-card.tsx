import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import type { PendingAction } from '@/features/chat/schemas';
import { useTheme } from '@/hooks/use-theme';

type PendingActionCardProps = {
  action: PendingAction;
  isPending: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
};

/**
 * The model can propose changes but never applies them. Anything that writes to
 * the account stops here until the user taps through.
 */
export function PendingActionCard({
  action,
  isPending,
  onConfirm,
  onDismiss,
}: PendingActionCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
      <View style={styles.header}>
        <Ionicons name="hand-left-outline" size={14} color={theme.warning} />
        <ThemedText type="captionBold" color={theme.warning}>
          NEEDS YOUR OK
        </ThemedText>
      </View>

      <ThemedText type="smallBold">{action.prompt}</ThemedText>

      <View style={styles.actions}>
        <Button label="Confirm" onPress={onConfirm} loading={isPending} size="sm" />
        <Button
          label="Not now"
          onPress={onDismiss}
          variant="ghost"
          size="sm"
          disabled={isPending}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three - 4,
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
