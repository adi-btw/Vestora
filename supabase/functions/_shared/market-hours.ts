/**
 * Regular US session awareness. Holidays are not modelled - the only cost of
 * being wrong on Thanksgiving is a slightly shorter cache TTL, so a lookup table
 * that goes stale every year is not worth maintaining.
 */

const EASTERN_TIME_ZONE = 'America/New_York';

type EasternParts = { weekday: number; minutesSinceMidnight: number };

function easternParts(date: Date): EasternParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '0';

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = weekdays.indexOf(lookup('weekday'));
  // `hour12: false` can render midnight as "24".
  const hour = Number(lookup('hour')) % 24;
  const minute = Number(lookup('minute'));

  return { weekday, minutesSinceMidnight: hour * 60 + minute };
}

const MARKET_OPEN_MINUTES = 9 * 60 + 30;
const MARKET_CLOSE_MINUTES = 16 * 60;

export function isMarketOpen(now: Date = new Date()): boolean {
  const { weekday, minutesSinceMidnight } = easternParts(now);
  if (weekday === 0 || weekday === 6) return false;
  return minutesSinceMidnight >= MARKET_OPEN_MINUTES && minutesSinceMidnight < MARKET_CLOSE_MINUTES;
}

/** Includes the 4:00-8:00pm and 4:00-9:30am extended windows. */
export function isExtendedHours(now: Date = new Date()): boolean {
  const { weekday, minutesSinceMidnight } = easternParts(now);
  if (weekday === 0 || weekday === 6) return false;
  return minutesSinceMidnight >= 4 * 60 && minutesSinceMidnight < 20 * 60;
}

/**
 * Quotes are worthless after a few seconds during the session, but nothing moves
 * overnight - so the TTL stretches out and the free-tier quota is preserved.
 */
export function quoteTtlSeconds(now: Date = new Date()): number {
  if (isMarketOpen(now)) return 15;
  if (isExtendedHours(now)) return 120;
  return 900;
}
