import type { Position, Street } from '../types.ts';
import type { Freq } from './charts.ts';

export type Classification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export const CLASS_ORDER_GOOD_TO_BAD: Classification[] = [
  'brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'miss', 'mistake', 'blunder',
];

export const isError = (c: Classification) => c === 'inaccuracy' || c === 'mistake' || c === 'miss' || c === 'blunder';

export type ActKind = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export interface OptionEV {
  key: string;
  kind: ActKind;
  label: string;
  /** Total bet size ("to" amount) in bb for bet/raise. */
  toBB?: number;
  /** EV in bb relative to folding now (postflop and all-in spots). */
  ev?: number;
  /** Chart frequency (preflop chart spots). */
  freq?: number;
  /** Probability villain(s) fold (bets/raises). */
  foldPct?: number;
  /** Hero equity when called. */
  eqWhenCalled?: number;
}

export type LeakId =
  | 'pf_open_loose'
  | 'pf_open_tight'
  | 'pf_limp'
  | 'pf_vs_limp'
  | 'pf_cold_call_loose'
  | 'pf_flat_3bet_hands'
  | 'pf_fold_vs_open'
  | 'pf_bb_defense'
  | 'pf_3bet_light'
  | 'pf_vs3bet_loose'
  | 'pf_vs3bet_tight'
  | 'pf_4bet_pots'
  | 'pf_allin'
  | 'pos_missed_value'
  | 'pos_overbluff'
  | 'pos_missed_bluff'
  | 'pos_call_loose'
  | 'pos_overfold'
  | 'pos_thin_value'
  | 'pos_passive_draws'
  | 'pos_sizing';

export interface Decision {
  actionIndex: number;
  street: Street;
  heroKey: string;
  heroLabel: string;
  potBB: number;
  toCallBB: number;
  stackBB: number;
  /** Human readable spot, e.g. "BTN vs CO open" or "Turn · OOP · facing 75% bet". */
  spot: string;
  /** Machine-friendly scenario used for training drills. */
  scenario: string;
  options: OptionEV[];
  bestKey: string;
  evLoss: number;
  classification: Classification;
  accuracy: number;
  trivial: boolean;
  handLabel: string;
  equity?: number;
  potOdds?: number;
  villainRange?: string;
  chartFreq?: Freq;
  chartLabels?: { raise: string; call: string };
  leak?: LeakId;
  explanation: string[];
  /** Board at decision time (card codes). */
  board: number[];
  ip?: boolean;
  multiway?: boolean;
}

export interface HandStatFlags {
  vpip: boolean;
  pfr: boolean;
  threeBetOpp: boolean;
  threeBet: boolean;
  foldTo3BetOpp: boolean;
  foldTo3Bet: boolean;
  stealOpp: boolean;
  steal: boolean;
  bbVsStealOpp: boolean;
  bbFoldVsSteal: boolean;
  limp: boolean;
  sawFlop: boolean;
  cbetOpp: boolean;
  cbet: boolean;
  foldToCbetOpp: boolean;
  foldToCbet: boolean;
  wtsd: boolean;
  wonAtShowdown: boolean;
  wonWhenSawFlop: boolean;
  postBets: number;
  postRaises: number;
  postCalls: number;
  postChecks: number;
  postFolds: number;
}

export interface HandAnalysis {
  handId: string;
  date: string;
  heroPosition: Position;
  heroCards: [number, number];
  netBB: number;
  /** All-in adjusted net (only differs when hero was all-in before the river vs known cards). */
  evNetBB: number;
  wentToShowdown: boolean;
  bbSize: number;
  evLossBB: number;
  accuracy: number | null;
  decisions: Decision[];
  worst: Classification | null;
  stats: HandStatFlags;
  tableSize: number;
  gameType: 'cash' | 'tournament';
}
