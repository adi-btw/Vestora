/**
 * Display formatting. Every number the user sees goes through here so currency,
 * sign and precision rules stay consistent across screens.
 */

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const preciseCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const quantityFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  // Sub-dollar tickers lose all meaning at two decimals.
  return Math.abs(value) < 1
    ? preciseCurrencyFormatter.format(value)
    : currencyFormatter.format(value);
}

export function formatSignedCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const formatted = formatCurrency(Math.abs(value));
  if (value === 0) return formatted;
  return `${value > 0 ? '+' : '-'}${formatted}`;
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '--';
  return `${value.toFixed(digits)}%`;
}

export function formatSignedPercent(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  return compactFormatter.format(value);
}

export function formatQuantity(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  return quantityFormatter.format(value);
}

export function formatMarketCap(millions: number | null | undefined): string {
  if (millions == null || !Number.isFinite(millions)) return '--';
  return `$${compactFormatter.format(millions * 1_000_000)}`;
}

/** "3m ago", "5h ago", "2d ago" - compact enough for a news row. */
export function formatRelativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return '';

  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '--';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Direction of a change, used to pick a palette color. */
export type Direction = 'up' | 'down' | 'flat';

export function directionOf(value: number | null | undefined): Direction {
  if (value == null || !Number.isFinite(value) || value === 0) return 'flat';
  return value > 0 ? 'up' : 'down';
}
