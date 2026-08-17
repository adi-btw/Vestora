import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorView } from '@/components/ui/error-view';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { SkeletonList } from '@/components/ui/skeleton';
import { Radius, Spacing } from '@/constants/theme';
import { AlertRow } from '@/features/alerts/components/alert-row';
import {
  useAlertEvents,
  useAlerts,
  useClearAlertEvents,
  useDeleteAlert,
  useToggleAlert,
} from '@/features/alerts/hooks';
import { usePushRegistration, type PushStatus } from '@/features/alerts/use-push-registration';
import { useTheme } from '@/hooks/use-theme';
import { formatRelativeTime } from '@/lib/format';

const PUSH_COPY: Record<PushStatus, { message: string; action: string | null } | null> = {
  idle: {
    message: 'Turn on notifications to get alerts while the app is closed.',
    action: 'Enable',
  },
  registering: { message: 'Setting up notifications...', action: null },
  granted: null,
  denied: {
    message: 'Notifications are blocked. Enable them for Stock Watch in your system settings.',
    action: null,
  },
  'needs-dev-build': {
    message:
      'Push notifications need a development build - Expo Go cannot receive them. Alerts still appear here when they fire.',
    action: null,
  },
  unsupported: {
    message: 'This device cannot receive push notifications. Triggered alerts still show up here.',
    action: null,
  },
  error: {
    message: 'Notification setup did not finish. Alerts still appear in this list.',
    action: 'Try again',
  },
};

export default function AlertsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const alerts = useAlerts();
  const events = useAlertEvents();
  const toggleAlert = useToggleAlert();
  const deleteAlert = useDeleteAlert();
  const clearEvents = useClearAlertEvents();
  const push = usePushRegistration();

  const pushCopy = PUSH_COPY[push.status];

  return (
    <Screen
      scroll
      onRefresh={() => {
        void alerts.refetch();
        void events.refetch();
      }}
      refreshing={alerts.isFetching || events.isFetching}
      contentStyle={styles.content}>
      <View style={styles.header}>
        <ThemedText type="title">Alerts</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Checked every 15 minutes while US markets are open.
        </ThemedText>
      </View>

      {pushCopy ? (
        <View style={[styles.banner, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="notifications-outline" size={18} color={theme.accent} />
          <ThemedText type="caption" themeColor="textSecondary" style={styles.bannerText}>
            {pushCopy.message}
          </ThemedText>
          {pushCopy.action ? (
            <Button
              label={pushCopy.action}
              onPress={() => void push.register()}
              size="sm"
              variant="secondary"
            />
          ) : null}
        </View>
      ) : null}

      <Card>
        <SectionHeader
          title="Your alerts"
          subtitle={alerts.data?.length ? `${alerts.data.length} configured` : undefined}
        />

        {alerts.isError ? (
          <ErrorView error={alerts.error} onRetry={alerts.refetch} compact />
        ) : alerts.isLoading ? (
          <SkeletonList count={3} />
        ) : (alerts.data ?? []).length === 0 ? (
          <EmptyState
            icon="notifications-off-outline"
            title="No alerts yet"
            description="Open a stock and set a price target or news keyword to watch for."
            actionLabel="Find a symbol"
            onAction={() => router.push('/search')}
          />
        ) : (
          <View>
            {(alerts.data ?? []).map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                onToggle={toggleAlert.mutate}
                onDelete={deleteAlert.mutate}
              />
            ))}
          </View>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Recent triggers"
          actionLabel={(events.data ?? []).length > 0 ? 'Clear' : undefined}
          onAction={(events.data ?? []).length > 0 ? () => clearEvents.mutate() : undefined}
        />

        {events.isError ? (
          <ErrorView error={events.error} onRetry={events.refetch} compact />
        ) : events.isLoading ? (
          <SkeletonList count={2} />
        ) : (events.data ?? []).length === 0 ? (
          <ThemedText type="small" themeColor="textMuted">
            Nothing has fired yet.
          </ThemedText>
        ) : (
          <View>
            {(events.data ?? []).map((event) => (
              <View key={event.id} style={[styles.event, { borderBottomColor: theme.border }]}>
                <ThemedText type="small">{event.message}</ThemedText>
                <ThemedText type="caption" themeColor="textMuted">
                  {formatRelativeTime(event.created_at)}
                  {event.delivered ? '' : ' - not pushed to a device'}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
  },
  header: {
    gap: 2,
    paddingTop: Spacing.two,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three - 4,
    borderRadius: Radius.md,
  },
  bannerText: {
    flex: 1,
  },
  event: {
    gap: 2,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
