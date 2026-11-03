import { describe, expect, it } from 'vitest';
import { cardsToString } from '../cards.ts';
import { parseHandHistories, splitHands } from './index.ts';
import { ACR_CASH, COINPOKER_CASH, GG_CASH, IGNITION_CASH, STARS_CASH, STARS_TOURNEY, WINAMAX_CASH } from './fixtures.ts';

describe('splitHands', () => {
  it('splits a multi-hand file', () => {
    expect(splitHands(STARS_CASH)).toHaveLength(2);
    expect(splitHands(STARS_CASH + '\n\n' + GG_CASH + '\n' + IGNITION_CASH)).toHaveLength(4);
  });
});

describe('PokerStars cash', () => {
  const { hands, errors } = parseHandHistories(STARS_CASH);
  it('parses both hands without errors', () => {
    expect(errors).toEqual([]);
    expect(hands).toHaveLength(2);
  });
  it('extracts header, seats and positions', () => {
    const h = hands[0];
    expect(h.site).toBe('PokerStars');
    expect(h.sb).toBe(0.25);
    expect(h.bb).toBe(0.5);
    expect(h.currency).toBe('USD');
    expect(h.hero).toBe('Hero');
    expect(cardsToString(h.heroCards)).toBe('Ah Kd');
    expect(h.players.map((p) => `${p.name}:${p.position}`)).toEqual([
      'player1:HJ', 'Hero:CO', 'player3:BTN', 'player5:SB', 'player6:BB',
    ]);
    expect(cardsToString(h.board)).toBe('Kc 7d 2s 9h 3c');
  });
  it('computes amounts and net', () => {
    const h = hands[0];
    const heroActs = h.actions.filter((a) => a.player === 'Hero');
    expect(heroActs.map((a) => `${a.street}:${a.type}:${a.amount}:${a.toAmount}`)).toEqual([
      'preflop:raise:1.5:1.5', 'preflop:call:5.25:6.75', 'flop:raise:25.2:25.2', 'turn:bet:16.8:16.8',
    ]);
    expect(heroActs[3].allIn).toBe(true);
    expect(h.heroNet).toBeCloseTo(47.6, 2);
    expect(h.totalPot).toBe(99.25);
    expect(h.rake).toBe(2.9);
    expect(h.wentToShowdown).toBe(true);
    expect(h.players.find((p) => p.name === 'player6')?.cards).toBeDefined();
  });
  it('handles a preflop fold and an uncalled bet', () => {
    const h = hands[1];
    expect(h.heroNet).toBe(0);
    expect(h.players.find((p) => p.isHero)?.position).toBe('HJ');
    expect(h.uncalled.player3).toBe(1);
  });
});

describe('PokerStars tournament', () => {
  const { hands, errors } = parseHandHistories(STARS_TOURNEY);
  it('parses antes, levels and all-ins', () => {
    expect(errors).toEqual([]);
    const h = hands[0];
    expect(h.gameType).toBe('tournament');
    expect(h.bb).toBe(50);
    expect(h.ante).toBe(5);
    expect(h.currency).toBe('');
    expect(h.heroNet).toBe(1485);
    const jam = h.actions.find((a) => a.player === 'Hero' && a.type === 'raise')!;
    expect(jam.allIn).toBe(true);
    expect(jam.toAmount).toBe(1495);
    expect(h.players.find((p) => p.isHero)?.position).toBe('BB');
  });
});

describe('GGPoker', () => {
  it('parses GG exports', () => {
    const { hands, errors } = parseHandHistories(GG_CASH);
    expect(errors).toEqual([]);
    const h = hands[0];
    expect(h.site).toBe('GGPoker');
    expect(h.bb).toBe(0.1);
    expect(h.players.find((p) => p.isHero)?.position).toBe('BB');
    expect(h.heroNet).toBeCloseTo(0.44, 2);
    expect(h.wentToShowdown).toBe(false);
  });
});

describe('ACR / WPN', () => {
  it('parses lines without colons', () => {
    const { hands, errors } = parseHandHistories(ACR_CASH);
    expect(errors).toEqual([]);
    const h = hands[0];
    expect(h.site).toBe('ACR');
    expect(h.bb).toBe(0.1);
    expect(h.players.find((p) => p.isHero)?.position).toBe('SB');
    expect(h.heroNet).toBeCloseTo(0.92, 2);
    const threeBet = h.actions.find((a) => a.player === 'Hero' && a.type === 'raise');
    expect(threeBet?.toAmount).toBe(0.9);
    expect(threeBet?.amount).toBeCloseTo(0.85, 5);
  });
});

describe('Winamax', () => {
  it('parses euro amounts and infers uncalled bets', () => {
    const { hands, errors } = parseHandHistories(WINAMAX_CASH);
    expect(errors).toEqual([]);
    const h = hands[0];
    expect(h.site).toBe('Winamax');
    expect(h.currency).toBe('EUR');
    expect(h.bb).toBe(0.02);
    expect(h.uncalled.Hero).toBe(0.2);
    expect(h.heroNet).toBeCloseTo(0.13, 2);
  });
});

