import { describe, expect, it } from 'vitest';
import { CLASS_COMBOS, parseCard, parseCards, rng } from '../cards.ts';
import { parseHandHistories } from '../parser/index.ts';
import { STARS_CASH, WINAMAX_CASH } from '../parser/fixtures.ts';
import { analyzeHand } from './analyze.ts';
import { freqOf, rfiChart, vsOpenChart } from './charts.ts';
import { accuracyFor, classifyPostflop } from './classify.ts';
import { equityVsRanges } from './equity.ts';
import { categoryOf, evaluate } from './evaluator.ts';
import { CLASS_PCT, parseRangeClasses, rangeCombos, rangeFromSpec } from './ranges.ts';
import { boardStrength, describeHand } from './strength.ts';
import { summarize } from './summary.ts';

describe('evaluator (phe)', () => {
  it('ranks hands correctly', () => {
    expect(categoryOf(evaluate(parseCards('As Ks Qs Js Ts 2c 3d')))).toBe('Straight Flush');
    expect(categoryOf(evaluate(parseCards('Ah Ad Kc Kd 2s 7h 9c')))).toBe('Two Pair');
    expect(evaluate(parseCards('Ah Ad Ac 2d 2s'))).toBeLessThan(evaluate(parseCards('Kh Kd Kc Ad As')));
  });
});

describe('ranges', () => {
  it('parses range notation', () => {
    const m = parseRangeClasses('TT+, A2s+, KTo+, 76s:0.5');
    expect(m.get('AA')).toBe(1);
    expect(m.get('TT')).toBe(1);
    expect(m.has('99')).toBe(false);
    expect(m.get('A2s')).toBe(1);
    expect(m.get('KJo')).toBe(1);
    expect(m.has('K9o')).toBe(false);
    expect(m.get('76s')).toBe(0.5);
    expect(rangeCombos(rangeFromSpec('AA'))).toBe(6);
    expect(rangeCombos(rangeFromSpec('AKs'))).toBe(4);
    expect(rangeCombos(rangeFromSpec('any'))).toBe(1326);
  });
  it('orders hands sensibly', () => {
    expect(CLASS_PCT.AA).toBeLessThan(CLASS_PCT.KK);
    expect(CLASS_PCT.AKs).toBeLessThan(CLASS_PCT['72o']);
    expect(CLASS_PCT['72o']).toBeGreaterThan(0.8);
  });
  it('charts behave like real ranges', () => {
    expect(freqOf(rfiChart('UTG', 6), 'AA').raise).toBe(1);
    expect(freqOf(rfiChart('UTG', 6), '72o').fold).toBe(1);
    expect(freqOf(rfiChart('BTN', 6), 'K5o').fold).toBe(1);
    expect(freqOf(rfiChart('BTN', 6), 'K8o').raise).toBe(1);
    const bb = vsOpenChart('BB', 'BTN', 0);
    expect(freqOf(bb, 'T7s').call).toBe(1);
    expect(freqOf(bb, 'AA').raise).toBe(1);
  });
});

describe('equity', () => {
  it('matches known matchups', () => {
    const r = rng(1);
    const aa = [parseCard('As'), parseCard('Ah')] as [number, number];
    const kk = rangeFromSpec('KK');
    const e = equityVsRanges(aa, [], [kk], 20000, r).equity;
    expect(e).toBeGreaterThan(0.79);
    expect(e).toBeLessThan(0.84);
    // Exact on the river
    const board = parseCards('2c 7d 9h Jc 3s');
    const river = equityVsRanges(aa, board, [kk], 0, r);
    expect(river.equity).toBe(1);
  });
  it('handles multiway', () => {
    const e = equityVsRanges([parseCard('As'), parseCard('Ah')], [], [rangeFromSpec('any'), rangeFromSpec('any')], 8000, rng(2)).equity;
    expect(e).toBeGreaterThan(0.69);
    expect(e).toBeLessThan(0.76);
  });
});

describe('board strength & descriptions', () => {
  it('describes holdings', () => {
    const b = parseCards('Kc 7d 2s');
    expect(describeHand([parseCard('Ah'), parseCard('Kd')], b)).toBe('Top pair, top kicker');
    expect(describeHand([parseCard('7h'), parseCard('7s')], b)).toMatch(/^Set of Sevens/);
    expect(describeHand([parseCard('Ah'), parseCard('Ad')], b)).toMatch(/^Overpair/);
    expect(describeHand([parseCard('9h'), parseCard('8h')], parseCards('Th Jh 2c'))).toMatch(/flush draw/);
  });
  it('ranks combos on a board', () => {
    const bs = boardStrength(parseCards('Kc 7d 2s'));
    const set = CLASS_COMBOS['77'].find((i) => !Number.isNaN(bs.hs[i]))!;
    const air = CLASS_COMBOS['54o'].find((i) => !Number.isNaN(bs.hs[i]))!;
    expect(bs.hs[set]).toBeGreaterThan(0.97);
    expect(bs.hs[air]).toBeLessThan(0.4);
  });
});

describe('classification', () => {
  it('grades by EV lost relative to the pot', () => {
    expect(classifyPostflop(0, 10)).toBe('best');
    expect(classifyPostflop(0.2, 10)).toBe('excellent');
    expect(classifyPostflop(1.2, 10)).toBe('inaccuracy');
    expect(classifyPostflop(2, 10)).toBe('mistake');
    expect(classifyPostflop(5, 10)).toBe('blunder');
    expect(classifyPostflop(25, 100)).toBe('blunder');
    expect(accuracyFor(0, 10)).toBe(100);
    expect(accuracyFor(5, 10)).toBeLessThan(40);
  });
});

describe('analyzeHand', () => {
  const hands = parseHandHistories(STARS_CASH + '\n\n' + WINAMAX_CASH).hands;
  it('produces decisions for every hero action', () => {
    const a = analyzeHand(hands[0]);
    const heroActions = hands[0].actions.filter((x) => x.player === hands[0].hero && x.type !== 'post');
    expect(a.decisions).toHaveLength(heroActions.length);
    expect(a.decisions[0].classification).toBe('book'); // AKo open from CO
    expect(a.netBB).toBeCloseTo(95.2, 1);
    expect(a.accuracy).not.toBeNull();
  });
  it('flags a trivial fold as trivial', () => {
    const a = analyzeHand(hands[1]);
    expect(a.decisions[0].trivial).toBe(true);
  });
  it('is deterministic', () => {
    expect(JSON.stringify(analyzeHand(hands[2]))).toBe(JSON.stringify(analyzeHand(hands[2])));
  });
  it('summarizes', () => {
    const s = summarize(hands.map((h) => analyzeHand(h)));
    expect(s.hands).toBe(3);
    expect(s.stats.find((x) => x.key === 'vpip')).toBeDefined();
    expect(s.graph.length).toBeGreaterThan(0);
  });
});
