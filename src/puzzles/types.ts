/** A self-contained poker puzzle: one decision with an unambiguous best answer. */
export type Theme = 'value' | 'bluff' | 'bluffcatch' | 'fold' | 'raise' | 'check' | 'preflop' | 'potodds';

export const THEMES: Record<Theme, { label: string; blurb: string; emoji: string }> = {
  value: { label: 'Value bets', blurb: 'Get paid with your strong hands', emoji: '💰' },
  bluff: { label: 'Bluffs', blurb: 'Win pots you can’t win at showdown', emoji: '🎭' },
  bluffcatch: { label: 'Bluff-catching', blurb: 'Call when they bluff enough', emoji: '🪤' },
  fold: { label: 'Big folds', blurb: 'Let go of good-looking hands', emoji: '🧊' },
  raise: { label: 'Raises', blurb: 'Raise for value or as a bluff', emoji: '🚀' },
  check: { label: 'Checking', blurb: 'Pot control and taking showdowns', emoji: '✋' },
  preflop: { label: 'Preflop', blurb: 'Opens, defends and 3-bets', emoji: '🃏' },
  potodds: { label: 'Pot odds', blurb: 'Quick maths that wins money', emoji: '🧮' },
};

export type OptKind = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin' | 'choice';

export interface PuzzleOption {
  key: string;
  kind: OptKind;
  /** Bet/raise "to" amount in big blinds (rendered in the user's units). */
  toBB?: number;
  /** Fixed label for 'choice' options (pot-odds answers). */
  label?: string;
}

export interface Puzzle {
  id: string;
  rating: number;
  theme: Theme;
  kind: 'postflop' | 'preflop' | 'math';
  street: 'preflop' | 'flop' | 'turn' | 'river';
  heroPos: string;
  villainPos?: string;
  heroCards: [number, number];
  board: number[];
  potBB: number;
  toCallBB: number;
  stackBB: number;
  /** Action so far, one line per street, amounts written as "12.5bb" (rewritten to the user's units on screen). */
  history: string[];
  prompt: string;
  options: PuzzleOption[];
  correct: string[];
  best: string;
  /** Solver (postflop) or chart (preflop) frequency of each option for the hero's hand. */
  freq?: number[];
  /** Expected value of each option in bb (postflop). */
  ev?: number[];
  equity?: number;
  potOdds?: number;
  handLabel: string;
  villainRange?: string;
  board_texture?: string;
  idea: string;
}

export interface PuzzleBank {
  version: number;
  generated: string;
  puzzles: Puzzle[];
}
