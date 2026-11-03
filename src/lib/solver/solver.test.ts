import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { initSync, SpotSolver } from '../../solver/pkg/leakfinder_solver.js';
import { parseCards } from '../cards.ts';
import { parseHandHistories } from '../parser/index.ts';
import { STARS_CASH } from '../parser/fixtures.ts';
import { buildSyntheticHand } from '../training/synthetic.ts';
import { closestAction, readNode, solveSpot, type SpotSolverCtor } from './run.ts';
import { buildSolverSpot } from './spot.ts';
import { fromSolverCard, toSolverCard } from './common.ts';

initSync({ module: readFileSync(new URL('../../solver/pkg/leakfinder_solver_bg.wasm', import.meta.url)) });
const Ctor = SpotSolver as unknown as SpotSolverCtor;

describe('solver card encoding', () => {
  it('round-trips between our encoding and the solver encoding', () => {
    for (let c = 0; c < 52; c++) expect(fromSolverCard(toSolverCard(c))).toBe(c);
    // solver: 4 * rank + suit, clubs = 0, spades = 3
    expect(toSolverCard(parseCards('2c')[0])).toBe(0);
    expect(toSolverCard(parseCards('As')[0])).toBe(51);
  });
});

describe('GTO solver (postflop-solver wasm)', () => {
  it('solves a river bluff-catching spot from a hand and returns a sane strategy', () => {
    const { hand, decisionIndex } = buildSyntheticHand(
      {
        hero: 'BB', villain: 'BTN', heroCards: parseCards('Qh Jh') as [number, number], board: parseCards('Qc 8d 4s 2h 7c'),
        script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:bet:0.33', 'BB:call', 'TURN', 'BB:check', 'BTN:check', 'RIVER', 'BB:check', 'BTN:bet:0.75', 'BB:?'],
      },
      'solver-test',
    );
    const { spot, reason } = buildSolverSpot(hand, decisionIndex);
    expect(reason).toBeUndefined();
    expect(spot!.street).toBe('river');
    const { solver, stats } = solveSpot(Ctor, spot!);
    expect(stats.exploitabilityPct).toBeLessThan(1);
    const node = readNode(solver, spot!.before, { heroCards: spot!.heroCards, heroPlayer: 0 });
    expect(node.player).toBe(0);
    expect(node.actions.map((a) => a.kind)).toEqual(expect.arrayContaining([0, 2])); // fold & call available
    expect(node.hand).toBeDefined();
    const sum = node.hand!.strategy.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 3);
    const rangeSum = node.range.reduce((a, b) => a + b, 0);
    expect(rangeSum).toBeCloseTo(1, 3);
    expect(closestAction(node.actions, spot!.heroAction!)).toBeGreaterThanOrEqual(0);
    // Top pair facing a 75% river bet should continue most of the time.
    const foldIdx = node.actions.findIndex((a) => a.kind === 0);
    expect(node.hand!.strategy[foldIdx]).toBeLessThan(0.5);
    solver.free();
  });

  it('refuses multiway pots and preflop decisions with a reason', () => {
    const h = parseHandHistories(STARS_CASH).hands[0];
    const pre = h.actions.findIndex((a) => a.player === h.hero && a.type !== 'post');
    expect(buildSolverSpot(h, pre).reason).toMatch(/postflop/);
  });
});
