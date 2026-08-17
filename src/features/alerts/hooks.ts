import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as api from '@/features/alerts/api';
import type { NewAlert } from '@/features/alerts/schemas';
import { useAuth } from '@/features/auth/auth-provider';
import type { AlertRow } from '@/lib/database.types';
import { queryKeys } from '@/lib/query-keys';

export function useAlerts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.alerts.list(),
    queryFn: api.fetchAlerts,
    enabled: Boolean(user),
    staleTime: 60_000,
  });
}

export function useAlertEvents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.alerts.events(),
    queryFn: api.fetchAlertEvents,
    enabled: Boolean(user),
    // The scanner runs every 15 minutes, so anything fresher is wasted work.
    staleTime: 5 * 60_000,
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (alert: NewAlert) => {
      if (!user) throw new Error('Sign in to create alerts.');
      return api.createAlert(user.id, alert);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.list() });
    },
  });
}

export function useToggleAlert() {
  const queryClient = useQueryClient();
  const key = queryKeys.alerts.list();

  return useMutation({
    mutationFn: ({ alertId, isActive }: { alertId: string; isActive: boolean }) =>
      api.setAlertActive(alertId, isActive),
    // The switch has to move under the finger, not after a round-trip.
    onMutate: async ({ alertId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AlertRow[]>(key);

      queryClient.setQueryData<AlertRow[]>(key, (current) =>
        (current ?? []).map((alert) =>
          alert.id === alertId ? { ...alert, is_active: isActive } : alert,
        ),
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();
  const key = queryKeys.alerts.list();

  return useMutation({
    mutationFn: api.deleteAlert,
    onMutate: async (alertId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AlertRow[]>(key);

      queryClient.setQueryData<AlertRow[]>(key, (current) =>
        (current ?? []).filter((alert) => alert.id !== alertId),
      );

      return { previous };
    },
    onError: (_error, _alertId, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useClearAlertEvents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.clearAlertEvents,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.events() });
    },
  });
}
