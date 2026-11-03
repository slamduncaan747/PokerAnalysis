/**
 * Card encoding shared with the `phe` evaluator (port of HenryRLee's PokerHandEvaluator):
 *   code = rankIndex * 4 + suitIndex
 *   rankIndex: 2 = 0 ... A = 12
 *   suitIndex: s = 0, h = 1, d = 2, c = 3
 */
export type Card = number;

export const RANKS = '23456789TJQKA';
export const SUITS = 'shdc';
export const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const RANK_NAMES = ['Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'];
export const RANK_PLURALS = ['Twos', 'Threes', 'Fours', 'Fives', 'Sixes', 'Sevens', 'Eights', 'Nines', 'Tens', 'Jacks', 'Queens', 'Kings', 'Aces'];

export const rankOf = (c: Card): number => c >> 2;
export const suitOf = (c: Card): number => c & 3;

export function parseCard(s: string): Card {
  const t = s.trim();
  if (t.length !== 2 && !(t.length === 3 && t.startsWith('10'))) throw new Error(`Bad card "${s}"`);
  const rc = t.length === 3 ? 'T' : t[0].toUpperCase();
  const sc = t[t.length - 1].toLowerCase();
  const r = RANKS.indexOf(rc);
  const su = SUITS.indexOf(sc);
  if (r < 0 || su < 0) throw new Error(`Bad card "${s}"`);
  return r * 4 + su;
}

export function parseCards(s: string): Card[] {
  const clean = s.replace(/[[\],]/g, ' ').trim();
  if (!clean) return [];
  return clean.split(/\s+/).map(parseCard);
}

export const cardToString = (c: Card): string => RANKS[rankOf(c)] + SUITS[suitOf(c)];
export const cardsToString = (cs: readonly Card[]): string => cs.map(cardToString).join(' ');

/** Hand class like "AKs", "AKo", "QQ" (higher rank first). */
export function handClass(a: Card, b: Card): string {
  let r1 = rankOf(a);
  let r2 = rankOf(b);
  if (r2 > r1) [r1, r2] = [r2, r1];
  if (r1 === r2) return RANKS[r1] + RANKS[r2];
  return RANKS[r1] + RANKS[r2] + (suitOf(a) === suitOf(b) ? 's' : 'o');
}

/** All 1326 two-card combos; index i -> [c1, c2] with c1 > c2. */
export const COMBOS: [Card, Card][] = [];
/** comboIndex[c1 * 52 + c2] -> index into COMBOS (symmetric). */
export const COMBO_INDEX = new Int16Array(52 * 52).fill(-1);
for (let a = 1; a < 52; a++) {
  for (let b = 0; b < a; b++) {
    COMBO_INDEX[a * 52 + b] = COMBO_INDEX[b * 52 + a] = COMBOS.length;
    COMBOS.push([a, b]);
  }
}
export const comboIndex = (a: Card, b: Card): number => COMBO_INDEX[a * 52 + b];

/** 169 hand classes in 13x13 grid order (row = first rank high->low). Pairs on the diagonal, suited above. */
export const GRID_CLASSES: string[][] = [];
for (let i = 12; i >= 0; i--) {
  const row: string[] = [];
  for (let j = 12; j >= 0; j--) {
    if (i === j) row.push(RANKS[i] + RANKS[j]);
    else if (j < i) row.push(RANKS[i] + RANKS[j] + 's');
    else row.push(RANKS[j] + RANKS[i] + 'o');
  }
  GRID_CLASSES.push(row);
}
export const ALL_CLASSES: string[] = GRID_CLASSES.flat();

/** Combo indices for each hand class. */
export const CLASS_COMBOS: Record<string, number[]> = {};
for (const cls of ALL_CLASSES) CLASS_COMBOS[cls] = [];
COMBOS.forEach(([a, b], i) => CLASS_COMBOS[handClass(a, b)].push(i));
export const COMBO_CLASS: string[] = COMBOS.map(([a, b]) => handClass(a, b));

export function cardMask(cards: readonly Card[]): bigint {
  let m = 0n;
  for (const c of cards) m |= 1n << BigInt(c);
  return m;
}

/** Fast dead-card lookup as a Uint8Array(52). */
export function deadArray(cards: readonly Card[]): Uint8Array {
  const d = new Uint8Array(52);
  for (const c of cards) d[c] = 1;
  return d;
}

/** Mulberry32 seeded PRNG so analysis is deterministic for a given hand. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
