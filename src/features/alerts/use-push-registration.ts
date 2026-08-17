import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import * as api from '@/features/alerts/api';
import { useAuth } from '@/features/auth/auth-provider';

export type PushStatus =
  | 'idle'
  | 'registering'
  | 'granted'
  | 'denied'
  /** Remote push needs a development or production build, not Expo Go. */
  | 'needs-dev-build'
  | 'unsupported'
  | 'error';

/** Foreground behaviour: alerts are time-sensitive, so show them immediately. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function projectId(): string | undefined {
  const config = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return config?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

/**
 * Registers this device for alert pushes.
 *
 * Expo Go dropped remote push in SDK 53, and the web build has no push service on
 * a free stack, so both are reported back as explicit states rather than silent
 * failures - the alerts screen tells the user what they would need.
 */
export function usePushRegistration() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>('idle');

  const register = useCallback(async (): Promise<PushStatus> => {
    if (Platform.OS === 'web' || !Device.isDevice) {
      setStatus('unsupported');
      return 'unsupported';
    }
    if (Constants.executionEnvironment === 'storeClient') {
      setStatus('needs-dev-build');
      return 'needs-dev-build';
    }

    setStatus('registering');

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('alerts', {
          name: 'Price alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      const existing = await Notifications.getPermissionsAsync();
      const permission = existing.granted
        ? existing
        : await Notifications.requestPermissionsAsync();

      if (!permission.granted) {
        setStatus('denied');
        return 'denied';
      }

      const token = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
      await api.registerPushToken(
        token.data,
        Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
      );

      setStatus('granted');
      return 'granted';
    } catch (error) {
      console.warn('Push registration failed', error);
      setStatus('error');
      return 'error';
    }
  }, []);

  // Tokens rotate, so re-register once per session for an already-granted device.
  useEffect(() => {
    if (!user || Platform.OS === 'web' || !Device.isDevice) return;
    if (Constants.executionEnvironment === 'storeClient') return;

    let cancelled = false;

    void (async () => {
      const permission = await Notifications.getPermissionsAsync();
      if (cancelled || !permission.granted) return;
      await register();
    })();

    return () => {
      cancelled = true;
    };
  }, [user, register]);

  return { status, register };
}
