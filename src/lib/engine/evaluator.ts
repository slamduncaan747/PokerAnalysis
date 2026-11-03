/**
 * Thin wrapper around `phe` — a JS port of HenryRLee's PokerHandEvaluator
 * (perfect-hash 5/6/7-card evaluator). Lower rank value = stronger hand (1 = royal flush, 7462 = 7-high).
 */
import evaluate5 from 'phe/lib/evaluator5.js';
import evaluate6 from 'phe/lib/evaluator6.js';
import evaluate7 from 'phe/lib/evaluator7.js';
import type { Card } from '../cards.ts';

export { evaluate5, evaluate6, evaluate7 };

export function evaluate(cards: readonly Card[]): number {
  switch (cards.length) {
    case 5:
      return evaluate5(cards[0], cards[1], cards[2], cards[3], cards[4]);
    case 6:
      return evaluate6(cards[0], cards[1], cards[2], cards[3], cards[4], cards[5]);
    case 7:
      return evaluate7(cards[0], cards[1], cards[2], cards[3], cards[4], cards[5], cards[6]);
    default:
      throw new Error(`evaluate needs 5-7 cards, got ${cards.length}`);
  }
}

/** Fast path: two hole cards + 3-5 board cards. */
export function evalHole(a: Card, b: Card, board: readonly Card[]): number {
  switch (board.length) {
    case 3:
      return evaluate5(a, b, board[0], board[1], board[2]);
    case 4:
      return evaluate6(a, b, board[0], board[1], board[2], board[3]);
    case 5:
      return evaluate7(a, b, board[0], board[1], board[2], board[3], board[4]);
    default:
      throw new Error('board must have 3-5 cards');
  }
}

export type HandCategory =
  | 'Straight Flush' | 'Four of a Kind' | 'Full House' | 'Flush' | 'Straight'
  | 'Three of a Kind' | 'Two Pair' | 'One Pair' | 'High Card';

/** Category boundaries from the evaluator's rank space. */
export function categoryOf(rank: number): HandCategory {
  if (rank > 6185) return 'High Card';
  if (rank > 3325) return 'One Pair';
  if (rank > 2467) return 'Two Pair';
  if (rank > 1609) return 'Three of a Kind';
  if (rank > 1599) return 'Straight';
  if (rank > 322) return 'Flush';
  if (rank > 166) return 'Full House';
  if (rank > 10) return 'Four of a Kind';
  return 'Straight Flush';
}
