/**
 * Client-side session awareness, used for the market-status pill and to slow
 * polling down when nothing can move.
 *
 * The Edge Functions have their own copy of this logic: the two runtimes cannot
 * share modules (Deno versus Metro), and duplicating ~30 lines is preferable to a
 * shared package for a project this size.
 */

const EASTERN_TIME_ZONE = 'America/New_York';
const OPEN_MINUTES = 9 * 60 + 30;
const CLOSE_MINUTES = 16 * 60;

function easternParts(date: Date): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '0';

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return {
    weekday: weekdays.indexOf(read('weekday')),
    minutes: (Number(read('hour')) % 24) * 60 + Number(read('minute')),
  };
}

export type MarketStatus = 'open' | 'pre-market' | 'after-hours' | 'closed';

export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const { weekday, minutes } = easternParts(now);
  if (weekday === 0 || weekday === 6) return 'closed';
  if (minutes >= OPEN_MINUTES && minutes < CLOSE_MINUTES) return 'open';
  if (minutes >= 4 * 60 && minutes < OPEN_MINUTES) return 'pre-market';
  if (minutes >= CLOSE_MINUTES && minutes < 20 * 60) return 'after-hours';
  return 'closed';
}

export const MARKET_STATUS_LABELS: Record<MarketStatus, string> = {
  open: 'Market open',
  'pre-market': 'Pre-market',
  'after-hours': 'After hours',
  closed: 'Market closed',
};
