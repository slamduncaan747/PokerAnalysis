import type { DrillType } from '../engine/leaks.ts';

/**
 * Training progress, stored locally in the browser.
 * Own-hand mistakes go into a Leitner spaced-repetition queue: answer correctly and the spot
 * comes back later (1, 3, 7, 16 days); miss it and it comes straight back.
 */
export interface Attempt {
  t: number;
  drill: DrillType;
  correct: boolean;
  qid: string;
  own: boolean;
}

export interface CardState {
  box: number;
  due: number;
  handId: string;
  actionIndex: number;
  drill: DrillType;
  seen: number;
  correct: number;
}

export interface Progress {
  attempts: Attempt[];
  cards: Record<string, CardState>;
  streak: number;
  bestStreak: number;
}

const KEY = 'leakfinder.training.v1';
const DAY = 24 * 3600 * 1000;
const INTERVALS = [0, 10 * 60 * 1000, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY];

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Progress;
  } catch {
    /* ignore */
  }
  return { attempts: [], cards: {}, streak: 0, bestStreak: 0 };
}

export function saveProgress(p: Progress) {
  try {
    if (p.attempts.length > 3000) p.attempts = p.attempts.slice(-3000);
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full or unavailable — progress just won't persist */
  }
}

export function recordAttempt(
  p: Progress,
  a: { drill: DrillType; correct: boolean; qid: string; own?: { handId: string; actionIndex: number } },
): Progress {
  const now = Date.now();
  const next: Progress = { ...p, attempts: [...p.attempts, { t: now, drill: a.drill, correct: a.correct, qid: a.qid, own: !!a.own }], cards: { ...p.cards } };
  next.streak = a.correct ? p.streak + 1 : 0;
  next.bestStreak = Math.max(p.bestStreak, next.streak);
  if (a.own) {
    const prev = next.cards[a.qid] ?? { box: 1, due: now, handId: a.own.handId, actionIndex: a.own.actionIndex, drill: a.drill, seen: 0, correct: 0 };
    const box = a.correct ? Math.min(5, prev.box + 1) : 1;
    next.cards[a.qid] = { ...prev, box, due: now + INTERVALS[box], seen: prev.seen + 1, correct: prev.correct + (a.correct ? 1 : 0) };
  }
  return next;
}

/** Ensure every own-hand mistake has a card (new cards are due immediately). */
export function syncCards(p: Progress, mistakes: { qid: string; handId: string; actionIndex: number; drill: DrillType }[]): Progress {
  let changed = false;
  const cards = { ...p.cards };
  for (const m of mistakes) {
    if (!cards[m.qid]) {
      cards[m.qid] = { box: 0, due: 0, handId: m.handId, actionIndex: m.actionIndex, drill: m.drill, seen: 0, correct: 0 };
      changed = true;
    }
  }
  return changed ? { ...p, cards } : p;
}

export function dueCards(p: Progress, now = Date.now()): CardState[] {
  return Object.values(p.cards)
    .filter((c) => c.due <= now && c.box < 5)
    .sort((a, b) => a.box - b.box || a.due - b.due);
}

/** Mastery 0..100 for a drill: exponentially-weighted accuracy over recent attempts, shrunk towards 50 with few attempts. */
export function mastery(p: Progress, drill: DrillType): { score: number; attempts: number } {
  const xs = p.attempts.filter((a) => a.drill === drill).slice(-30);
  if (!xs.length) return { score: 0, attempts: 0 };
  let s = 0;
  let w = 0;
  xs.forEach((a, i) => {
    const wt = Math.pow(1.12, i);
    s += (a.correct ? 1 : 0) * wt;
    w += wt;
  });
  const acc = s / w;
  const conf = Math.min(1, xs.length / 12);
  return { score: Math.round(acc * conf * 100), attempts: p.attempts.filter((a) => a.drill === drill).length };
}

export function dailyActivity(p: Progress, days = 14): { day: string; n: number; correct: number }[] {
  const out: { day: string; n: number; correct: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const start = d.getTime();
    const end = start + DAY;
    const xs = p.attempts.filter((a) => a.t >= start && a.t < end);
    out.push({ day: `${d.getMonth() + 1}/${d.getDate()}`, n: xs.length, correct: xs.filter((a) => a.correct).length });
  }
  return out;
}
