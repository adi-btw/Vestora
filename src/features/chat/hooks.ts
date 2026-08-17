import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import * as api from '@/features/chat/api';
import type { ChatMessage, PendingAction } from '@/features/chat/schemas';
import { queryKeys } from '@/lib/query-keys';

export function useThreads() {
  return useQuery({
    queryKey: queryKeys.chat.threads(),
    queryFn: api.fetchThreads,
    staleTime: 60_000,
  });
}

export function useMessages(threadId: string | null) {
  return useQuery({
    queryKey: queryKeys.chat.messages(threadId ?? 'new'),
    queryFn: () => api.fetchMessages(threadId!),
    enabled: Boolean(threadId),
    staleTime: Infinity,
  });
}

/**
 * Owns one conversation: the active thread id, the optimistic user bubble, and
 * any write action waiting on approval.
 */
export function useChat() {
  const queryClient = useQueryClient();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draftEcho, setDraftEcho] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const messagesQuery = useMessages(threadId);

  const applyResponse = useCallback(
    (response: Awaited<ReturnType<typeof api.sendChatTurn>>) => {
      setThreadId(response.threadId);
      setPendingAction(response.pendingAction);
      setDraftEcho(null);

      const key = queryKeys.chat.messages(response.threadId);
      queryClient.setQueryData<ChatMessage[]>(key, (current) => {
        const existing = current ?? [];
        const seen = new Set(existing.map((message) => message.id));
        return [...existing, ...response.messages.filter((message) => !seen.has(message.id))];
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads() });
    },
    [queryClient],
  );

  const turn = useMutation({
    mutationFn: (params: { message?: string; confirm?: PendingAction }) =>
      api.sendChatTurn({
        threadId: threadId ?? undefined,
        message: params.message,
        confirm: params.confirm
          ? { name: params.confirm.name, args: params.confirm.args }
          : undefined,
      }),
    onSuccess: applyResponse,
    onError: () => setDraftEcho(null),
  });

  const send = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || turn.isPending) return;

      setDraftEcho(trimmed);
      setPendingAction(null);
      turn.mutate({ message: trimmed });
    },
    [turn],
  );

  const confirm = useCallback(() => {
    if (!pendingAction || turn.isPending) return;
    // A confirmed action invalidates whatever it touched; the watchlist is the
    // only writable surface today.
    turn.mutate(
      { confirm: pendingAction },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.watchlist.all });
        },
      },
    );
  }, [pendingAction, turn, queryClient]);

  const dismissAction = useCallback(() => setPendingAction(null), []);

  const startNewThread = useCallback(() => {
    setThreadId(null);
    setDraftEcho(null);
    setPendingAction(null);
  }, []);

  const openThread = useCallback((id: string) => {
    setThreadId(id);
    setDraftEcho(null);
    setPendingAction(null);
  }, []);

  return {
    threadId,
    messages: messagesQuery.data ?? [],
    isLoadingHistory: messagesQuery.isLoading,
    draftEcho,
    pendingAction,
    isSending: turn.isPending,
    error: turn.error,
    send,
    confirm,
    dismissAction,
    startNewThread,
    openThread,
  };
}

export function useDeleteThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteThread,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
    },
  });
}
