import { ALL_CLASSES, CLASS_COMBOS, COMBO_CLASS, RANKS } from '../cards.ts';
import { CLASS_EQUITY_VS_RANDOM } from './preflopEquity.ts';

/** A range is a weight in [0,1] for each of the 1326 combos. */
export type Range = Float32Array;

export const emptyRange = (): Range => new Float32Array(1326);
export const fullRange = (): Range => new Float32Array(1326).fill(1);

/**
 * Parse standard range notation into per-class weights.
 * Supports: "AA", "TT+", "77-55", "AKs", "A2s+", "KTo+", "K9s-K6s", "AK" (both), "AKs:0.5", "any".
 */
export function parseRangeClasses(spec: string): Map<string, number> {
  const out = new Map<string, number>();
  const set = (cls: string, w: number) => out.set(cls, Math.max(out.get(cls) ?? 0, w));
  for (let tok of spec.split(',').map((t) => t.trim()).filter(Boolean)) {
    let w = 1;
    const wm = tok.match(/^(.*):([\d.]+)$/);
    if (wm) {
      tok = wm[1].trim();
      w = parseFloat(wm[2]);
    }
    if (tok === 'any' || tok === 'random') {
      ALL_CLASSES.forEach((c) => set(c, w));
      continue;
    }
    const r = (ch: string) => RANKS.indexOf(ch.toUpperCase());
    let m: RegExpMatchArray | null;
    // Pair ranges
    if ((m = tok.match(/^([2-9TJQKA])\1\+$/i))) {
      for (let i = r(m[1]); i <= 12; i++) set(RANKS[i] + RANKS[i], w);
      continue;
    }
    if ((m = tok.match(/^([2-9TJQKA])\1-([2-9TJQKA])\2$/i))) {
      const [a, b] = [r(m[1]), r(m[2])].sort((x, y) => x - y);
      for (let i = a; i <= b; i++) set(RANKS[i] + RANKS[i], w);
      continue;
    }
    if ((m = tok.match(/^([2-9TJQKA])\1$/i))) {
      set(m[1].toUpperCase() + m[1].toUpperCase(), w);
      continue;
    }
    // Non-pair: XYs+, XYo+, XY+, XYs-XZs, XYs, XY
    if ((m = tok.match(/^([2-9TJQKA])([2-9TJQKA])([so]?)\+$/i))) {
      const hi = r(m[1]);
      const lo = r(m[2]);
      for (let j = lo; j < hi; j++) addNonPair(set, hi, j, m[3].toLowerCase(), w);
      continue;
    }
    if ((m = tok.match(/^([2-9TJQKA])([2-9TJQKA])([so]?)-([2-9TJQKA])([2-9TJQKA])([so]?)$/i))) {
      const hi = r(m[1]);
      const [a, b] = [r(m[2]), r(m[5])].sort((x, y) => x - y);
      for (let j = a; j <= b; j++) addNonPair(set, hi, j, m[3].toLowerCase(), w);
      continue;
    }
    if ((m = tok.match(/^([2-9TJQKA])([2-9TJQKA])([so]?)$/i))) {
      let hi = r(m[1]);
      let lo = r(m[2]);
      if (lo > hi) [hi, lo] = [lo, hi];
      addNonPair(set, hi, lo, m[3].toLowerCase(), w);
      continue;
    }
    throw new Error(`Unrecognized range token "${tok}"`);
  }
  return out;
}

function addNonPair(set: (c: string, w: number) => void, hi: number, lo: number, suit: string, w: number) {
  if (hi === lo) return;
  const base = RANKS[hi] + RANKS[lo];
  if (suit === 's' || suit === '') set(base + 's', w);
  if (suit === 'o' || suit === '') set(base + 'o', w);
}

export function rangeFromSpec(spec: string): Range {
  const r = emptyRange();
  for (const [cls, w] of parseRangeClasses(spec)) for (const i of CLASS_COMBOS[cls]) r[i] = w;
  return r;
}

export function rangeFromClassWeights(weights: Map<string, number> | Record<string, number>): Range {
  const r = emptyRange();
  const entries = weights instanceof Map ? weights.entries() : Object.entries(weights);
  for (const [cls, w] of entries) for (const i of CLASS_COMBOS[cls] ?? []) r[i] = w;
  return r;
}

export function rangeCombos(r: Range): number {
  let s = 0;
  for (let i = 0; i < r.length; i++) s += r[i];
  return s;
}

export const rangePct = (r: Range) => rangeCombos(r) / 1326;

// ---------------------------------------------------------------------------
// Preflop hand ranking. Hands are tiered by the loosest standard 6-max open
// they belong to (so the ordering agrees with the charts), then by raw equity.
// ---------------------------------------------------------------------------

export const RFI_SPECS: Record<string, string> = {
  EP9: '55+, A9s+, A5s-A4s, KTs+, QTs+, JTs, T9s, AJo+, KQo',
  EP8: '44+, A8s+, A5s-A4s, K9s+, Q9s+, J9s+, T9s, 98s, ATo+, KJo+',
  UTG: '33+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, 76s, ATo+, KJo+',
  HJ: '22+, A2s+, K7s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, 65s, ATo+, KTo+, QJo',
  CO: '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A8o+, A5o, KTo+, QTo+, JTo',
  BTN: '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o+, K8o+, Q9o+, J9o+, T8o+, 98o, 87o',
  SB: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 64s+, 54s, A2o+, K9o+, QTo+, JTo',
};

const TIER_ORDER = ['EP9', 'EP8', 'UTG', 'HJ', 'CO', 'BTN', 'SB'];

/** Classes ordered strongest -> weakest. */
export const CLASS_ORDER: string[] = (() => {
  const tierOf = new Map<string, number>();
  TIER_ORDER.forEach((t, ti) => {
    for (const cls of parseRangeClasses(RFI_SPECS[t]).keys()) if (!tierOf.has(cls)) tierOf.set(cls, ti);
  });
  return [...ALL_CLASSES].sort((a, b) => {
    const ta = tierOf.get(a) ?? 99;
    const tb = tierOf.get(b) ?? 99;
    if (ta !== tb) return ta - tb;
    return CLASS_EQUITY_VS_RANDOM[b] - CLASS_EQUITY_VS_RANDOM[a];
  });
})();

/** Percentile (0 = best) of each class by cumulative combo share, measured at the class midpoint. */
export const CLASS_PCT: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cum = 0;
  for (const cls of CLASS_ORDER) {
    const n = CLASS_COMBOS[cls].length;
    out[cls] = (cum + n / 2) / 1326;
    cum += n;
  }
  return out;
})();

export const comboPct = (i: number) => CLASS_PCT[COMBO_CLASS[i]];

/** Top x fraction of hands by the preflop ranking. */
export function topPct(x: number): Range {
  const r = emptyRange();
  let cum = 0;
  for (const cls of CLASS_ORDER) {
    const combos = CLASS_COMBOS[cls];
    if (cum >= x * 1326) break;
    const take = Math.min(1, (x * 1326 - cum) / combos.length);
    for (const i of combos) r[i] = take;
    cum += combos.length;
  }
  return r;
}

export function describeRangeClasses(r: Range, max = 14): string {
  const items: string[] = [];
  for (const cls of CLASS_ORDER) {
    const combos = CLASS_COMBOS[cls];
    let w = 0;
    for (const i of combos) w += r[i];
    if (w / combos.length > 0.3) items.push(cls);
  }
  if (items.length > max) return items.slice(0, max).join(', ') + ` … (+${items.length - max})`;
  return items.join(', ');
}
