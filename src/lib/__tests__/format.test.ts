import {
  directionOf,
  formatCompact,
  formatCurrency,
  formatPercent,
  formatRelativeTime,
  formatSignedCurrency,
  formatSignedPercent,
} from '@/lib/format';

describe('formatCurrency', () => {
  it('formats dollars with two decimals', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('keeps extra precision for sub-dollar prices', () => {
    expect(formatCurrency(0.0421)).toBe('$0.0421');
  });

  it('renders a placeholder for missing values', () => {
    expect(formatCurrency(null)).toBe('--');
    expect(formatCurrency(undefined)).toBe('--');
    expect(formatCurrency(Number.NaN)).toBe('--');
  });
});

describe('formatSignedCurrency', () => {
  it('prefixes the sign outside the currency symbol', () => {
    expect(formatSignedCurrency(12.3)).toBe('+$12.30');
    expect(formatSignedCurrency(-12.3)).toBe('-$12.30');
  });

  it('leaves zero unsigned', () => {
    expect(formatSignedCurrency(0)).toBe('$0.00');
  });
});

describe('percent formatting', () => {
  it('formats plain percentages', () => {
    expect(formatPercent(1.239)).toBe('1.24%');
  });

  it('signs gains but not losses twice', () => {
    expect(formatSignedPercent(1.5)).toBe('+1.50%');
    expect(formatSignedPercent(-1.5)).toBe('-1.50%');
  });
});

describe('formatCompact', () => {
  it('abbreviates large numbers', () => {
    expect(formatCompact(2_400_000_000)).toBe('2.4B');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-16T12:00:00Z').getTime();

  it.each([
    [30_000, 'just now'],
    [5 * 60_000, '5m ago'],
    [3 * 60 * 60_000, '3h ago'],
    [2 * 24 * 60 * 60_000, '2d ago'],
  ])('describes an age of %ims', (age, expected) => {
    expect(formatRelativeTime(new Date(now - age).toISOString(), now)).toBe(expected);
  });

  it('falls back to a date for anything older than a month', () => {
    expect(formatRelativeTime('2026-01-05T12:00:00Z', now)).toBe('Jan 5');
  });

  it('returns an empty string for missing input', () => {
    expect(formatRelativeTime(null)).toBe('');
  });
});

describe('directionOf', () => {
  it('classifies movement', () => {
    expect(directionOf(1)).toBe('up');
    expect(directionOf(-1)).toBe('down');
    expect(directionOf(0)).toBe('flat');
    expect(directionOf(null)).toBe('flat');
  });
});
