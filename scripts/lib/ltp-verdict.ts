/**
 * P52's one verdict rule (`docs/spec/ltp-oq-v1.md`): a question is settled only when BOTH fill models give the same
 * answer AND every arm compared has at least 20 trades. "Better" is ₹ net per trade.
 */

export const MIN_TRADES = 20;

export type Arm = { name: string; trades: number; net: number };
export type Verdict = { settled: boolean; answer: string | null; why: string };

const perTrade = (a: Arm) => (a.trades ? a.net / a.trades : -Infinity);

/** The best arm under one fill model, by net per trade. */
export function best(arms: Arm[]): Arm | null {
  let b: Arm | null = null;
  for (const a of arms) if (!b || perTrade(a) > perTrade(b)) b = a;
  return b;
}

/** Both fills' arms (same names, same order). */
export function verdict(touch: Arm[], late: Arm[]): Verdict {
  const small = [...touch, ...late].filter(a => a.trades < MIN_TRADES).map(a => `${a.name} (${a.trades})`);
  const bt = best(touch), bl = best(late);
  if (small.length) return { settled: false, answer: null, why: `an arm is under ${MIN_TRADES} trades: ${[...new Set(small)].join(', ')}` };
  if (!bt || !bl) return { settled: false, answer: null, why: 'no arms' };
  if (bt.name !== bl.name) return { settled: false, answer: null, why: `the fills disagree: touch says ${bt.name}, late1m says ${bl.name}` };
  return { settled: true, answer: bt.name, why: `best under both fills (touch ₹${Math.round(perTrade(bt))}/trade, late1m ₹${Math.round(perTrade(bl))}/trade)` };
}
