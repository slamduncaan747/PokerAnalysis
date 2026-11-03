import type { Card } from './cards.ts';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river'];

export type ActionType = 'post' | 'fold' | 'check' | 'call' | 'bet' | 'raise';
export type PostKind = 'sb' | 'bb' | 'ante' | 'straddle' | 'dead';

export type Position =
  | 'UTG' | 'UTG+1' | 'UTG+2' | 'UTG+3' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export interface Action {
  street: Street;
  player: string;
  type: ActionType;
  /** Chips put into the pot by this action. */
  amount: number;
  /** Player's total commitment on this street after the action (live money only). */
  toAmount: number;
  allIn: boolean;
  postKind?: PostKind;
}

export interface Player {
  seat: number;
  name: string;
  /** Starting stack in chips. */
  stack: number;
  position: Position;
  cards?: [Card, Card];
  isHero: boolean;
}

export interface Hand {
  id: string;
  site: string;
  gameType: 'cash' | 'tournament';
  tournamentId?: string;
  sb: number;
  bb: number;
  ante: number;
  currency: string;
  /** ISO timestamp (best effort). */
  date: string;
  table: string;
  maxSeats: number;
  buttonSeat: number;
  /** Players dealt into the hand, in seat order. */
  players: Player[];
  hero: string;
  heroCards: [Card, Card];
  actions: Action[];
  /** Board cards dealt (first board if run twice). */
  board: Card[];
  /** Amount each player collected from the pot(s). */
  collected: Record<string, number>;
  /** Uncalled bets returned. */
  uncalled: Record<string, number>;
  rake: number;
  totalPot: number;
  /** Money the site added to the pot (CoinPoker splash), already counted in totalPot. */
  splash?: number;
  /** Hero's net result in chips. */
  heroNet: number;
  /** True if hero reached showdown (cards were compared). */
  wentToShowdown: boolean;
  raw: string;
}

export interface ParseResult {
  hands: Hand[];
  errors: { snippet: string; message: string }[];
  skipped: number;
}
