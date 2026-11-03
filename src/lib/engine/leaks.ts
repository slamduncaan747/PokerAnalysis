import type { LeakId } from './types.ts';

export type DrillType =
  | 'rfi'
  | 'vs_open'
  | 'bb_defense'
  | 'vs_3bet'
  | 'vs_limp'
  | 'allin'
  | 'pot_odds'
  | 'bluffcatch'
  | 'value'
  | 'bluff'
  | 'draws';

export interface LeakInfo {
  id: LeakId;
  title: string;
  group: 'Preflop' | 'Postflop';
  description: string;
  fix: string[];
  drill: DrillType;
}

export const LEAKS: Record<LeakId, LeakInfo> = {
  pf_open_loose: {
    id: 'pf_open_loose', group: 'Preflop', title: 'Opening too many hands', drill: 'rfi',
    description: 'You raise first-in with hands that are below the profitable opening threshold for your position, mostly from early seats.',
    fix: [
      'Approximate opening widths (6-max, 100bb): UTG ~18%, HJ ~22%, CO ~28%, BTN ~44%, SB ~38%.',
      'Offsuit broadways and weak offsuit aces are the usual culprits from early position — fold them.',
      'Open wider only when it is folded to you on the button/cutoff.',
    ],
  },
  pf_open_tight: {
    id: 'pf_open_tight', group: 'Preflop', title: 'Folding profitable opens', drill: 'rfi',
    description: 'You fold hands that are clear opens when the action is folded to you — this leaks blinds you should be stealing.',
    fix: ['When folded to you in late position, raise every hand in the chart — suited aces, suited connectors and broadways all print.', 'A missed steal costs a little every time; across thousands of hands it adds up.'],
  },
  pf_limp: {
    id: 'pf_limp', group: 'Preflop', title: 'Open-limping', drill: 'rfi',
    description: 'You limp into unopened pots instead of raising or folding.',
    fix: ['When first in, raise or fold. Limping gives up the chance to win the blinds and invites isolation raises.', 'If a hand is too weak to raise, it is too weak to limp.'],
  },
  pf_vs_limp: {
    id: 'pf_vs_limp', group: 'Preflop', title: 'Playing against limpers', drill: 'vs_limp',
    description: 'Your iso-raising / over-limping choices against limpers deviate from a solid baseline.',
    fix: ['Iso-raise strong hands to ~4bb + 1bb per limper to play heads-up in position.', 'Over-limp only with small pairs and suited hands that play well multiway.'],
  },
  pf_cold_call_loose: {
    id: 'pf_cold_call_loose', group: 'Preflop', title: 'Cold-calling opens too wide', drill: 'vs_open',
    description: 'You call raises with hands outside your continuing range, leaving you dominated and exposed to squeezes.',
    fix: ['Versus early-position opens, continue with pairs, strong suited broadways and AQ+ only.', 'Prefer 3-bet-or-fold from the small blind.', 'Offsuit hands like KTo, QJo, A9o are folds against most opens.'],
  },
  pf_flat_3bet_hands: {
    id: 'pf_flat_3bet_hands', group: 'Preflop', title: 'Flatting hands that should re-raise', drill: 'vs_open',
    description: 'You just call with premium hands that make more money re-raising (QQ+, AK, strong broadways vs late opens).',
    fix: ['3-bet your value hands: they get called by worse and deny equity.', 'Balance with suited-ace bluffs (A5s–A2s) that block strong hands.'],
  },
  pf_fold_vs_open: {
    id: 'pf_fold_vs_open', group: 'Preflop', title: 'Over-folding against opens', drill: 'vs_open',
    description: 'You fold hands that are profitable continues against a raise.',
    fix: ['Against late-position opens, defend wider: pairs, suited aces, suited broadways and connectors.'],
  },
  pf_bb_defense: {
    id: 'pf_bb_defense', group: 'Preflop', title: 'Under-defending the big blind', drill: 'bb_defense',
    description: 'You fold too often in the big blind. You already have 1bb invested, so you get a great price to defend.',
    fix: [
      'Versus a 2.5x BTN open you need only ~27% equity: defend roughly 55–65% of hands.',
      'Suited hands, connectors and most offsuit broadways are defends vs late-position steals.',
    ],
  },
  pf_3bet_light: {
    id: 'pf_3bet_light', group: 'Preflop', title: '3-betting too light', drill: 'vs_open',
    description: 'You re-raise with hands that are better as calls or folds, turning them into bluffs that get called by better.',
    fix: ['Pick 3-bet bluffs that block premiums (Ax suited) or play well when called (suited connectors) — not offsuit junk.'],
  },
  pf_vs3bet_loose: {
    id: 'pf_vs3bet_loose', group: 'Preflop', title: 'Calling 3-bets too wide', drill: 'vs_3bet',
    description: 'You continue against 3-bets with hands that are dominated by the 3-bettor’s range, often out of position.',
    fix: ['Versus a 3-bet, continue with roughly the top third of your opening range.', 'Offsuit broadways (KJo, QJo, ATo) and weak pairs out of position are folds.'],
  },
  pf_vs3bet_tight: {
    id: 'pf_vs3bet_tight', group: 'Preflop', title: 'Over-folding to 3-bets', drill: 'vs_3bet',
    description: 'You fold too much against 3-bets, letting opponents 3-bet you with any two cards.',
    fix: ['Defend strong pairs, AQ+, and good suited broadways — especially in position.'],
  },
  pf_4bet_pots: {
    id: 'pf_4bet_pots', group: 'Preflop', title: '4-bet pot mistakes', drill: 'vs_3bet',
    description: 'Errors in big preflop pots (4-bets and 5-bet jams).',
    fix: ['At 100bb, 4-bet pots are mostly QQ+/AK for value plus a few blocker bluffs. Fold the rest.'],
  },
  pf_allin: {
    id: 'pf_allin', group: 'Preflop', title: 'Preflop all-in decisions', drill: 'allin',
    description: 'You call or shove all-in preflop when the math says otherwise.',
    fix: ['Compare your equity vs the shover’s range to the price. Tight ranges crush hands like AJ and small pairs.'],
  },
  pos_missed_value: {
    id: 'pos_missed_value', group: 'Postflop', title: 'Missing value with strong hands', drill: 'value',
    description: 'You check or just call with strong hands when betting or raising makes much more money.',
    fix: [
      'If worse hands can call, bet. Strong hands win the most when the pot gets big.',
      'On the river, bet your strong hands — checking them back is the most common missed-value spot.',
    ],
  },
  pos_overbluff: {
    id: 'pos_overbluff', group: 'Postflop', title: 'Bluffing into strength', drill: 'bluff',
    description: 'You bet or raise weak hands into ranges that rarely fold.',
    fix: ['Bluff when your opponent’s range is capped (they checked or called a lot) — not when they’ve shown strength.', 'Multiway pots need much stronger hands to bet; bluff far less.'],
  },
  pos_missed_bluff: {
    id: 'pos_missed_bluff', group: 'Postflop', title: 'Missing profitable bluffs', drill: 'bluff',
    description: 'You give up with hands that would win the pot often enough by betting.',
    fix: ['When villain shows weakness and your hand has little showdown value, a bet often prints.', 'Choose bluffs with blockers or backdoor equity.'],
  },
  pos_call_loose: {
    id: 'pos_call_loose', group: 'Postflop', title: 'Calling down too light', drill: 'bluffcatch',
    description: 'You call bets without enough equity — especially on later streets where ranges are strong.',
    fix: ['Compare your equity to the price: a pot-sized bet needs 33%, a half-pot bet 25%.', 'River bets from most players are value-heavy; fold weak bluff-catchers.'],
  },
  pos_overfold: {
    id: 'pos_overfold', group: 'Postflop', title: 'Over-folding to bets', drill: 'bluffcatch',
    description: 'You fold hands that have enough equity to call.',
    fix: ['If your equity beats the pot odds, continue — especially against small bets.'],
  },
  pos_thin_value: {
    id: 'pos_thin_value', group: 'Postflop', title: 'Betting/raising too thin', drill: 'value',
    description: 'You bet or raise medium-strength hands that only get called by better.',
    fix: ['Medium hands prefer pot control: check or call, and save raises for strong hands and good bluffs.'],
  },
  pos_passive_draws: {
    id: 'pos_passive_draws', group: 'Postflop', title: 'Playing draws too passively', drill: 'draws',
    description: 'You check/call strong draws that play best as semi-bluffs.',
    fix: ['Strong draws (flush draws, open-enders) can bet or raise: fold equity + outs make aggression profitable.'],
  },
  pos_sizing: {
    id: 'pos_sizing', group: 'Postflop', title: 'Bet sizing', drill: 'value',
    description: 'Right action, wrong size — a different size would have made more.',
    fix: ['Size up with strong hands vs. sticky ranges; size down when only worse hands call small.'],
  },
};

export const DRILL_INFO: Record<DrillType, { title: string; blurb: string }> = {
  rfi: { title: 'Opening ranges', blurb: 'Folded to you — raise or fold?' },
  vs_open: { title: 'Facing an open', blurb: 'Fold, call or 3-bet against a raise.' },
  bb_defense: { title: 'Big blind defense', blurb: 'Defend your big blind vs steals.' },
  vs_3bet: { title: 'Facing 3-bets', blurb: 'You opened and got 3-bet.' },
  vs_limp: { title: 'Versus limpers', blurb: 'Iso-raise, over-limp or fold.' },
  allin: { title: 'Preflop all-ins', blurb: 'Call or fold vs a shove.' },
  pot_odds: { title: 'Pot odds', blurb: 'How much equity do you need?' },
  bluffcatch: { title: 'Bluff-catching', blurb: 'Facing river bets with medium hands.' },
  value: { title: 'Value betting', blurb: 'Get paid with strong hands.' },
  bluff: { title: 'Bluffing', blurb: 'Pick good spots to bet weak hands.' },
  draws: { title: 'Playing draws', blurb: 'Semi-bluff, call or fold with draws.' },
};
