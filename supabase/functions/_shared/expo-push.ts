import type { SupabaseClient } from './deps.ts';
import { fetchJson } from './fetch-json.ts';

/**
 * Expo's push service. No credentials are needed for Expo push tokens, which is
 * what makes notifications workable on a zero-cost stack.
 */

const PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type PushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

export type PushResult = { sent: number; failed: number; removedTokens: string[] };

export async function sendPushNotifications(
  admin: SupabaseClient,
  messages: PushMessage[],
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, removedTokens: [] };
  if (messages.length === 0) return result;

  for (let index = 0; index < messages.length; index += BATCH_SIZE) {
    const batch = messages.slice(index, index + BATCH_SIZE);

    try {
      const response = await fetchJson<{ data: PushTicket[] }>(PUSH_ENDPOINT, {
        provider: 'expo-push',
        method: 'POST',
        body: batch,
        headers: { 'Content-Type': 'application/json' },
        retries: 1,
        timeoutMs: 15_000,
      });

      response.data.forEach((ticket, ticketIndex) => {
        if (ticket.status === 'ok') {
          result.sent += 1;
          return;
        }

        result.failed += 1;
        // A token for an uninstalled app never recovers, so stop storing it.
        if (ticket.details?.error === 'DeviceNotRegistered') {
          const token = batch[ticketIndex]?.to;
          if (token) result.removedTokens.push(token);
        }
      });
    } catch (error) {
      console.error('Push batch failed', error);
      result.failed += batch.length;
    }
  }

  if (result.removedTokens.length > 0) {
    const { error } = await admin.from('push_tokens').delete().in('token', result.removedTokens);
    if (error) console.error('Pruning dead push tokens failed', error);
  }

  return result;
}
