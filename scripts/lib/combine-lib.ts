/**
 * P43's two rules (`docs/spec/combine-v1.md` rows 2-3), shared by `npm run combine` and its test.
 */

export type Market = 'bullish' | 'bearish' | 'mixed' | 'neutral' | 'none';

/** Row 2: the direction of P49's verdict. An SOC follows its side (P49 row 15); 8 and 9 pull both ways. */
export function marketOf(scenario: number | null, v: string | null): Market {
  if (v?.startsWith('bullish SOC')) return 'bullish';
  if (v?.startsWith('bearish SOC')) return 'bearish';
  if (scenario === null) return 'none';
  if ([3, 5, 7].includes(scenario)) return 'bullish';
  if ([2, 4, 6].includes(scenario)) return 'bearish';
  if (scenario === 8 || scenario === 9) return 'mixed';
  return 'neutral';
}

/** Row 3: a stock trade is WITH the market when its side matches the scenario's direction. */
export function alignment(side: 'BUY' | 'SELL', m: Market): 'with' | 'against' | 'other' {
  if (m === 'bullish') return side === 'BUY' ? 'with' : 'against';
  if (m === 'bearish') return side === 'SELL' ? 'with' : 'against';
  return 'other';
}
