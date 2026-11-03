import type { Card } from '../cards.ts';
import type { Action, ActionType, Hand, Player, Position, PostKind, Street } from '../types.ts';

/**
 * Site-independent accumulator. Site parsers feed raw events in; `finish()` computes
 * per-street commitments, positions, hero net result, etc.
 */
export interface RawSeat {
  seat: number;
  name: string;
  stack: number;
  sittingOut: boolean;
}

export type RawAction =
  | { kind: 'post'; player: string; post: PostKind; amount: number; allIn?: boolean; /** live portion for "small & big blinds" */ live?: number }
  | { kind: 'fold' | 'check'; player: string }
  | { kind: 'call' | 'bet'; player: string; amount: number; allIn?: boolean }
  | { kind: 'raise'; player: string; to: number; allIn?: boolean }
  /** Ambiguous all-in (Ignition "All-in $3"): total chips added this action. */
  | { kind: 'allin'; player: string; amount: number }
  | { kind: 'street'; street: Street; cards: Card[] };

export class HandBuilder {
  id = '';
  site = '';
  gameType: 'cash' | 'tournament' = 'cash';
  tournamentId?: string;
  sb = 0;
  bb = 0;
  ante = 0;
  currency = '';
  date = '';
  table = '';
  maxSeats = 0;
  buttonSeat = 0;
  seats: RawSeat[] = [];
  hero = '';
  heroCards: Card[] = [];
  events: RawAction[] = [];
  shown: Record<string, Card[]> = {};
  collected: Record<string, number> = {};
  uncalled: Record<string, number> = {};
  rake = 0;
  totalPot = 0;
  /** Money added to the pot by the site (CoinPoker "splash"). */
  splash = 0;
  raw = '';

  addCollected(name: string, amt: number) {
    this.collected[name] = (this.collected[name] ?? 0) + amt;
  }

