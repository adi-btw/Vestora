import { getMarketStatus } from '@/lib/market-hours';

/**
 * All fixtures are expressed in UTC. During August, New York is UTC-4, so 13:30
 * UTC is the 09:30 open.
 */
describe('getMarketStatus', () => {
  it('reports an open market during the regular session', () => {
    expect(getMarketStatus(new Date('2026-08-17T14:00:00Z'))).toBe('open');
  });

  it('treats the opening minute as open and the closing minute as after hours', () => {
    expect(getMarketStatus(new Date('2026-08-17T13:30:00Z'))).toBe('open');
    expect(getMarketStatus(new Date('2026-08-17T20:00:00Z'))).toBe('after-hours');
  });

  it('detects the pre-market window', () => {
    expect(getMarketStatus(new Date('2026-08-17T12:00:00Z'))).toBe('pre-market');
  });

  it('closes on weekends', () => {
    expect(getMarketStatus(new Date('2026-08-15T14:00:00Z'))).toBe('closed');
    expect(getMarketStatus(new Date('2026-08-16T14:00:00Z'))).toBe('closed');
  });

  it('closes overnight', () => {
    expect(getMarketStatus(new Date('2026-08-18T05:00:00Z'))).toBe('closed');
  });
});
