/**
 * Post-processing for the puzzle bank, shared by gen-puzzles.ts and runnable on its own
 * (re-writes the explanations and re-spreads the ratings without re-running the solver):
 *
 *   node --experimental-strip-types --no-warnings scripts/puzzle-post.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { comboIndex } from '../src/lib/cards.ts';
import { boardStrength } from '../src/lib/engine/strength.ts';
import type { Puzzle, PuzzleBank, PuzzleOption, Theme } from '../src/puzzles/types.ts';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const RANK_WORD = /^(Pocket\b|(Ace|King|Queen|Jack|Ten|Nine|Eight|Seven|Six|Five|Four|Three|Two)\b(?! pair))/;

/** "Full House" → "full house", "Top pair, …" → "top pair, …", but "Pocket Nines" / "Ace high" keep their capital. */
export function inSentence(label: string): string {
  const l = label.replace(/Full House/g, 'full house');
  return RANK_WORD.test(l) ? l : l.charAt(0).toLowerCase() + l.slice(1);
}
const atStart = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface IdeaInput {
  hs: number;
  eq: number;
  potOdds?: number;
  handLabel: string;
  comp: string;
  answer: PuzzleOption;
  facing: boolean;
}

export function ideaFor(theme: Theme, x: IdeaInput): string {
  const hand = inSentence(x.handLabel);
  switch (theme) {
    case 'value':
      if (x.facing) return `With ${hand} you're ahead of most of the hands that bet here — calling keeps their bluffs and worse value in.`;
      if (x.hs >= 0.9) return `With ${hand}, plenty of worse hands still call. Bet and get paid instead of giving a free showdown.`;
      return `Thin value: ${hand} is ahead of about ${pct(x.eq)} of the hands that got here, and enough worse ones will call a bet. Checking leaves money on the table.`;
    case 'bluff':
      return x.eq >= 0.25
        ? `${atStart(hand)} wins only ${pct(x.eq)} at showdown, so turn it into a bluff: the hands you fold out are better than yours and their range is weak.`
        : `${atStart(hand)} almost never wins at showdown (about ${pct(x.eq)}), but villain's range is weak enough that a bet folds out better hands often enough to profit.`;
    case 'bluffcatch':
      return `You need ${pct(x.potOdds ?? 0)} equity to call and have about ${pct(x.eq)} against villain's betting range — it has enough bluffs to make ${hand} a profitable call.`;
    case 'fold':
      return `Villain's line is value-heavy. ${atStart(hand)} has only about ${pct(x.eq)} equity against it, less than the ${pct(x.potOdds ?? 0)} you need. Fold and save your chips.`;
    case 'raise':
      return x.hs >= 0.8
        ? `Raise for value: ${hand} beats most of villain's betting range, and many of those hands will call a raise.`
        : `Raise as a bluff: villain's bet is often weak here and your hand can't call profitably — a raise wins the pot often enough.`;
    case 'check':
      if (x.hs >= 0.75 || x.eq >= 0.55)
        return `${atStart(hand)} is good enough to win at showdown (about ${pct(x.eq)}), but a bet only gets called by better hands and folds out worse ones. Check and take the showdown.`;
      if (x.eq >= 0.3)
        return `${atStart(hand)} has some showdown value (about ${pct(x.eq)}). Betting turns it into a bluff that doesn't fold out enough — check and see a cheap showdown.`;
      return `There's no profitable bluff — villain calls with too many hands. Give up and check with ${hand}.`;
    default:
      return '';
  }
}

/** Recomputes an existing postflop puzzle's explanation from its stored fields. */
export function refreshIdea(p: Puzzle): string {
  if (p.kind !== 'postflop') return p.idea;
  const hs = boardStrength(p.board).hs[comboIndex(p.heroCards[0], p.heroCards[1])];
  const answer = p.options.find((o) => o.key === p.best)!;
  return ideaFor(p.theme, { hs, eq: p.equity ?? 0, potOdds: p.potOdds, handLabel: p.handLabel, comp: p.villainRange ?? '', answer, facing: p.toCallBB > 0 });
}

// Inverse normal CDF (Acklam), for mapping rating percentiles onto a bell curve.
function invNorm(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * The raw difficulty scores bunch up around 1000; spread them onto a bell curve (mean 1250, sd 400)
 * keeping the order, so strong players still find puzzles above them. Idempotent.
 */
export function spreadRatings(puzzles: Puzzle[], mean = 1250, sd = 400): void {
  const order = [...puzzles].sort((a, b) => a.rating - b.rating || (a.id < b.id ? -1 : 1));
  order.forEach((p, i) => {
    const q = (i + 0.5) / order.length;
    p.rating = Math.round(Math.max(450, Math.min(2600, mean + sd * invNorm(q))));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = new URL('../public/puzzles/bank.json', import.meta.url);
  const bank = JSON.parse(readFileSync(url, 'utf8')) as PuzzleBank;
  for (const p of bank.puzzles) p.idea = refreshIdea(p);
  spreadRatings(bank.puzzles);
  writeFileSync(url, JSON.stringify(bank));
  const r = bank.puzzles.map((p) => p.rating).sort((a, b) => a - b);
  console.log(`${bank.puzzles.length} puzzles · rating p10 ${r[Math.floor(r.length * 0.1)]} · p50 ${r[Math.floor(r.length / 2)]} · p90 ${r[Math.floor(r.length * 0.9)]} · max ${r[r.length - 1]}`);
}
