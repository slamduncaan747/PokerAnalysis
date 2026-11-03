import { rankOf, suitOf, type Card } from '../cards.ts';

export const SCALE = 100; // solver chips per big blind

export interface SolverAction {
  /** 0 fold, 1 check, 2 call, 3 bet, 4 raise, 5 all-in */
  kind: number;
  /** Street commitment after the action ("to" amount) in solver chips. */
  to: number;
}

/** Our card codes use suit order s,h,d,c; the solver uses c,d,h,s. */
export const toSolverCard = (c: Card) => rankOf(c) * 4 + (3 - suitOf(c));
export const fromSolverCard = (c: number) => (c >> 2) * 4 + (3 - (c & 3));
