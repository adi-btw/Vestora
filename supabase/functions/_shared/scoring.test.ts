import { assert, assertAlmostEquals, assertEquals } from 'jsr:@std/assert@1';

import type { BasicFinancials, Quote, RecommendationTrend } from './market-types.ts';
import { confidenceFrom, scoreCandidate, type ScoreInput } from './scoring.ts';

function quote(price: number): Quote {
  return {
    symbol: 'TEST',
    price,
    change: 1,
    changePercent: 1,
    dayHigh: price,
    dayLow: price,
    dayOpen: price,
    previousClose: price - 1,
    provider: 'test',
    asOf: '2026-08-14T20:00:00Z',
  };
}

function financials(overrides: Partial<BasicFinancials> = {}): BasicFinancials {
  return {
    peRatio: 20,
    pbRatio: 3,
    dividendYield: 1,
    beta: 1,
    week52High: 120,
    week52Low: 80,
    revenueGrowthTtmYoy: 10,
    epsGrowthTtmYoy: 12,
    returnOnEquityTtm: 18,
    grossMarginTtm: 40,
    ...overrides,
  };
}

const trend: RecommendationTrend = {
  period: '2026-08-01',
  strongBuy: 10,
  buy: 8,
  hold: 4,
  sell: 1,
  strongSell: 0,
};

/** Rising series, 20 points - enough for the momentum factor to engage. */
const risingCloses = Array.from({ length: 20 }, (_, index) => 100 + index * 1.5);

function input(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    quote: quote(105),
    financials: financials(),
    trend,
    closes: risingCloses,
    ...overrides,
  };
}

Deno.test('a healthy candidate scores above a weak one', () => {
  const strong = scoreCandidate(input());
  const weak = scoreCandidate(
    input({
      financials: financials({
        peRatio: 90,
        pbRatio: 12,
        revenueGrowthTtmYoy: -8,
        epsGrowthTtmYoy: -25,
        returnOnEquityTtm: 1,
        grossMarginTtm: 16,
        beta: 2.4,
      }),
      closes: risingCloses.map((close, index) => close - index * 3),
      trend: { ...trend, strongBuy: 0, buy: 1, hold: 5, sell: 6, strongSell: 3 },
    }),
  );

  assert(strong.score > weak.score, `expected ${strong.score} > ${weak.score}`);
  assert(strong.score >= 0 && strong.score <= 100);
  assert(weak.score >= 0 && weak.score <= 100);
});

Deno.test('scoring is deterministic', () => {
  assertEquals(scoreCandidate(input()).score, scoreCandidate(input()).score);
});

Deno.test('missing fundamentals reduce coverage but still produce a score', () => {
  const result = scoreCandidate(input({ financials: null, trend: null }));

  assertEquals(result.factors.length, 1);
  assertEquals(result.factors[0].key, 'momentum');
  assert(result.score > 0);
  assertAlmostEquals(result.coverage, 1 / 6, 0.001);
});

Deno.test('a candidate with no usable data yields no factors', () => {
  const result = scoreCandidate({ quote: null, financials: null, trend: null, closes: [] });

  assertEquals(result.factors.length, 0);
  assertEquals(result.score, 0);
  assertEquals(result.coverage, 0);
});

Deno.test('confidence rewards coverage over a decisive score', () => {
  const full = confidenceFrom(scoreCandidate(input()));
  const sparse = confidenceFrom(scoreCandidate(input({ financials: null, trend: null })));

  assert(full > sparse, `expected ${full} > ${sparse}`);
  assert(full <= 1 && sparse >= 0);
});
