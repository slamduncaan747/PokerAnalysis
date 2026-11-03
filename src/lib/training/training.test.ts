import { describe, expect, it } from 'vitest';
import type { DrillType } from '../engine/leaks.ts';
import { generateQuestion, gradeAnswer } from './drills.ts';
import { dueCards, mastery, recordAttempt, syncCards, type Progress } from './progress.ts';
import { buildSyntheticHand } from './synthetic.ts';
import { parseCards } from '../cards.ts';

const ALL: DrillType[] = ['rfi', 'vs_open', 'bb_defense', 'vs_3bet', 'vs_limp', 'allin', 'pot_odds', 'bluffcatch', 'value', 'bluff', 'draws'];

describe('drills', () => {
  for (const d of ALL) {
    it(`generates a gradeable ${d} question`, () => {
      const q = generateQuestion(d);
      expect(q).not.toBeNull();
      expect(q!.options.length).toBeGreaterThanOrEqual(2);
      expect(q!.correct.length).toBeGreaterThanOrEqual(1);
      expect(q!.options.map((o) => o.key)).toContain(q!.bestKey);
      expect(gradeAnswer(q!, q!.bestKey).correct).toBe(true);
    });
  }
});

describe('synthetic hands', () => {
  it('builds consistent amounts', () => {
    const { hand, decisionIndex } = buildSyntheticHand(
      { hero: 'BB', villain: 'BTN', heroCards: parseCards('Ah Kh') as [number, number], board: parseCards('2c 7d 9h Jc 3s'), script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:bet:0.5', 'BB:?'] },
      't1',
    );
    const pot = hand.actions.slice(0, decisionIndex).reduce((s, a) => s + a.amount, 0);
    expect(pot).toBeCloseTo(0.5 + 2.5 + 2.5 + 2.75, 5);
    expect(hand.actions[decisionIndex].player).toBe('Hero');
  });
});

describe('spaced repetition', () => {
  it('promotes on correct answers and resets on misses', () => {
    let p: Progress = { attempts: [], cards: {}, streak: 0, bestStreak: 0 };
    p = syncCards(p, [{ qid: 'own-x-3', handId: 'x', actionIndex: 3, drill: 'value' }]);
    expect(dueCards(p)).toHaveLength(1);
    p = recordAttempt(p, { drill: 'value', correct: true, qid: 'own-x-3', own: { handId: 'x', actionIndex: 3 } });
    expect(p.cards['own-x-3'].box).toBe(1);
    p = recordAttempt(p, { drill: 'value', correct: true, qid: 'own-x-3', own: { handId: 'x', actionIndex: 3 } });
    expect(p.cards['own-x-3'].box).toBe(2);
    expect(dueCards(p)).toHaveLength(0);
    p = recordAttempt(p, { drill: 'value', correct: false, qid: 'own-x-3', own: { handId: 'x', actionIndex: 3 } });
    expect(p.cards['own-x-3'].box).toBe(1);
    expect(p.streak).toBe(0);
    expect(p.bestStreak).toBe(2);
    expect(mastery(p, 'value').attempts).toBe(3);
  });
});
