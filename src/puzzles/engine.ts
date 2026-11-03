import { rng } from '../lib/cards.ts';
import type { Puzzle, Theme } from './types.ts';

/** Ratings work like chess.com puzzles: puzzles have a fixed rating, yours moves with each attempt. */
export const START_RATING = 1000;
export const MIN_RATING = 100;

export function expectedScore(rating: number, puzzleRating: number): number {
  return 1 / (1 + 10 ** ((puzzleRating - rating) / 400));
}

/** Larger steps while the rating is still provisional, so new players find their level quickly. */
export function kFactor(games: number): number {
  return games < 20 ? 48 : games < 60 ? 32 : 20;
}

export function ratingDelta(rating: number, puzzleRating: number, games: number, solved: boolean): number {
  const raw = kFactor(games) * ((solved ? 1 : 0) - expectedScore(rating, puzzleRating));
  let d = Math.round(raw);
  if (d === 0) d = solved ? 1 : -1;
  return Math.max(Math.min(0, MIN_RATING - rating), d);
}

/**
 * Picks the next rated puzzle: close to your rating (slightly above, so you're stretched),
 * not seen recently, optionally limited to one theme.
 */
export function pickPuzzle(bank: readonly Puzzle[], rating: number, recent: readonly string[], opts: { theme?: Theme; rand?: () => number } = {}): Puzzle | null {
  const rand = opts.rand ?? Math.random;
  let pool = opts.theme ? bank.filter((p) => p.theme === opts.theme) : bank;
  if (!pool.length) return null;
  const seen = new Set(recent);
  const unseen = pool.filter((p) => !seen.has(p.id));
  // Everything seen: fall back to the ones seen longest ago.
  if (unseen.length) pool = unseen;
  else {
    const order = new Map(recent.map((id, i) => [id, i]));
    pool = [...pool].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).slice(0, Math.max(5, Math.ceil(pool.length / 3)));
  }
  const target = rating + 30;
  let lo = rating - 150;
  let hi = rating + 200;
  let cands = pool.filter((p) => p.rating >= lo && p.rating <= hi);
  for (let i = 0; i < 8 && cands.length < 6; i++) {
    lo -= 100;
    hi += 100;
    cands = pool.filter((p) => p.rating >= lo && p.rating <= hi);
  }
  if (!cands.length) cands = [...pool].sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target)).slice(0, 6);
  const w = cands.map((p) => Math.exp(-(((p.rating - target) / 130) ** 2)) + 0.02);
  let x = rand() * w.reduce((s, v) => s + v, 0);
  for (let i = 0; i < cands.length; i++) {
    x -= w[i];
    if (x <= 0) return cands[i];
  }
  return cands[cands.length - 1];
}

// ---------------------------------------------------------------------------
// Daily Hand: the same three puzzles for everyone each day (easy → hard), one try each.
// ---------------------------------------------------------------------------
const DAY0 = Date.UTC(2026, 10, 1);
const DAY_MS = 86_400_000;

/** #1 is 1 Nov 2026, counted in the player's local calendar. */
export function dayNumber(d: Date = new Date()): number {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - DAY0) / DAY_MS) + 1;
}

export function dateOfDay(n: number): Date {
  const u = new Date(DAY0 + (n - 1) * DAY_MS);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
}

export const DAILY_TIERS = [
  { label: 'Warm-up', min: 650, max: 1100 },
  { label: 'Think', min: 1150, max: 1600 },
  { label: 'Boss', min: 1650, max: 2450 },
] as const;

