import { COMBOS, type Card, comboIndex } from '../cards.ts';
import { assignPreflopRange, narrowRange, type PState } from '../engine/analyze.ts';
import { rangeFromSpec, type Range } from '../engine/ranges.ts';
import { boardStrength } from '../engine/strength.ts';
import type { Hand, Position, Street } from '../types.ts';

/**
 * Turns a hero decision from a real hand into a heads-up spot for the GTO solver:
 * both players' ranges at the start of the street (modeled from preflop charts and
 * their earlier actions), pot, effective stack, board and the exact action line.
 */

import { SCALE, toSolverCard, type SolverAction } from './common.ts';

export { SCALE, fromSolverCard, toSolverCard, type SolverAction } from './common.ts';

export interface SolverSpot {
  street: Street;
  board: Card[];
  oop: { pos: Position | string; isHero: boolean; cards: number[]; weights: number[] };
  ip: { pos: Position | string; isHero: boolean; cards: number[]; weights: number[] };
  heroIsOop: boolean;
  heroCards?: [Card, Card];
  potStart: number;
  effStack: number;
  /** Street actions before the hero decision. */
  before: SolverAction[];
  /** The hero's actual action (added to the tree so its exact size is analysed). */
  heroAction?: SolverAction;
  bb: number;
  /** Bet sizes per street; `raises` applies to the solved street, `laterRaises` (if set) to later streets. */
  sizes: { flop: string; turn: string; river: string; raises: string; laterRaises?: string };
  maxIterations: number;
  targetPct: number;
}

const POST_ORDER: Position[] = ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'LJ', 'HJ', 'CO', 'BTN'];


