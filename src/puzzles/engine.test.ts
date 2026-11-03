import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rng } from '../lib/cards.ts';
import { DAILY_TIERS, dailySet, dateOfDay, dayNumber, expectedScore, kFactor, liveStreak, mergeProfiles, newProfile, pickPuzzle, ratingDelta, recentIds, recordAttempt, shareText } from './engine.ts';
import type { Puzzle, PuzzleBank } from './types.ts';

const bank = (JSON.parse(readFileSync(new URL('../../public/puzzles/bank.json', import.meta.url), 'utf8')) as PuzzleBank).puzzles;

describe('Elo', () => {
  it('expects 50% against an equal puzzle and is symmetric', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5);
    expect(expectedScore(1400, 1200) + expectedScore(1200, 1400)).toBeCloseTo(1);
  });
  it('rewards hard solves more than easy ones and punishes easy misses more', () => {
    expect(ratingDelta(1200, 1600, 100, true)).toBeGreaterThan(ratingDelta(1200, 900, 100, true));
    expect(ratingDelta(1200, 900, 100, false)).toBeLessThan(ratingDelta(1200, 1600, 100, false));
    expect(ratingDelta(1200, 1200, 100, true)).toBe(10);
    expect(ratingDelta(1200, 1200, 0, false)).toBe(-24);
  });
  it('moves fast while provisional, then settles', () => {
    expect(kFactor(0)).toBeGreaterThan(kFactor(30));
    expect(kFactor(30)).toBeGreaterThan(kFactor(200));
  });
  it('never drops below the floor and always moves at least a point', () => {
    expect(100 + ratingDelta(100, 2500, 0, false)).toBeGreaterThanOrEqual(100);
    expect(ratingDelta(2500, 500, 500, true)).toBe(1);
  });
});

describe('adaptive selection', () => {
  it('serves puzzles near the rating, skipping recent ones', () => {
    const r = rng(7);
    for (const rating of [700, 1200, 1800]) {
      const picks = Array.from({ length: 60 }, () => pickPuzzle(bank, rating, [], { rand: r })!);
      const mean = picks.reduce((s, p) => s + p.rating, 0) / picks.length;
      expect(Math.abs(mean - rating)).toBeLessThan(160);
    }
    const recent = bank.slice(0, bank.length - 3).map((p) => p.id);
    const p = pickPuzzle(bank, 1200, recent, { rand: r })!;
    expect(recent.includes(p.id)).toBe(false);
  });
  it('filters by theme', () => {
    const p = pickPuzzle(bank, 1300, [], { theme: 'bluffcatch', rand: rng(3) })!;
    expect(p.theme).toBe('bluffcatch');
  });
  it('gets harder as you improve (simulated player)', () => {
    let profile = newProfile();
    const r = rng(11);
    // A player with true strength 1700 starting at 1000.
    for (let i = 0; i < 150; i++) {
      const p = pickPuzzle(bank, profile.rating, recentIds(profile), { rand: r })!;
      const solved = r() < expectedScore(1700, p.rating);
      profile = recordAttempt(profile, p, solved, 'rated', 1_800_000_000_000 + i * 60_000).profile;
    }
    expect(profile.rating).toBeGreaterThan(1450);
    const last = profile.history.slice(-20).reduce((s, a) => s + a.pr, 0) / 20;
    expect(last).toBeGreaterThan(1350);
  });
});

