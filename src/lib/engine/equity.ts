import { COMBOS, type Card } from '../cards.ts';
import { evaluate7, evalHole } from './evaluator.ts';
import type { Range } from './ranges.ts';

/** Weighted sampler over the combos of a range that don't collide with dead cards. */
export class RangeSampler {
  idx: Int16Array;
  cum: Float64Array;
  total: number;
  constructor(range: Range, dead: Uint8Array) {
    const idx: number[] = [];
    const cum: number[] = [];
    let t = 0;
    for (let i = 0; i < 1326; i++) {
      const w = range[i];
      if (w <= 0) continue;
      const [a, b] = COMBOS[i];
      if (dead[a] || dead[b]) continue;
      t += w;
      idx.push(i);
      cum.push(t);
    }
    this.idx = Int16Array.from(idx);
    this.cum = Float64Array.from(cum);
    this.total = t;
  }
  get size() {
    return this.idx.length;
  }
  sample(r: number): number {
    const x = r * this.total;
    let lo = 0;
    let hi = this.cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return this.idx[lo];
  }
}

export interface EquityResult {
  equity: number;
  /** Probability of winning outright (no tie). */
  win: number;
  samples: number;
}

/**
 * Hero equity vs one or more villain ranges. Exact enumeration for a single villain on
 * the river; Monte Carlo otherwise.
 */
export function equityVsRanges(
  hero: readonly [Card, Card],
  board: readonly Card[],
  villains: Range[],
  iterations: number,
  rand: () => number,
): EquityResult {
  const dead = new Uint8Array(52);
  dead[hero[0]] = dead[hero[1]] = 1;
  for (const c of board) dead[c] = 1;
  const samplers = villains.map((r) => new RangeSampler(r, dead));
  if (samplers.some((s) => s.size === 0)) return { equity: 0.5, win: 0.5, samples: 0 };

  if (villains.length === 1 && board.length === 5) {
    const s = samplers[0];
    const h = evalHole(hero[0], hero[1], board);
    let eq = 0;
    let win = 0;
    let tot = 0;
    for (let k = 0; k < s.size; k++) {
      const i = s.idx[k];
      const w = s.cum[k] - (k ? s.cum[k - 1] : 0);
      const [a, b] = COMBOS[i];
      const v = evalHole(a, b, board);
      tot += w;
      if (h < v) {
        eq += w;
        win += w;
      } else if (h === v) eq += w / 2;
    }
    return { equity: eq / tot, win: win / tot, samples: s.size };
  }

  const need = 5 - board.length;
  const bd = [...board, 0, 0, 0, 0, 0].slice(0, 5);
  const used = new Uint8Array(52);
  let eq = 0;
  let win = 0;
  let n = 0;
  const vc: number[] = new Array(villains.length * 2);
  for (let it = 0; it < iterations; it++) {
    used.set(dead);
    let ok = true;
    for (let v = 0; v < samplers.length; v++) {
      let tries = 0;
      let a = 0;
      let b = 0;
      do {
        [a, b] = COMBOS[samplers[v].sample(rand())];
        tries++;
      } while ((used[a] || used[b]) && tries < 20);
      if (used[a] || used[b]) {
        ok = false;
        break;
      }
      used[a] = used[b] = 1;
      vc[v * 2] = a;
      vc[v * 2 + 1] = b;
    }
    if (!ok) continue;
    for (let k = 0; k < need; k++) {
      let c: number;
      do c = (rand() * 52) | 0;
      while (used[c]);
      used[c] = 1;
      bd[board.length + k] = c;
    }
    const h = evaluate7(hero[0], hero[1], bd[0], bd[1], bd[2], bd[3], bd[4]);
    let best = Infinity;
    let ties = 0;
    for (let v = 0; v < samplers.length; v++) {
      const r = evaluate7(vc[v * 2], vc[v * 2 + 1], bd[0], bd[1], bd[2], bd[3], bd[4]);
      if (r < best) {
        best = r;
        ties = 1;
      } else if (r === best) ties++;
    }
    if (h < best) {
      eq += 1;
      win += 1;
    } else if (h === best) eq += 1 / (ties + 1);
    n++;
  }
  if (!n) return { equity: 0.5, win: 0.5, samples: 0 };
  return { equity: eq / n, win: win / n, samples: n };
}

/** Exact equity for known hands (used for all-in EV). Enumerates all runouts (≤ 1712304 for preflop, so sample when > 50k). */
export function equityKnownHands(hands: [Card, Card][], board: readonly Card[], rand: () => number): number[] {
  const dead = new Uint8Array(52);
  for (const [a, b] of hands) dead[a] = dead[b] = 1;
  for (const c of board) dead[c] = 1;
  const deck: Card[] = [];
  for (let c = 0; c < 52; c++) if (!dead[c]) deck.push(c);
  const need = 5 - board.length;
  const shares = new Array(hands.length).fill(0);
  let total = 0;
  const score = (bd: Card[]) => {
    let best = Infinity;
    const vals = hands.map(([a, b]) => evaluate7(a, b, bd[0], bd[1], bd[2], bd[3], bd[4]));
    for (const v of vals) best = Math.min(best, v);
    const winners = vals.filter((v) => v === best).length;
    vals.forEach((v, i) => {
      if (v === best) shares[i] += 1 / winners;
    });
    total++;
  };
  const bd = [...board];
  if (need === 0) score(bd);
  else if (need <= 2) {
    const rec = (start: number, k: number) => {
      if (k === 0) return score(bd);
      for (let i = start; i < deck.length; i++) {
        bd.push(deck[i]);
        rec(i + 1, k - 1);
        bd.pop();
      }
    };
    rec(0, need);
  } else {
    for (let it = 0; it < 20000; it++) {
      const picked = new Set<number>();
      while (picked.size < need) picked.add(deck[(rand() * deck.length) | 0]);
      score([...board, ...picked]);
    }
  }
  return shares.map((s) => s / total);
}
