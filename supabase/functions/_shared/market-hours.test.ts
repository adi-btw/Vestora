import { assertEquals } from 'jsr:@std/assert@1';

import { isExtendedHours, isMarketOpen, quoteTtlSeconds } from './market-hours.ts';

// Fixed instants expressed in UTC; New York is UTC-4 in August (EDT).
const wednesdayMidSession = new Date('2026-08-19T18:00:00Z'); // 2:00pm ET
const wednesdayPreMarket = new Date('2026-08-19T11:00:00Z'); // 7:00am ET
const wednesdayOvernight = new Date('2026-08-19T05:00:00Z'); // 1:00am ET
const saturdayMidday = new Date('2026-08-22T18:00:00Z');

Deno.test('regular session is detected', () => {
  assertEquals(isMarketOpen(wednesdayMidSession), true);
  assertEquals(isMarketOpen(wednesdayPreMarket), false);
  assertEquals(isMarketOpen(saturdayMidday), false);
});

Deno.test('extended hours cover pre-market but not overnight', () => {
  assertEquals(isExtendedHours(wednesdayPreMarket), true);
  assertEquals(isExtendedHours(wednesdayOvernight), false);
  assertEquals(isExtendedHours(saturdayMidday), false);
});

Deno.test('quote TTL widens as liquidity dries up', () => {
  assertEquals(quoteTtlSeconds(wednesdayMidSession), 15);
  assertEquals(quoteTtlSeconds(wednesdayPreMarket), 120);
  assertEquals(quoteTtlSeconds(wednesdayOvernight), 900);
});