describe('Daily Hand', () => {
  it('counts days from 1 Nov 2026 in local time', () => {
    expect(dayNumber(new Date(2026, 10, 1, 0, 5))).toBe(1);
    expect(dayNumber(new Date(2026, 10, 1, 23, 55))).toBe(1);
    expect(dayNumber(new Date(2026, 10, 3, 12))).toBe(3);
    expect(dayNumber(dateOfDay(40))).toBe(40);
  });
  it('is the same three puzzles for everyone, easy → hard, changing daily', () => {
    const a = dailySet(bank, 10);
    const b = dailySet([...bank].reverse(), 10);
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
    expect(a).toHaveLength(3);
    a.forEach((p, i) => {
      expect(p.rating).toBeGreaterThanOrEqual(DAILY_TIERS[i].min);
      expect(p.rating).toBeLessThanOrEqual(DAILY_TIERS[i].max);
      expect(p.kind).not.toBe('math');
    });
    const seen = new Set<string>();
    for (let d = 1; d <= 60; d++) for (const p of dailySet(bank, d)) {
      expect(seen.has(p.id)).toBe(false);
      seen.add(p.id);
    }
  });
  it('tracks the streak and leaves the rating alone', () => {
    const set = dailySet(bank, 5);
    let p = newProfile();
    const play = (day: number) => {
      for (const z of dailySet(bank, day)) p = recordAttempt(p, z, true, 'daily', Date.now(), day).profile;
    };
    play(5);
    expect(p.streak).toBe(1);
    expect(p.rating).toBe(1000);
    play(6);
    expect(p.streak).toBe(2);
    expect(liveStreak(p, 7)).toBe(2);
    expect(liveStreak(p, 8)).toBe(0);
    play(8);
    expect(p.streak).toBe(1);
    expect(p.bestStreak).toBe(2);
    expect(set).toHaveLength(3);
  });
  it('shares a spoiler-free result', () => {
    expect(shareText(12, [true, false, true], 4)).toBe('Leakfinder Daily #12 🟩🟥🟩 2/3\n🔥 4-day streak');
  });
});

describe('profiles', () => {
  it('merges two devices, keeping the more-played rating and every daily', () => {
    let a = newProfile();
    let b = newProfile();
    const z = bank[0];
    for (let i = 0; i < 5; i++) a = recordAttempt(a, z, true, 'rated').profile;
    for (const p of dailySet(bank, 3)) b = recordAttempt(b, p, false, 'daily', Date.now(), 3).profile;
    const m = mergeProfiles(a, b);
    expect(m.games).toBe(5);
    expect(m.daily[3]).toEqual([false, false, false]);
    expect(m.lastDailyDay).toBe(3);
  });
});

describe('puzzle bank', () => {
  it('is well formed', () => {
    const ids = new Set<string>();
    for (const p of bank as Puzzle[]) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      const keys = p.options.map((o) => o.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(p.correct.length).toBeGreaterThan(0);
      for (const c of p.correct) expect(keys).toContain(c);
      expect(p.correct).toContain(p.best);
      expect(p.correct.length).toBeLessThan(keys.length);
      expect(p.rating).toBeGreaterThanOrEqual(400);
      expect(p.rating).toBeLessThanOrEqual(2600);
      expect(p.idea.length).toBeGreaterThan(20);
      if (p.freq) expect(p.freq).toHaveLength(keys.length);
      if (p.ev) expect(p.ev).toHaveLength(keys.length);
      if (p.kind !== 'math') {
        const cards = [...p.heroCards, ...p.board];
        expect(new Set(cards).size).toBe(cards.length);
        for (const c of cards) expect(c >= 0 && c < 52).toBe(true);
      }
      if (p.kind === 'postflop') {
        expect(p.board).toHaveLength(5);
        // The solver's preferred play is among the accepted answers and clearly dominant.
        const bi = keys.indexOf(p.best);
        expect(p.ev![bi]).toBe(Math.max(...p.ev!));
        const fA = p.correct.reduce((s, k) => s + p.freq![keys.indexOf(k)], 0);
        expect(fA).toBeGreaterThanOrEqual(0.79);
      }
    }
  });
  it('covers every theme and a wide range of difficulty', () => {
    const themes = new Set(bank.map((p) => p.theme));
    for (const t of ['value', 'bluff', 'bluffcatch', 'fold', 'raise', 'check', 'preflop', 'potodds']) expect(themes.has(t as Puzzle['theme'])).toBe(true);
    expect(bank.filter((p) => p.rating >= 1800).length).toBeGreaterThan(100);
    expect(bank.filter((p) => p.rating <= 800).length).toBeGreaterThan(100);
  });
  it('cannot be beaten by always checking or calling', () => {
    const P = bank.filter((p) => p.kind !== 'math');
    const ok = P.filter((p) => {
      const passive = p.options.find((o) => o.kind === 'check' || o.kind === 'call');
      return passive && p.correct.includes(passive.key);
    }).length;
    expect(ok / P.length).toBeLessThan(0.45);
  });
});