export function buildSolverSpot(hand: Hand, actionIndex: number): { spot?: SolverSpot; reason?: string } {
  const target = hand.actions[actionIndex];
  if (!target || target.player !== hand.hero) return { reason: 'Not a hero decision.' };
  if (target.street === 'preflop') return { reason: 'The solver handles postflop spots (flop, turn and river).' };
  const bb = hand.bb;
  const tableSize = hand.players.length;
  const P = new Map<string, PState>();
  for (const p of hand.players)
    P.set(p.name, { name: p.name, pos: p.position, stack: p.stack, commit: 0, totalIn: 0, folded: false, allIn: false, isHero: p.isHero, range: rangeFromSpec('any'), pfLine: [] });

  let street: Street = 'preflop';
  let pot = 0;
  let currentBet = 0;
  let raiseLevel = 0;
  let limpers = 0;
  let openerPos: Position | null = null;
  let opener: string | null = null;
  let threeBettor: string | null = null;
  let streetStart = -1;

  for (let i = 0; i < hand.actions.length; i++) {
    const a = hand.actions[i];
    if (a.street !== street) {
      street = a.street;
      for (const q of P.values()) q.commit = 0;
      currentBet = 0;
    }
    if (a.street === target.street) {
      streetStart = i;
      break;
    }
    const p = P.get(a.player);
    if (!p) continue;
    if (a.type !== 'post') {
      if (street === 'preflop') assignPreflopRange(p, a, { raiseLevel, limpers, openerPos, opener, threeBettor, P, bb, tableSize });
      else if (a.type !== 'fold') {
        const board = hand.board.slice(0, street === 'flop' ? 3 : street === 'turn' ? 4 : 5);
        const sizeFrac = a.type === 'bet' || a.type === 'raise' ? (a.toAmount - p.commit) / Math.max(pot + (currentBet - p.commit), 1e-9) : 0;
        narrowRange(p.range, boardStrength(board), a.type, sizeFrac, street, currentBet > p.commit);
      }
    }
    pot += a.amount;
    p.stack -= a.amount;
    if (a.type === 'fold') p.folded = true;
    if (a.type === 'post' && (a.postKind === 'ante' || a.postKind === 'dead')) continue;
    if (a.type !== 'fold' && a.type !== 'check') p.commit = a.toAmount;
    if (a.type === 'call' && street === 'preflop') {
      if (raiseLevel === 0) limpers++;
    }
    if (a.type === 'bet' || a.type === 'raise') {
      currentBet = Math.max(currentBet, a.toAmount);
      if (street === 'preflop') {
        raiseLevel++;
        if (raiseLevel === 1) {
          opener = p.name;
          openerPos = p.pos;
        } else if (raiseLevel === 2) threeBettor = p.name;
      }
    }
    if (p.stack <= 1e-9) p.allIn = true;
  }
  if (streetStart < 0) return { reason: 'Could not locate the street start.' };
  const alive = [...P.values()].filter((q) => !q.folded);
  if (alive.length !== 2) return { reason: `The solver handles heads-up pots; this one is ${alive.length}-way.` };
  if (alive.some((q) => q.stack <= 1e-9)) return { reason: 'A player was already all-in before this street.' };
  const hero = alive.find((q) => q.isHero)!;
  const vill = alive.find((q) => !q.isHero)!;
  const heroIsOop = POST_ORDER.indexOf(hero.pos) < POST_ORDER.indexOf(vill.pos);
  const sc = (chips: number) => Math.round((chips / bb) * SCALE);
  const effStack = Math.min(sc(hero.stack), sc(vill.stack));
  const potStart = sc(pot);
  if (potStart <= 0 || effStack <= 0) return { reason: 'Nothing left to play for.' };

  const board = hand.board.slice(0, target.street === 'flop' ? 3 : target.street === 'turn' ? 4 : 5);
  // Encode the street's actions.
  const enc = (i: number): SolverAction => {
    const a = hand.actions[i];
    const to = Math.min(sc(a.toAmount), effStack);
    switch (a.type) {
      case 'fold':
        return { kind: 0, to: 0 };
      case 'check':
        return { kind: 1, to: 0 };
      case 'call':
        return { kind: 2, to: 0 };
      case 'bet':
        return { kind: to >= effStack ? 5 : 3, to };
      default:
        return { kind: to >= effStack ? 5 : 4, to };
    }
  };
  const before: SolverAction[] = [];
  for (let i = streetStart; i < actionIndex; i++) {
    const a = hand.actions[i];
    if (a.type === 'post') continue;
    if (!P.has(a.player) || P.get(a.player)!.folded) continue;
    before.push(enc(i));
  }

  const dead = new Set(board);
  const flop = target.street === 'flop';
  // Prune negligible combos (and cap flop ranges) to keep solves fast enough for a browser tab.
  const minW = flop ? 0.1 : target.street === 'turn' ? 0.03 : 0.005;
  const cap = flop ? 200 : target.street === 'turn' ? 480 : 1326;
  const toLists = (r: Range, ensure?: [Card, Card]) => {
    const ensureIdx = ensure ? comboIndex(ensure[0], ensure[1]) : -1;
    const items: [number, number][] = [];
    for (let i = 0; i < 1326; i++) {
      let w = r[i];
      if (i === ensureIdx) w = Math.max(w, 0.05);
      if (w < minW && i !== ensureIdx) continue;
      const [a, b] = COMBOS[i];
      if (dead.has(a) || dead.has(b)) continue;
      items.push([i, Math.min(1, w)]);
    }
    items.sort((x, y) => (y[0] === ensureIdx ? 1 : 0) - (x[0] === ensureIdx ? 1 : 0) || y[1] - x[1]);
    const cards: number[] = [];
    const weights: number[] = [];
    for (const [i, w] of items.slice(0, cap)) {
      const [a, b] = COMBOS[i];
      cards.push(toSolverCard(a), toSolverCard(b));
      weights.push(w);
    }
    return { cards, weights };
  };
  // Remove hero's cards from villain's range (card removal) and vice versa is handled by the solver.
  const heroL = toLists(hero.range, hand.heroCards);
  const villL = toLists(vill.range);
  const oop = heroIsOop ? { pos: hero.pos, isHero: true, ...heroL } : { pos: vill.pos, isHero: false, ...villL };
  const ip = heroIsOop ? { pos: vill.pos, isHero: false, ...villL } : { pos: hero.pos, isHero: true, ...heroL };
  return {
    spot: {
      street: target.street,
      board,
      oop,
      ip,
      heroIsOop,
      heroCards: hand.heroCards,
      potStart,
      effStack,
      before,
      heroAction: enc(actionIndex),
      bb,
      // Tree sizes: richer on the street being analysed, lean on later streets (they repeat per runout).
      sizes:
        target.street === 'flop'
          ? { flop: '50%', turn: '75%', river: '75%', raises: '3x', laterRaises: '' }
          : target.street === 'turn'
            ? { flop: '50%', turn: '33%, 75%', river: '75%', raises: '3x' }
            : { flop: '50%', turn: '75%', river: '33%, 75%, 150%', raises: '3x' },
      maxIterations: target.street === 'flop' ? 60 : target.street === 'turn' ? 200 : 400,
      targetPct: target.street === 'flop' ? 2.5 : target.street === 'turn' ? 1 : 0.5,
    },
  };
}
