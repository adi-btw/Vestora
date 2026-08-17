// Alert scanner, invoked on a schedule by GitHub Actions.
//
// Runs with the service role (no user JWT) because it evaluates every user's
// alerts in one pass: quotes are fetched once per symbol and shared across all
// alerts on it, which is what keeps a multi-user scan inside the free quota.
// Hitting this endpoint also counts as database activity, so the same cron keeps
// the Supabase project from pausing for inactivity.

import { createServiceClient } from '../_shared/clients.ts';
import type { SupabaseClient } from '../_shared/deps.ts';
import { requireEnv } from '../_shared/env.ts';
import { sendPushNotifications, type PushMessage } from '../_shared/expo-push.ts';
import { HttpError, jsonResponse, serveJson } from '../_shared/http.ts';
import { getNews, getQuotes } from '../_shared/market-service.ts';
import type { Quote } from '../_shared/market-types.ts';

const MAX_SYMBOLS_PER_SCAN = 40;

type AlertKind = 'price_above' | 'price_below' | 'percent_move' | 'news_keyword';

type AlertRow = {
  id: string;
  user_id: string;
  symbol: string;
  kind: AlertKind;
  threshold: number | null;
  keyword: string | null;
  cooldown_minutes: number;
  last_triggered_at: string | null;
};

type Trigger = {
  alert: AlertRow;
  message: string;
  price: number | null;
};

/**
 * The scanner has no user JWT to check, so the caller proves itself with a shared
 * secret. Without this the endpoint would be an open trigger for anyone.
 */
function authorize(request: Request): void {
  const expected = requireEnv('CRON_SECRET');
  const provided =
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    '';

  if (provided !== expected) {
    throw new HttpError(401, 'unauthorized', 'Invalid cron secret.');
  }
}

function isInCooldown(alert: AlertRow, now: Date): boolean {
  if (!alert.last_triggered_at) return false;
  const elapsedMinutes = (now.getTime() - new Date(alert.last_triggered_at).getTime()) / 60_000;
  return elapsedMinutes < alert.cooldown_minutes;
}

function evaluatePriceAlert(alert: AlertRow, quote: Quote | undefined): Trigger | null {
  if (!quote?.price || alert.threshold == null) return null;
  const price = quote.price;

  switch (alert.kind) {
    case 'price_above':
      return price >= alert.threshold
        ? {
            alert,
            price,
            message: `${alert.symbol} is at $${price.toFixed(2)}, above your $${alert.threshold.toFixed(2)} target.`,
          }
        : null;

    case 'price_below':
      return price <= alert.threshold
        ? {
            alert,
            price,
            message: `${alert.symbol} is at $${price.toFixed(2)}, below your $${alert.threshold.toFixed(2)} target.`,
          }
        : null;

    case 'percent_move': {
      const move = quote.changePercent;
      if (move == null || Math.abs(move) < alert.threshold) return null;
      return {
        alert,
        price,
        message: `${alert.symbol} moved ${move > 0 ? '+' : ''}${move.toFixed(2)}% today to $${price.toFixed(2)}.`,
      };
    }

    default:
      return null;
  }
}

async function evaluateNewsAlerts(
  admin: SupabaseClient,
  alerts: AlertRow[],
  now: Date,
): Promise<Trigger[]> {
  if (alerts.length === 0) return [];

  const symbols = [...new Set(alerts.map((alert) => alert.symbol))].slice(0, 10);
  const articles = await getNews(admin, symbols, 20);
  const triggers: Trigger[] = [];

  for (const alert of alerts) {
    const keyword = alert.keyword?.trim().toLowerCase();
    if (!keyword) continue;

    // Only headlines published since the last notification count, otherwise the
    // same article would re-trigger after every cooldown.
    const since = alert.last_triggered_at ? new Date(alert.last_triggered_at) : null;
    const match = articles.find(
      (article) =>
        article.symbol === alert.symbol &&
        article.headline.toLowerCase().includes(keyword) &&
        (!since || new Date(article.publishedAt) > since),
    );

    if (match) {
      triggers.push({
        alert,
        price: null,
        message: `${alert.symbol}: ${match.headline.slice(0, 140)}`,
      });
    }
  }

  return triggers.filter((trigger) => !isInCooldown(trigger.alert, now));
}