  finish(): Hand {
    if (!this.hero || this.heroCards.length !== 2) throw new Error('No hero hole cards found');
    if (!this.bb) throw new Error('Could not determine big blind');

    const activeNames = new Set<string>();
    for (const e of this.events) if (e.kind !== 'street') activeNames.add(e.player);
    activeNames.add(this.hero);
    const active = this.seats
      .filter((s) => activeNames.has(s.name) || !s.sittingOut)
      .filter((s) => activeNames.has(s.name))
      .sort((a, b) => a.seat - b.seat);
    if (active.length < 2) throw new Error('Fewer than two players in hand');

    const positions = assignPositions(active, this.buttonSeat, this.events);

    // Replay to compute amounts.
    const actions: Action[] = [];
    let street: Street = 'preflop';
    let commit: Record<string, number> = {};
    let currentBet = 0;
    const board: Card[] = [];
    const totalIn: Record<string, number> = {};
    const stackLeft: Record<string, number> = {};
    for (const s of active) stackLeft[s.name] = s.stack;
    const folded = new Set<string>();
    const put = (p: string, amt: number) => {
      totalIn[p] = (totalIn[p] ?? 0) + amt;
      stackLeft[p] = (stackLeft[p] ?? 0) - amt;
    };
    const near0 = (x: number) => Math.abs(x) < 1e-6;

    for (const e of this.events) {
      if (e.kind === 'street') {
        if (e.street !== street) {
          street = e.street;
          commit = {};
          currentBet = 0;
        }
        for (const c of e.cards) if (!board.includes(c) && board.length < 5) board.push(c);
        continue;
      }
      const p = e.player;
      const prev = commit[p] ?? 0;
      switch (e.kind) {
        case 'post': {
          const live = e.post === 'ante' || e.post === 'dead' ? 0 : (e.live ?? e.amount);
          commit[p] = prev + live;
          currentBet = Math.max(currentBet, commit[p]);
          put(p, e.amount);
          actions.push({ street, player: p, type: 'post', amount: e.amount, toAmount: commit[p], allIn: !!e.allIn || near0(stackLeft[p]), postKind: e.post });
          break;
        }
        case 'fold':
          folded.add(p);
          actions.push({ street, player: p, type: 'fold', amount: 0, toAmount: prev, allIn: false });
          break;
        case 'check':
          actions.push({ street, player: p, type: 'check', amount: 0, toAmount: prev, allIn: false });
          break;
        case 'call': {
          commit[p] = prev + e.amount;
          put(p, e.amount);
          actions.push({ street, player: p, type: 'call', amount: e.amount, toAmount: commit[p], allIn: !!e.allIn || near0(stackLeft[p]) });
          break;
        }
        case 'bet': {
          // Some sites print a "bet" when a preflop limper completes; treat bet facing a bet as raise.
          const type: ActionType = currentBet > prev + 1e-9 ? 'raise' : 'bet';
          commit[p] = prev + e.amount;
          currentBet = Math.max(currentBet, commit[p]);
          put(p, e.amount);
          actions.push({ street, player: p, type, amount: e.amount, toAmount: commit[p], allIn: !!e.allIn || near0(stackLeft[p]) });
          break;
        }
        case 'raise': {
          const amt = e.to - prev;
          const type: ActionType = currentBet > 1e-9 ? 'raise' : 'bet';
          commit[p] = e.to;
          currentBet = Math.max(currentBet, e.to);
          put(p, amt);
          actions.push({ street, player: p, type, amount: amt, toAmount: e.to, allIn: !!e.allIn || near0(stackLeft[p]) });
          break;
        }
        case 'allin': {
          const to = prev + e.amount;
          let type: ActionType;
          if (to <= currentBet + 1e-9) type = 'call';
          else type = currentBet > 1e-9 ? 'raise' : 'bet';
          commit[p] = to;
          currentBet = Math.max(currentBet, to);
          put(p, e.amount);
          actions.push({ street, player: p, type, amount: e.amount, toAmount: to, allIn: true });
          break;
        }
      }
    }

    // Some sites don't print "Uncalled bet ... returned". Infer it from the final street:
    // the excess of the biggest commitment over the next biggest is returned.
    if (Object.keys(this.uncalled).length === 0) {
      const lastStreet = actions.length ? actions[actions.length - 1].street : 'preflop';
      const finalCommit: Record<string, number> = {};
      for (const a of actions) if (a.street === lastStreet && a.type !== 'post') finalCommit[a.player] = a.toAmount;
      for (const a of actions) if (a.street === lastStreet && a.type === 'post' && a.postKind !== 'ante' && a.postKind !== 'dead') finalCommit[a.player] = Math.max(finalCommit[a.player] ?? 0, a.toAmount);
      const sorted = Object.entries(finalCommit).sort((x, y) => y[1] - x[1]);
      if (sorted.length >= 1) {
        const [top, topAmt] = sorted[0];
        const second = sorted[1]?.[1] ?? 0;
        if (topAmt - second > 1e-6) this.uncalled[top] = round2(topAmt - second);
      }
    }

    const players: Player[] = active.map((s) => ({
      seat: s.seat,
      name: s.name,
      stack: s.stack,
      position: positions.get(s.name)!,
      isHero: s.name === this.hero,
      cards: s.name === this.hero
        ? (this.heroCards.slice(0, 2) as [Card, Card])
        : this.shown[s.name]?.length === 2 ? (this.shown[s.name] as [Card, Card]) : undefined,
    }));

    // CoinPoker leaves the splash out of the winners' "collected" lines (the stack in the next hand
    // shows the winner received it), so credit it to the winners in proportion to what they collected.
    if (this.splash > 0) {
      const won = Object.entries(this.collected).filter(([, v]) => v > 0);
      const tot = won.reduce((s, [, v]) => s + v, 0);
      for (const [name, v] of won) this.collected[name] = round2(v + (this.splash * v) / tot);
    }

    const heroIn = totalIn[this.hero] ?? 0;
    const heroBack = (this.collected[this.hero] ?? 0) + (this.uncalled[this.hero] ?? 0);
    const heroNet = round2(heroBack - heroIn);
    const remaining = active.filter((s) => !folded.has(s.name));
    const wentToShowdown = remaining.length >= 2 && !folded.has(this.hero);

    let totalPot = this.totalPot;
    if (!totalPot) {
      const sumIn = Object.values(totalIn).reduce((a, b) => a + b, 0);
      const sumUncalled = Object.values(this.uncalled).reduce((a, b) => a + b, 0);
      totalPot = round2(sumIn - sumUncalled + this.splash);
    }
    let rake = this.rake;
    if (!rake && this.site === 'Ignition') {
      const sumCollected = Object.values(this.collected).reduce((a, b) => a + b, 0);
      rake = Math.max(0, round2(totalPot - sumCollected));
    }

    return {
      id: `${this.site}-${this.id}`,
      site: this.site,
      gameType: this.gameType,
      tournamentId: this.tournamentId,
      sb: this.sb,
      bb: this.bb,
      ante: this.ante,
      currency: this.currency,
      date: this.date,
      table: this.table,
      maxSeats: this.maxSeats || Math.max(active.length, 2),
      buttonSeat: this.buttonSeat,
      players,
      hero: this.hero,
      heroCards: this.heroCards.slice(0, 2) as [Card, Card],
      actions,
      board,
      collected: this.collected,
      uncalled: this.uncalled,
      rake,
      totalPot,
      splash: this.splash || undefined,
      heroNet,
      wentToShowdown,
      raw: this.raw,
    };
  }
}

