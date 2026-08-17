import type { BasicFinancials, Quote, RecommendationTrend } from './market-types.ts';

/**
 * Deterministic candidate scoring.
 *
 * The model never picks the stocks. Ranking happens here, from numbers, and the
 * model only explains the result - so the same inputs always produce the same
 * order and every score can be traced back to its factors.
 */

export type ScoreFactor = {
  key: string;
  label: string;
  /** 0-1, before weighting. */
  value: number;
  weight: number;
  detail: string;
};

export type ScoreResult = {
  score: number;
  factors: ScoreFactor[];
  /** Factors with usable data, out of the total - low coverage lowers confidence. */
  coverage: number;
};

export type ScoreInput = {
  quote: Quote | null;
  financials: BasicFinancials | null;
  trend: RecommendationTrend | null;
  /** Closing prices over the medium term, oldest first. */
  closes: number[];
};

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

/** Maps a value onto 0-1 where `best` scores 1 and `worst` scores 0. */
function normalize(value: number, worst: number, best: number): number {
  if (best === worst) return 0.5;
  return clamp01((value - worst) / (best - worst));
}

function momentumFactor({ closes }: ScoreInput): ScoreFactor | null {
  if (closes.length < 10) return null;

  const first = closes[0];
  const last = closes[closes.length - 1];
  if (!first) return null;

  const change = (last - first) / first;
  const average = closes.reduce((sum, close) => sum + close, 0) / closes.length;
  const aboveAverage = last > average;

  // Reward steady appreciation but not parabolic moves: +40% over the window is
  // where the curve tops out.
  return {
    key: 'momentum',
    label: 'Price trend',
    value: normalize(change, -0.25, 0.4) * (aboveAverage ? 1 : 0.85),
    weight: 0.2,
    detail: `${(change * 100).toFixed(1)}% over the window, ${aboveAverage ? 'above' : 'below'} its average close`,
  };
}

function growthFactor({ financials }: ScoreInput): ScoreFactor | null {
  const revenue = financials?.revenueGrowthTtmYoy;
  const eps = financials?.epsGrowthTtmYoy;
  if (revenue == null && eps == null) return null;

  const parts: number[] = [];
  const details: string[] = [];

  if (revenue != null) {
    parts.push(normalize(revenue, -10, 30));
    details.push(`revenue ${revenue.toFixed(1)}% YoY`);
  }
  if (eps != null) {
    parts.push(normalize(eps, -20, 40));
    details.push(`EPS ${eps.toFixed(1)}% YoY`);
  }

  return {
    key: 'growth',
    label: 'Growth',
    value: parts.reduce((sum, part) => sum + part, 0) / parts.length,
    weight: 0.2,
    detail: details.join(', '),
  };
}

function qualityFactor({ financials }: ScoreInput): ScoreFactor | null {
  const roe = financials?.returnOnEquityTtm;
  const margin = financials?.grossMarginTtm;
  if (roe == null && margin == null) return null;

  const parts: number[] = [];
  const details: string[] = [];

  if (roe != null) {
    parts.push(normalize(roe, 0, 35));
    details.push(`ROE ${roe.toFixed(1)}%`);
  }
  if (margin != null) {
    parts.push(normalize(margin, 15, 65));
    details.push(`gross margin ${margin.toFixed(1)}%`);
  }

  return {
    key: 'quality',
    label: 'Quality',
    value: parts.reduce((sum, part) => sum + part, 0) / parts.length,
    weight: 0.2,
    detail: details.join(', '),
  };
}

function valueFactor({ financials }: ScoreInput): ScoreFactor | null {
  const pe = financials?.peRatio;
  const pb = financials?.pbRatio;
  if ((pe == null || pe <= 0) && (pb == null || pb <= 0)) return null;

  const parts: number[] = [];
  const details: string[] = [];

  // Inverted ranges: cheaper multiples score higher, and a negative or absurd
  // multiple simply drops out rather than distorting the score.
  if (pe != null && pe > 0) {
    parts.push(normalize(pe, 45, 8));
    details.push(`P/E ${pe.toFixed(1)}`);
  }
  if (pb != null && pb > 0) {
    parts.push(normalize(pb, 8, 1));
    details.push(`P/B ${pb.toFixed(1)}`);
  }

  return {
    key: 'value',
    label: 'Valuation',
    value: parts.reduce((sum, part) => sum + part, 0) / parts.length,
    weight: 0.15,
    detail: details.join(', '),
  };
}

function analystFactor({ trend }: ScoreInput): ScoreFactor | null {
  if (!trend) return null;

  const total = trend.strongBuy + trend.buy + trend.hold + trend.sell + trend.strongSell;
  if (total === 0) return null;

  const weighted =
    (trend.strongBuy * 1 + trend.buy * 0.75 + trend.hold * 0.5 + trend.sell * 0.25) / total;

  return {
    key: 'analysts',
    label: 'Analyst consensus',
    value: clamp01(weighted),
    weight: 0.15,
    detail: `${trend.strongBuy + trend.buy} of ${total} analysts positive`,
  };
}

function stabilityFactor({ financials, quote }: ScoreInput): ScoreFactor | null {
  const beta = financials?.beta;
  const high = financials?.week52High;
  const low = financials?.week52Low;
  const price = quote?.price;

  const parts: number[] = [];
  const details: string[] = [];

  if (beta != null) {
    // Around 1.0 is market-like; far above it is a risk, far below is dull.
    parts.push(normalize(Math.abs(beta - 1), 1.5, 0));
    details.push(`beta ${beta.toFixed(2)}`);
  }
  if (price != null && high != null && low != null && high > low) {
    // Mid-range beats both a blow-off top and a falling knife.
    const position = (price - low) / (high - low);
    parts.push(1 - Math.abs(position - 0.6) / 0.6);
    details.push(`${(position * 100).toFixed(0)}% of its 52-week range`);
  }

  if (parts.length === 0) return null;

  return {
    key: 'stability',
    label: 'Risk profile',
    value: clamp01(parts.reduce((sum, part) => sum + part, 0) / parts.length),
    weight: 0.1,
    detail: details.join(', '),
  };
}

const FACTOR_BUILDERS = [
  momentumFactor,
  growthFactor,
  qualityFactor,
  valueFactor,
  analystFactor,
  stabilityFactor,
];

export function scoreCandidate(input: ScoreInput): ScoreResult {
  const factors = FACTOR_BUILDERS.map((build) => build(input)).filter(
    (factor): factor is ScoreFactor => factor !== null,
  );

  if (factors.length === 0) {
    return { score: 0, factors: [], coverage: 0 };
  }

  // Renormalise by the weights actually present, so a symbol missing fundamentals
  // is not silently pushed to the bottom - it is just less certain.
  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const weighted = factors.reduce((sum, factor) => sum + factor.value * factor.weight, 0);

  return {
    score: Math.round((weighted / totalWeight) * 1000) / 10,
    factors,
    coverage: factors.length / FACTOR_BUILDERS.length,
  };
}

/** Blends data coverage with score decisiveness into a 0-1 confidence. */
export function confidenceFrom(result: ScoreResult): number {
  const decisiveness = Math.abs(result.score - 50) / 50;
  return Math.round(clamp01(result.coverage * 0.7 + decisiveness * 0.3) * 100) / 100;
}
