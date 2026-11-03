import type { Attempt, CardState, Progress } from '../lib/training/progress.ts';

/**
 * Merges training progress from two devices without losing anything:
 * attempts are unioned, each spaced-repetition card keeps the copy that has seen more practice,
 * and streaks are recomputed from the merged attempt history.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const seen = new Set<string>();
  const attempts: Attempt[] = [];
  for (const x of [...a.attempts, ...b.attempts]) {
    const k = `${x.t}|${x.qid}|${x.correct ? 1 : 0}`;
    if (seen.has(k)) continue;
    seen.add(k);
    attempts.push(x);
  }
  attempts.sort((x, y) => x.t - y.t);
  const capped = attempts.slice(-3000);

  const cards: Record<string, CardState> = { ...a.cards };
  for (const [k, c] of Object.entries(b.cards)) {
    const mine = cards[k];
    if (!mine || c.seen > mine.seen || (c.seen === mine.seen && c.due > mine.due)) cards[k] = c;
  }

  let streak = 0;
  for (let i = capped.length - 1; i >= 0 && capped[i].correct; i--) streak++;
  let run = 0;
  let best = Math.max(a.bestStreak, b.bestStreak);
  for (const x of capped) {
    run = x.correct ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { attempts: capped, cards, streak, bestStreak: best };
}

export function progressEqual(a: Progress, b: Progress): boolean {
  return a.attempts.length === b.attempts.length && a.streak === b.streak && a.bestStreak === b.bestStreak && JSON.stringify(a.cards) === JSON.stringify(b.cards);
}

/** Splits rows into upload batches by count and approximate payload size. */
export function batchBySize<T>(rows: T[], size: (r: T) => number, maxRows = 400, maxBytes = 1_500_000): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let bytes = 0;
  for (const r of rows) {
    const s = size(r);
    if (cur.length && (cur.length >= maxRows || bytes + s > maxBytes)) {
      out.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(r);
    bytes += s;
  }
  if (cur.length) out.push(cur);
  return out;
}
