import type { Card } from './cards.ts';
import type { Action, Hand, Street } from './types.ts';

export interface SeatState {
  name: string;
  position: string;
  seat: number;
  stack: number;
  bet: number;
  folded: boolean;
  allIn: boolean;
  isHero: boolean;
  lastAction?: string;
  cards?: [Card, Card];
}

export interface TableState {
  street: Street | 'showdown';
  board: Card[];
  pot: number; // chips in the middle from previous streets
  totalPot: number; // including current street bets
  seats: SeatState[];
  actor?: string;
  final: boolean;
}

/** Step i = state after the i-th voluntary action (0 = hands dealt, blinds posted). Last step = result. */
export function buildSteps(hand: Hand): { actionIndex: number | null; label: string }[] {
  const steps: { actionIndex: number | null; label: string }[] = [{ actionIndex: null, label: 'Deal' }];
  hand.actions.forEach((a, i) => {
    if (a.type !== 'post') steps.push({ actionIndex: i, label: a.type });
  });
  steps.push({ actionIndex: null, label: 'Result' });
  return steps;
}

function actionText(a: Action, bb: number): string {
  const f = (x: number) => `${Math.round((x / bb) * 10) / 10}`;
  switch (a.type) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      return `Call ${f(a.amount)}`;
    case 'bet':
      return a.allIn ? `All-in ${f(a.toAmount)}` : `Bet ${f(a.toAmount)}`;
    case 'raise':
      return a.allIn ? `All-in ${f(a.toAmount)}` : `Raise ${f(a.toAmount)}`;
    default:
      return '';
  }
}

export function tableAt(hand: Hand, uptoActionIndex: number | 'final'): TableState {
  const seats: SeatState[] = hand.players.map((p) => ({
    name: p.name, position: p.position, seat: p.seat, stack: p.stack, bet: 0, folded: false, allIn: false, isHero: p.isHero,
    cards: p.isHero ? p.cards : undefined,
  }));
  const by = new Map(seats.map((s) => [s.name, s]));
  let street: Street = 'preflop';
  let pot = hand.splash ?? 0;
  const end = uptoActionIndex === 'final' ? hand.actions.length - 1 : uptoActionIndex;
  let actor: string | undefined;
  for (let i = 0; i <= end && i < hand.actions.length; i++) {
    const a = hand.actions[i];
    const s = by.get(a.player);
    if (a.street !== street) {
      for (const x of seats) {
        pot += x.bet;
        x.bet = 0;
        if (!x.folded) x.lastAction = undefined;
      }
      street = a.street;
    }
    if (!s) continue;
    if (a.type === 'post') {
      if (a.postKind === 'ante' || a.postKind === 'dead') pot += a.amount;
      else s.bet += a.amount;
      s.stack -= a.amount;
      continue;
    }
    actor = a.player;
    s.lastAction = actionText(a, hand.bb);
    if (a.type === 'fold') s.folded = true;
    else if (a.amount > 0) {
      s.bet += a.amount;
      s.stack -= a.amount;
    }
    if (a.allIn || s.stack <= 1e-9) s.allIn = true;
  }
  const final = uptoActionIndex === 'final';
  if (final) {
    for (const x of seats) {
      pot += x.bet;
      x.bet = 0;
    }
    // uncalled bets returned
    for (const [name, amt] of Object.entries(hand.uncalled)) {
      const s = by.get(name);
      if (s) s.stack += amt;
      pot -= amt;
    }
    for (const x of seats) {
      const p = hand.players.find((pp) => pp.name === x.name);
      if (p?.cards && !x.folded) x.cards = p.cards;
      const won = hand.collected[x.name];
      if (won) {
        x.stack += won;
        x.lastAction = `Wins ${Math.round((won / hand.bb) * 10) / 10}`;
      }
    }
  }
  const boardCount = final ? hand.board.length : street === 'flop' ? 3 : street === 'turn' ? 4 : street === 'river' ? 5 : 0;
  const totalPot = pot + seats.reduce((s, x) => s + x.bet, 0);
  return { street: final ? 'showdown' : street, board: hand.board.slice(0, boardCount), pot, totalPot, seats, actor, final };
}
