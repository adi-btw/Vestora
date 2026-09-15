import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { describeAlert } from '@/features/alerts/schemas';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/confirm';
import type { AlertRow as AlertRecord } from '@/lib/database.types';
import { formatRelativeTime } from '@/lib/format';

type AlertRowProps = {
  alert: AlertRecord;
  onToggle: (params: { alertId: string; isActive: boolean }) => void;
  onDelete: (alertId: string) => void;
};

export function AlertRow({ alert, onToggle, onDelete }: AlertRowProps) {
  const theme = useTheme();
  const router = useRouter();

  async function remove() {
    const confirmed = await confirmAction({
      title: `Delete ${alert.symbol} alert?`,
      message: describeAlert(alert),
      confirmLabel: 'Delete',
      destructive: true,
    });

    if (confirmed) onDelete(alert.id);
  }

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <Pressable
        onPress={() => router.push(`/symbol/${alert.symbol}`)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${alert.symbol}`}
        style={styles.main}>
        <ThemedText type="smallBold">{alert.symbol}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {describeAlert(alert)}
        </ThemedText>
        <ThemedText type="caption" themeColor="textMuted">
          {alert.last_triggered_at
            ? `Last fired ${formatRelativeTime(alert.last_triggered_at)}`
            : 'Not fired yet'}
        </ThemedText>
      </Pressable>

      <Switch
        value={alert.is_active}
        onValueChange={(isActive) => onToggle({ alertId: alert.id, isActive })}
        accessibilityLabel={`${alert.is_active ? 'Disable' : 'Enable'} ${alert.symbol} alert`}
        trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
        thumbColor={theme.accentText}
      />

      <Pressable
        onPress={remove}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${alert.symbol} alert`}
        hitSlop={8}>
        <Ionicons name="trash-outline" size={17} color={theme.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  main: {
    flex: 1,
    gap: 1,
  },
});