export const round2 = (x: number) => Math.round(x * 100) / 100;

const MIDDLE_NAMES: Record<number, Position[]> = {
  0: [],
  1: ['CO'],
  2: ['HJ', 'CO'],
  3: ['UTG', 'HJ', 'CO'],
  4: ['UTG', 'LJ', 'HJ', 'CO'],
  5: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  6: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
  7: ['UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'LJ', 'HJ', 'CO'],
};

function assignPositions(active: RawSeat[], buttonSeat: number, events: RawAction[]): Map<string, Position> {
  const map = new Map<string, Position>();
  const n = active.length;
  // Find the SB / BB posters to anchor the order when the button seat is dead or missing.
  const sbPoster = events.find((e) => e.kind === 'post' && e.post === 'sb') as { player: string } | undefined;
  const bbPoster = events.find((e) => e.kind === 'post' && e.post === 'bb') as { player: string } | undefined;

  let startIdx = active.findIndex((s) => s.seat > buttonSeat);
  if (startIdx < 0) startIdx = 0;
  let order = [...active.slice(startIdx), ...active.slice(0, startIdx)];
  // order[0] should be SB (n>=3) – re-anchor on posters if inconsistent.
  if (n >= 3) {
    const anchor = sbPoster?.player ?? null;
    const bbAnchor = bbPoster?.player ?? null;
    if (anchor && order[0].name !== anchor) {
      const i = order.findIndex((s) => s.name === anchor);
      if (i >= 0) order = [...order.slice(i), ...order.slice(0, i)];
    } else if (!anchor && bbAnchor && order[1]?.name !== bbAnchor) {
      const i = order.findIndex((s) => s.name === bbAnchor);
      if (i >= 0) {
        const j = (i - 1 + n) % n;
        order = [...order.slice(j), ...order.slice(0, j)];
      }
    }
  }

  if (n === 2) {
    // Heads-up: button posts the small blind.
    const btn = sbPoster?.player ?? order[1].name;
    for (const s of active) map.set(s.name, s.name === btn ? 'BTN' : 'BB');
    return map;
  }
  map.set(order[0].name, 'SB');
  map.set(order[1].name, 'BB');
  map.set(order[n - 1].name, 'BTN');
  const mids = MIDDLE_NAMES[Math.min(n - 3, 7)] ?? MIDDLE_NAMES[7];
  const middle = order.slice(2, n - 1);
  // If more than 10 handed (rare), extra early seats get UTG.
  const offset = middle.length - mids.length;
  middle.forEach((s, i) => map.set(s.name, i - offset >= 0 ? mids[i - offset] : 'UTG'));
  return map;
}
