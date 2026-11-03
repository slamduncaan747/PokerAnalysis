import type { Card } from '../cards.ts';
import type { Action, Hand, Player, Position, Street } from '../types.ts';

/**
 * Builds a consistent 6-max Hand from a compact script so drills can be graded by the
 * same engine that reviews real hands.
 *
 * Steps: "POS:action[:amount]" where amounts are big blinds preflop ("raise:2.5" = raise to 2.5bb)
 * and pot fractions postflop ("bet:0.66"); postflop raises are multiples of the bet ("raise:3").
 * Use "FLOP" / "TURN" / "RIVER" markers, "all-in" to shove, and "?" for the hero decision point.
 */
export interface SynthSpec {
  hero: Position;
  villain: Position;
  heroCards: [Card, Card];
  board: Card[]; // all 5 cards (only revealed as streets progress)
  script: string[];
  stackBB?: number;
}

const PRE: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const POST: Position[] = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];

export function buildSyntheticHand(spec: SynthSpec, id: string): { hand: Hand; decisionIndex: number } {
  const stack = spec.stackBB ?? 100;
  const names: Record<Position, string> = {} as Record<Position, string>;
  const players: Player[] = PRE.map((pos, i) => {
    const name = pos === spec.hero ? 'Hero' : pos === spec.villain ? 'Villain' : `P_${pos}`;
    names[pos] = name;
    return { seat: i + 1, name, stack, position: pos, isHero: pos === spec.hero, cards: pos === spec.hero ? spec.heroCards : undefined };
  });
  const actions: Action[] = [];
  const st = new Map<Position, { commit: number; stack: number; folded: boolean }>();
  for (const p of PRE) st.set(p, { commit: 0, stack, folded: false });
  let pot = 0;
  let currentBet = 0;
  let street: Street = 'preflop';
  const add = (pos: Position, type: Action['type'], amount: number, extra: Partial<Action> = {}) => {
    const s = st.get(pos)!;
    amount = Math.min(amount, s.stack);
    s.stack -= amount;
    s.commit += amount;
    pot += amount;
    currentBet = Math.max(currentBet, s.commit);
    actions.push({ street, player: names[pos], type, amount: r2(amount), toAmount: r2(s.commit), allIn: s.stack <= 1e-9, ...extra });
  };
  add('SB', 'post', 0.5, { postKind: 'sb' });
  add('BB', 'post', 1, { postKind: 'bb' });

  let order = PRE;
  let ptr = 0;
  let decisionIndex = -1;
  const advanceTo = (pos: Position) => {
    // Fold everyone (not hero/villain) between the pointer and pos.
    for (let guard = 0; guard < 12; guard++) {
      const cur = order[ptr % order.length];
      if (cur === pos) return;
      const s = st.get(cur)!;
      if (!s.folded && cur !== spec.hero && cur !== spec.villain) {
        s.folded = true;
        actions.push({ street, player: names[cur], type: 'fold', amount: 0, toAmount: s.commit, allIn: false });
      }
      ptr++;
    }
  };

  for (const step of spec.script) {
    if (step === 'FLOP' || step === 'TURN' || step === 'RIVER') {
      // Fold any remaining non-participants
      for (const p of PRE) {
        const s = st.get(p)!;
        if (!s.folded && p !== spec.hero && p !== spec.villain) {
          s.folded = true;
          actions.push({ street, player: names[p], type: 'fold', amount: 0, toAmount: s.commit, allIn: false });
        }
      }
      street = step.toLowerCase() as Street;
      for (const s of st.values()) s.commit = 0;
      currentBet = 0;
      order = POST;
      ptr = 0;
      continue;
    }
    const [posStr, act, amtStr] = step.split(':');
    const pos = posStr as Position;
    advanceTo(pos);
    const s = st.get(pos)!;
    if (act === '?') {
      decisionIndex = actions.length;
      const facing = currentBet - s.commit > 1e-9;
      actions.push({ street, player: names[pos], type: facing ? 'fold' : 'check', amount: 0, toAmount: s.commit, allIn: false });
      break;
    }
    const amt = amtStr === 'all-in' ? Infinity : parseFloat(amtStr ?? '0');
    switch (act) {
      case 'fold':
        s.folded = true;
        actions.push({ street, player: names[pos], type: 'fold', amount: 0, toAmount: s.commit, allIn: false });
        break;
      case 'check':
        actions.push({ street, player: names[pos], type: 'check', amount: 0, toAmount: s.commit, allIn: false });
        break;
      case 'call':
        add(pos, 'call', currentBet - s.commit);
        break;
      case 'bet': {
        const size = amt === Infinity ? s.stack : r2(pot * amt);
        add(pos, 'bet', size);
        break;
      }
      case 'raise': {
        const to = amt === Infinity ? s.commit + s.stack : street === 'preflop' ? amt : r2(currentBet * amt);
        add(pos, currentBet > 0 ? 'raise' : 'bet', to - s.commit);
        break;
      }
    }
    ptr++;
  }

  const hand: Hand = {
    id,
    site: 'Drill',
    gameType: 'cash',
    sb: 0.5,
    bb: 1,
    ante: 0,
    currency: '',
    date: '',
    table: 'Drill',
    maxSeats: 6,
    buttonSeat: 4,
    players,
    hero: 'Hero',
    heroCards: spec.heroCards,
    actions,
    board: spec.board,
    collected: {},
    uncalled: {},
    rake: 0,
    totalPot: pot,
    heroNet: 0,
    wentToShowdown: false,
    raw: '',
  };
  return { hand, decisionIndex };
}

const r2 = (x: number) => Math.round(x * 100) / 100;