describe('Ignition', () => {
  it('parses anonymous tables', () => {
    const { hands, errors } = parseHandHistories(IGNITION_CASH);
    expect(errors).toEqual([]);
    const h = hands[0];
    expect(h.site).toBe('Ignition');
    expect(h.hero).toBe('Big Blind');
    expect(h.bb).toBe(0.25);
    expect(h.players.find((p) => p.isHero)?.position).toBe('BB');
    expect(cardsToString(h.heroCards)).toBe('Th Qh');
    expect(h.heroNet).toBeCloseTo(1.96, 2);
    expect(h.rake).toBeCloseTo(0.14, 2);
  });
});

describe('CoinPoker', () => {
  const r = parseHandHistories(COINPOKER_CASH);
  const [splash, straddle, rit] = r.hands;
  const balance = (h: (typeof r.hands)[number]) => {
    const putIn = h.actions.reduce((s, a) => s + a.amount, 0);
    const unc = Object.values(h.uncalled).reduce((s, x) => s + x, 0);
    const coll = Object.values(h.collected).reduce((s, x) => s + x, 0);
    return { pot: putIn - unc + (h.splash ?? 0), paid: coll + h.rake };
  };
  it('reads NLH hands with USDT amounts and skips other games', () => {
    expect(r.errors).toEqual([]);
    expect(r.hands).toHaveLength(3);
    expect(r.skipped).toBe(1); // the PLO hand
    expect(splash.site).toBe('CoinPoker');
    expect(splash.currency).toBe('USDT');
    expect(splash.sb).toBe(0.1);
    expect(splash.bb).toBe(0.25);
    expect(splash.hero).toBe('Hero');
    expect(cardsToString(splash.heroCards)).toBe('Ah Ad');
    expect(splash.players.find((p) => p.isHero)?.position).toBe('CO');
  });
  it('turns ALLIN (chips added) into the right bet/call/raise', () => {
    const ai = splash.actions.find((a) => a.player === '0a1b2c3d' && a.allIn && a.street === 'flop')!;
    expect(ai.type).toBe('raise');
    expect(ai.amount).toBeCloseTo(7.37, 5);
    expect(ai.toAmount).toBeCloseTo(7.37, 5);
    const call = splash.actions.find((a) => a.player === 'Hero' && a.street === 'flop' && a.type === 'call')!;
    expect(call.toAmount).toBeCloseTo(7.37, 5);
  });
  it('credits the splash to the winner and balances the money', () => {
    expect(splash.splash).toBe(1);
    expect(splash.rake).toBeCloseTo(0.62, 5);
    expect(splash.collected.Hero).toBeCloseTo(16.48, 2);
    expect(splash.heroNet).toBeCloseTo(8.48, 2);
    for (const h of r.hands) {
      const b = balance(h);
      expect(b.pot).toBeCloseTo(h.totalPot, 2);
      expect(b.paid).toBeCloseTo(h.totalPot, 2);
    }
  });
  it('handles STRADDLE, RETURN and auto big blinds', () => {
    const st = straddle.actions.find((a) => a.player === '11aa22bb' && a.type === 'post')!;
    expect(st.postKind).toBe('straddle');
    expect(st.amount).toBe(0.5);
    expect(straddle.uncalled['11aa22bb']).toBe(0.25);
    expect(straddle.actions.find((a) => a.player === '33cc44dd' && a.type === 'post')?.amount).toBe(0.25);
    expect(straddle.players.find((p) => p.name === '99cc00dd')?.position).toBe('BB');
    expect(straddle.heroNet).toBe(0);
  });
  it('handles run it twice: first board, both payouts', () => {
    expect(cardsToString(rit.board)).toBe('Ah 9c 4d 2s 8h');
    expect(rit.collected.Hero).toBeCloseTo(19.55, 2);
    expect(rit.heroNet).toBeCloseTo(-0.45, 2);
    expect(rit.wentToShowdown).toBe(true);
    expect(rit.players.find((p) => p.name === '77aa88bb')?.cards).toBeDefined();
  });
});

describe('robustness', () => {
  it('skips non-holdem and reports errors without throwing', () => {
    const omaha = `PokerStars Hand #1: Omaha Pot Limit ($0.25/$0.50 USD) - 2023/03/15 21:30:45 ET\nTable 'x' 6-max Seat #1 is the button\n`;
    const broken = `PokerStars Hand #2: Hold'em No Limit ($0.25/$0.50 USD) - 2023/03/15 21:30:45 ET\nTable 'x' 6-max Seat #1 is the button\n`;
    const r = parseHandHistories(omaha + '\n' + broken);
    expect(r.hands).toHaveLength(0);
    expect(r.skipped).toBe(1);
    expect(r.errors).toHaveLength(1);
  });
});
