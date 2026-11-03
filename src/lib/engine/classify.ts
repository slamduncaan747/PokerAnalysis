import type { Classification, Decision } from './types.ts';

export function weightedAccuracy(ds: Decision[]): number {
  let s = 0;
  let w = 0;
  for (const d of ds) {
    const wt = 1 + Math.log2(1 + d.potBB / 4);
    s += d.accuracy * wt;
    w += wt;
  }
  return Math.round((s / w) * 10) / 10;
}

export function classifyPostflop(loss: number, potBB: number): Classification {
  const r = loss / Math.max(potBB, 1);
  if (loss <= 1e-9) return 'best';
  let c: Classification;
  if (r < 0.03) c = 'excellent';
  else if (r < 0.07) c = 'good';
  else if (r < 0.15) c = 'inaccuracy';
  else if (r < 0.3) c = 'mistake';
  else c = 'blunder';
  // Very large absolute losses are blunders even in huge pots.
  if ((loss >= 20 && r >= 0.2) || loss >= 30) c = 'blunder';
  if (loss >= 10 && (c === 'good' || c === 'excellent' || c === 'inaccuracy')) c = 'mistake';
  if (c === 'blunder' && loss < 3) c = 'mistake';
  if (c === 'mistake' && loss < 1) c = 'inaccuracy';
  if (c === 'inaccuracy' && loss < 0.3) c = 'good';
  return c;
}

export function accuracyFor(loss: number, potBB: number): number {
  return Math.round(100 * Math.exp((-2.5 * loss) / Math.max(potBB, 2.5)) * 10) / 10;
}