function shuffled<T>(xs: T[], seed: number): T[] {
  const r = rng(seed);
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const dailyCache = new WeakMap<readonly Puzzle[], Puzzle[][]>();

export function dailySet(bank: readonly Puzzle[], day: number): Puzzle[] {
  let pools = dailyCache.get(bank);
  if (!pools) {
    const sorted = [...bank].filter((p) => p.kind !== 'math').sort((a, b) => (a.id < b.id ? -1 : 1));
    pools = DAILY_TIERS.map((t, i) => {
      const inTier = sorted.filter((p) => p.rating >= t.min && p.rating <= t.max);
      // Hard slots are postflop-heavy; they make the best "boss" hands.
      const pool = i === 2 ? inTier.filter((p) => p.kind === 'postflop').concat(inTier.filter((p) => p.kind !== 'postflop').slice(0, 20)) : inTier;
      return shuffled(pool, 7349 + i * 101);
    });
    dailyCache.set(bank, pools);
  }
  const used = new Set<string>();
  const out: Puzzle[] = [];
  const d = Math.max(0, day - 1);
  for (const pool of pools) {
    if (!pool.length) continue;
    // Step through each tier's fixed shuffle so a puzzle doesn't repeat until the tier is used up.
    for (let k = 0; k < pool.length; k++) {
      const p = pool[(d + k) % pool.length];
      if (!used.has(p.id) || k === pool.length - 1) {
        used.add(p.id);
        out.push(p);
        break;
      }
    }
  }
  return out;
}

export function shareText(day: number, results: readonly boolean[], streak: number): string {
  const squares = results.map((ok) => (ok ? '🟩' : '🟥')).join('');
  const score = results.filter(Boolean).length;
  const lines = [`Leakfinder Daily #${day} ${squares} ${score}/${results.length}`];
  if (streak > 1) lines.push(`🔥 ${streak}-day streak`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Player profile
// ---------------------------------------------------------------------------
export interface Attempt {
  id: string;
  ok: boolean;
  /** Rating after the attempt (rated attempts only). */
  r?: number;
  d?: number;
  pr: number;
  th: Theme;
  t: number;
  mode: 'rated' | 'daily' | 'theme';
  /** The option chosen. */
  k?: string;
}

export interface PuzzleProfile {
  version: 1;
  rating: number;
  peak: number;
  games: number;
  solved: number;
  /** Current run of correct answers in rated play. */
  run: number;
  bestRun: number;
  history: Attempt[];
  themes: Partial<Record<Theme, { n: number; ok: number }>>;
  daily: Record<number, boolean[]>;
  streak: number;
  bestStreak: number;
  lastDailyDay: number;
}

export function newProfile(): PuzzleProfile {
  return { version: 1, rating: START_RATING, peak: START_RATING, games: 0, solved: 0, run: 0, bestRun: 0, history: [], themes: {}, daily: {}, streak: 0, bestStreak: 0, lastDailyDay: 0 };
}

const HISTORY_CAP = 600;

/** Records an attempt. Daily puzzles don't change the rating (everyone gets the same ones). */
export function recordAttempt(p: PuzzleProfile, puzzle: Puzzle, ok: boolean, mode: Attempt['mode'], now = Date.now(), day = dayNumber(new Date(now)), key?: string): { profile: PuzzleProfile; delta: number } {
  const next: PuzzleProfile = { ...p, themes: { ...p.themes }, daily: { ...p.daily } };
  let delta = 0;
  const t = next.themes[puzzle.theme] ?? { n: 0, ok: 0 };
  next.themes[puzzle.theme] = { n: t.n + 1, ok: t.ok + (ok ? 1 : 0) };
  if (mode === 'daily') {
    const res = [...(next.daily[day] ?? []), ok];
    next.daily[day] = res;
    if (res.length === 3) {
      next.streak = next.lastDailyDay === day - 1 ? next.streak + 1 : next.lastDailyDay === day ? next.streak : 1;
      next.lastDailyDay = day;
      next.bestStreak = Math.max(next.bestStreak, next.streak);
    }
  } else {
    delta = ratingDelta(p.rating, puzzle.rating, p.games, ok);
    next.rating = p.rating + delta;
    next.peak = Math.max(p.peak, next.rating);
    next.games = p.games + 1;
    next.solved = p.solved + (ok ? 1 : 0);
    next.run = ok ? p.run + 1 : 0;
    next.bestRun = Math.max(p.bestRun, next.run);
  }
  const a: Attempt = { id: puzzle.id, ok, pr: puzzle.rating, th: puzzle.theme, t: now, mode };
  if (key) a.k = key;
  if (mode !== 'daily') {
    a.r = next.rating;
    a.d = delta;
  }
  next.history = [...p.history, a].slice(-HISTORY_CAP);
  return { profile: next, delta };
}

/** Streak shown today: still alive if the last completed daily was today or yesterday. */
export function liveStreak(p: PuzzleProfile, today = dayNumber()): number {
  return p.lastDailyDay >= today - 1 ? p.streak : 0;
}

export function recentIds(p: PuzzleProfile, n = 400): string[] {
  return p.history.slice(-n).map((a) => a.id);
}

/** Rating after each rated attempt, for the graph (starts at the initial rating). */
export function ratingSeries(p: PuzzleProfile): number[] {
  const out = [START_RATING];
  for (const a of p.history) if (a.r !== undefined) out.push(a.r);
  return out;
}

/** Merge two profiles (e.g. phone and computer): keep the one with more rated games, union the dailies. */
export function mergeProfiles(a: PuzzleProfile, b: PuzzleProfile): PuzzleProfile {
  const main = b.games > a.games || (b.games === a.games && b.history.length > a.history.length) ? b : a;
  const other = main === a ? b : a;
  const daily = { ...other.daily, ...main.daily };
  for (const k of Object.keys(other.daily)) {
    const d = Number(k);
    if ((other.daily[d]?.length ?? 0) > (daily[d]?.length ?? 0)) daily[d] = other.daily[d];
  }
  const fromMain = main.lastDailyDay >= other.lastDailyDay;
  return {
    ...main,
    daily,
    streak: fromMain ? main.streak : other.streak,
    lastDailyDay: Math.max(main.lastDailyDay, other.lastDailyDay),
    bestStreak: Math.max(main.bestStreak, other.bestStreak),
  };
}
