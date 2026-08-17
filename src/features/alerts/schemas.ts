import type { AlertKind } from '@/lib/database.types';

export const ALERT_KINDS: AlertKind[] = [
  'price_above',
  'price_below',
  'percent_move',
  'news_keyword',
];

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  price_above: 'Price rises above',
  price_below: 'Price falls below',
  percent_move: 'Moves by more than',
  news_keyword: 'News mentions',
};

export const ALERT_KIND_SHORT_LABELS: Record<AlertKind, string> = {
  price_above: 'Above',
  price_below: 'Below',
  percent_move: '% move',
  news_keyword: 'News',
};

export type NewAlert = {
  symbol: string;
  kind: AlertKind;
  threshold: number | null;
  keyword: string | null;
  cooldownMinutes: number;
};

/** How an alert reads once created, e.g. "above $220.00". */
export function describeAlert(alert: {
  kind: AlertKind;
  threshold: number | null;
  keyword: string | null;
}): string {
  switch (alert.kind) {
    case 'price_above':
      return `Above $${(alert.threshold ?? 0).toFixed(2)}`;
    case 'price_below':
      return `Below $${(alert.threshold ?? 0).toFixed(2)}`;
    case 'percent_move':
      return `Moves more than ${(alert.threshold ?? 0).toFixed(1)}% in a day`;
    case 'news_keyword':
      return `News mentioning "${alert.keyword ?? ''}"`;
  }
}