async function loadPushTokens(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string[]>> {
  const byUser = new Map<string, string[]>();
  if (userIds.length === 0) return byUser;

  const { data, error } = await admin
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', userIds);

  if (error) {
    console.error('Push token read failed', error);
    return byUser;
  }

  for (const row of (data ?? []) as { user_id: string; token: string }[]) {
    const tokens = byUser.get(row.user_id) ?? [];
    tokens.push(row.token);
    byUser.set(row.user_id, tokens);
  }

  return byUser;
}

Deno.serve(
  serveJson(async (request) => {
    authorize(request);

    const admin = createServiceClient();
    const now = new Date();

    const { data, error } = await admin
      .from('alerts')
      .select('id, user_id, symbol, kind, threshold, keyword, cooldown_minutes, last_triggered_at')
      .eq('is_active', true);

    if (error) throw new HttpError(500, 'alerts_read_failed', error.message);

    const alerts = (data ?? []) as AlertRow[];
    const ready = alerts.filter((alert) => !isInCooldown(alert, now));

    if (ready.length === 0) {
      return jsonResponse({ scanned: alerts.length, triggered: 0, sent: 0, awake: true });
    }

    const priceAlerts = ready.filter((alert) => alert.kind !== 'news_keyword');
    const newsAlerts = ready.filter((alert) => alert.kind === 'news_keyword');

    const symbols = [...new Set(priceAlerts.map((alert) => alert.symbol))].slice(
      0,
      MAX_SYMBOLS_PER_SCAN,
    );

    const { quotes } = symbols.length > 0 ? await getQuotes(admin, symbols) : { quotes: [] };
    const quoteBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));

    const triggers = priceAlerts
      .map((alert) => evaluatePriceAlert(alert, quoteBySymbol.get(alert.symbol)))
      .filter((trigger): trigger is Trigger => trigger !== null);

    try {
      triggers.push(...(await evaluateNewsAlerts(admin, newsAlerts, now)));
    } catch (newsError) {
      // A news provider hiccup should not sink the price half of the scan.
      console.error('News alert evaluation failed', newsError);
    }

    if (triggers.length === 0) {
      return jsonResponse({ scanned: alerts.length, triggered: 0, sent: 0, awake: true });
    }

    const { error: eventError } = await admin.from('alert_events').insert(
      triggers.map((trigger) => ({
        alert_id: trigger.alert.id,
        user_id: trigger.alert.user_id,
        symbol: trigger.alert.symbol,
        message: trigger.message,
        triggered_price: trigger.price,
        delivered: false,
      })),
    );

    if (eventError) throw new HttpError(500, 'event_write_failed', eventError.message);

    const tokensByUser = await loadPushTokens(admin, [
      ...new Set(triggers.map((trigger) => trigger.alert.user_id)),
    ]);

    const messages: PushMessage[] = triggers.flatMap((trigger) =>
      (tokensByUser.get(trigger.alert.user_id) ?? []).map((token) => ({
        to: token,
        title: `${trigger.alert.symbol} alert`,
        body: trigger.message,
        data: { symbol: trigger.alert.symbol, alertId: trigger.alert.id },
      })),
    );

    const push = await sendPushNotifications(admin, messages);

    // Cooldown starts when the alert fires, whether or not a device was reachable.
    const { error: touchError } = await admin
      .from('alerts')
      .update({ last_triggered_at: now.toISOString() })
      .in(
        'id',
        triggers.map((trigger) => trigger.alert.id),
      );

    if (touchError) console.error('Updating alert cooldowns failed', touchError);

    if (push.sent > 0) {
      const { error: deliveredError } = await admin
        .from('alert_events')
        .update({ delivered: true })
        .in(
          'alert_id',
          triggers.map((trigger) => trigger.alert.id),
        )
        .eq('delivered', false);

      if (deliveredError) console.error('Marking events delivered failed', deliveredError);
    }

    console.log('Alert scan complete', {
      scanned: alerts.length,
      triggered: triggers.length,
      pushSent: push.sent,
      pushFailed: push.failed,
      tokensPruned: push.removedTokens.length,
    });

    return jsonResponse({
      scanned: alerts.length,
      triggered: triggers.length,
      sent: push.sent,
      awake: true,
    });
  }),
);
