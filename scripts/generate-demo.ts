/**
 * Generates realistic PokerStars-format hand histories for the demo dataset.
 * Five reasonable bots + a "Hero" with deliberate, recognisable leaks:
 *   - opens too wide from early position and limps sometimes
 *   - flats 3-bets too wide, folds the big blind too much
 *   - misses value with strong hands, calls rivers too light, over-bluffs some rivers
 *
 * Usage: node --experimental-strip-types scripts/generate-demo.ts [hands=600] [out=public/demo/sample-hands.txt]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { cardToString, comboIndex, handClass, rng, type Card } from '../src/lib/cards.ts';
import {
  cold4betChart, freqOf, rfiChart, vs3betChart, vs4betChart, vsLimpChart, vsOpenChart, vsSqueezeChart, type Chart,
} from '../src/lib/engine/charts.ts';
import { categoryOf, evaluate7 } from '../src/lib/engine/evaluator.ts';
import { CLASS_PCT } from '../src/lib/engine/ranges.ts';
import { boardStrength, DRAW_FD, DRAW_OESD } from '../src/lib/engine/strength.ts';
import type { Position } from '../src/lib/types.ts';

const N = parseInt(process.argv[2] ?? '600');
const OUT = process.argv[3] ?? 'public/demo/sample-hands.txt';
const rand = rng(20241103);
const SB = 0.25;
const BB = 0.5;
const START = 50;

interface Style {
  loose: number; // preflop range widening (0 = chart)
  aggro: number; // postflop bet/bluff frequency multiplier
  sticky: number; // lowers calling thresholds
  hero?: boolean;
}
const PLAYERS: { name: string; style: Style }[] = [
  { name: 'Hero', style: { loose: 0, aggro: 1, sticky: 0, hero: true } },
  { name: 'NitPicker', style: { loose: -0.05, aggro: 0.8, sticky: -0.05 } },
  { name: 'LAGuna', style: { loose: 0.12, aggro: 1.4, sticky: 0.02 } },
  { name: 'CallMeMaybe', style: { loose: 0.15, aggro: 0.6, sticky: 0.12 } },
  { name: 'SolverSam', style: { loose: 0, aggro: 1, sticky: 0 } },
  { name: 'RiverRat77', style: { loose: 0.05, aggro: 1.1, sticky: 0.05 } },
];

const money = (x: number) => {
  const r = Math.round(x * 100) / 100;
  return '$' + (Number.isInteger(r) ? String(r) : r.toFixed(2));
};

interface S {
  name: string;
  style: Style;
  seat: number;
  pos: Position;
  stack: number;
  cards: [Card, Card];
  folded: boolean;
  allIn: boolean;
  commit: number;
  totalIn: number;
  pfLine: string[];
}

const POS6: Position[] = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];
const PRE_ORDER: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const POST_ORDER: Position[] = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];

let handId = 251000000000;
let time = new Date('2024-05-01T20:00:00Z').getTime();
const out: string[] = [];

function fmtDate(t: number) {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function shuffleDeck(): Card[] {
  const d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function pickFreq(f: { fold: number; call: number; raise: number }): 'fold' | 'call' | 'raise' {
  const r = rand();
  if (r < f.raise) return 'raise';
  if (r < f.raise + f.call) return 'call';
  return 'fold';
}

/** Widen/tighten a chart decision by hand percentile. */
function adjFreq(chart: Chart, cls: string, loose: number) {
  const f = freqOf(chart, cls);
  if (loose <= 0) {
    if (loose < 0 && f.fold < 1 && CLASS_PCT[cls] > 0.12 && rand() < -loose * 6) return { fold: 1, call: 0, raise: 0 };
    return f;
  }
  if (f.fold > 0.9) {
    // Look at a slightly stronger hand's frequencies as if this hand were better.
    const pct = CLASS_PCT[cls] - loose;
    if (pct < 0.6 && rand() < 0.7) {
      const proxy = Object.entries(CLASS_PCT).reduce((m, [c, p]) => (Math.abs(p - pct) < Math.abs(CLASS_PCT[m] - pct) ? c : m), 'AA');
      const g = freqOf(chart, proxy);
      if (g.fold < 0.9) return g;
    }
  }
  return f;
}

function playHand(button: number) {
  const deck = shuffleDeck();
  const seats: S[] = PLAYERS.map((p, i) => {
    const posIdx = (i - button - 1 + 12) % 6;
    return {
      name: p.name, style: p.style, seat: i + 1, pos: POS6[posIdx], stack: START, cards: [deck.pop()!, deck.pop()!] as [Card, Card],
      folded: false, allIn: false, commit: 0, totalIn: 0, pfLine: [],
    };
  });
  const byPos = (pos: Position) => seats.find((s) => s.pos === pos)!;
  const lines: string[] = [];
  handId += 1 + ((rand() * 40) | 0);
  time += (40 + rand() * 70) * 1000;
  lines.push(`PokerStars Hand #${handId}:  Hold'em No Limit (${money(SB)}/${money(BB)} USD) - ${fmtDate(time)} ET`);
  lines.push(`Table 'Aquila Demo' 6-max Seat #${button + 1} is the button`);
  for (const s of seats) lines.push(`Seat ${s.seat}: ${s.name} (${money(s.stack)} in chips)`);
  let pot = 0;
  const put = (s: S, amt: number) => {
    amt = Math.min(amt, s.stack);
    s.stack = Math.round((s.stack - amt) * 100) / 100;
    s.commit = Math.round((s.commit + amt) * 100) / 100;
    s.totalIn += amt;
    pot += amt;
    if (s.stack <= 1e-9) s.allIn = true;
    return amt;
  };
  const sbP = byPos('SB');
  const bbP = byPos('BB');
  put(sbP, SB);
  lines.push(`${sbP.name}: posts small blind ${money(SB)}`);
  put(bbP, BB);
  lines.push(`${bbP.name}: posts big blind ${money(BB)}`);
  lines.push('*** HOLE CARDS ***');
  const hero = seats.find((s) => s.style.hero)!;
  lines.push(`Dealt to Hero [${cardToString(hero.cards[0])} ${cardToString(hero.cards[1])}]`);

  let board: Card[] = [];
  let lastAggressor: S | null = null;
  let pfAggressor: S | null = null;

  // ---------------- Betting round ----------------
  const round = (street: string, order: S[]) => {
    let currentBet = street === 'preflop' ? BB : 0;
    let lastRaise = BB;
    let raiseLevel = 0;
    let limpers = 0;
    let callers = 0;
    let openerPos: Position | null = null;
    let threeBettorPos: Position | null = null;
    let toAct = order.filter((s) => !s.folded && !s.allIn);
    const acted = new Set<S>();
    let idx = 0;
    let betsThisStreet = 0;
    let guard = 0;
    while (guard++ < 60) {
      const live = order.filter((s) => !s.folded);
      if (live.length <= 1) return;
      const canAct = order.filter((s) => !s.folded && !s.allIn);
      const pending = canAct.filter((s) => !acted.has(s) || s.commit < currentBet - 1e-9);
      if (!pending.length) return;
      if (canAct.length === 1 && canAct[0].commit >= currentBet - 1e-9) return;
      const s = toAct[idx % toAct.length];
      idx++;
      if (s.folded || s.allIn || (acted.has(s) && s.commit >= currentBet - 1e-9)) continue;
      const toCall = Math.min(currentBet - s.commit, s.stack);
      const decision = street === 'preflop'
        ? preflopDecision(s, { raiseLevel, limpers, callers, openerPos, threeBettorPos, currentBet, toCall })
        : postflopDecision(s, { street, toCall, pot, currentBet, betsThisStreet, isAggressor: pfAggressor === s, live: live.length, ip: isIP(s, live) });
      let { act, to } = decision;
      if (act === 'raise' && (to === undefined || to <= currentBet)) act = toCall > 0 ? 'call' : 'check';
      if (act === 'call' && toCall <= 1e-9) act = 'check';
      if (act === 'check' && toCall > 1e-9) act = 'fold';
      if (act === 'fold' && toCall <= 1e-9) act = 'check';
      acted.add(s);
      if (act === 'fold') {
        s.folded = true;
        lines.push(`${s.name}: folds`);
        if (street === 'preflop') s.pfLine.push('fold');
      } else if (act === 'check') {
        lines.push(`${s.name}: checks`);
      } else if (act === 'call') {
        const amt = put(s, toCall);
        lines.push(`${s.name}: calls ${money(amt)}${s.allIn ? ' and is all-in' : ''}`);
        if (street === 'preflop') {
          if (raiseLevel === 0) limpers++;
          else callers++;
          s.pfLine.push(raiseLevel === 0 ? 'limp' : 'call');
        }
      } else {
        let target = Math.round(Math.min(to!, s.stack + s.commit) * 100) / 100;
        const minTo = currentBet + lastRaise;
        if (target < minTo && target < s.stack + s.commit) target = Math.min(Math.round(minTo * 100) / 100, s.stack + s.commit);
        // Avoid leaving tiny stacks behind.
        if (s.stack + s.commit - target < 0.25 * (pot + target)) target = s.stack + s.commit;
        const amt = put(s, target - s.commit);
        void amt;
        const isBet = currentBet <= 1e-9;
        if (isBet) lines.push(`${s.name}: bets ${money(target)}${s.allIn ? ' and is all-in' : ''}`);
        else lines.push(`${s.name}: raises ${money(target - currentBet)} to ${money(target)}${s.allIn ? ' and is all-in' : ''}`);
        lastRaise = Math.max(lastRaise, target - currentBet);
        currentBet = target;
        lastAggressor = s;
        betsThisStreet++;
        if (street === 'preflop') {
          raiseLevel++;
          callers = 0;
          if (raiseLevel === 1) openerPos = s.pos;
          if (raiseLevel === 2) threeBettorPos = s.pos;
          pfAggressor = s;
          s.pfLine.push(raiseLevel === 1 ? 'open' : `r${raiseLevel}`);
        }
        // Everyone else must respond again
        for (const o of order) if (o !== s && !o.folded && !o.allIn) acted.delete(o);
      }
    }
  };

  const isIP = (s: S, live: S[]) => live.every((o) => o === s || POST_ORDER.indexOf(o.pos) < POST_ORDER.indexOf(s.pos));

  function preflopDecision(
    s: S,
    c: { raiseLevel: number; limpers: number; callers: number; openerPos: Position | null; threeBettorPos: Position | null; currentBet: number; toCall: number },
  ): { act: string; to?: number } {
    const cls = handClass(s.cards[0], s.cards[1]);
    const st = s.style;
    let chart: Chart;
    let raiseTo: number;
    const hero = !!st.hero;
    if (c.raiseLevel === 0) {
      if (c.limpers === 0) {
        if (s.pos === 'BB') return { act: 'check' };
        chart = rfiChart(s.pos, 6);
        raiseTo = s.pos === 'SB' ? 3 * BB : 2.5 * BB;
        let f = adjFreq(chart, cls, st.loose + (hero && ['UTG', 'HJ'].includes(s.pos) ? 0.18 : 0));
        if (hero && f.fold > 0.9 && CLASS_PCT[cls] < 0.55 && rand() < 0.12) f = { fold: 0, call: 1, raise: 0 }; // open limp leak
        const a = pickFreq(f);
        return a === 'raise' ? { act: 'raise', to: raiseTo } : a === 'call' ? { act: 'call' } : { act: 'fold' };
      }
      chart = vsLimpChart(s.pos);
      raiseTo = (4 + c.limpers) * BB;
      const a = pickFreq(adjFreq(chart, cls, st.loose));
      if (s.pos === 'BB') return a === 'raise' ? { act: 'raise', to: raiseTo } : { act: 'check' };
      return a === 'raise' ? { act: 'raise', to: raiseTo } : a === 'call' ? { act: 'call' } : { act: 'fold' };
    }
    if (c.raiseLevel === 1) {
      if (s.pfLine.includes('limp')) {
        const f = freqOf(vsSqueezeChart(), cls);
        const a = pickFreq({ fold: f.fold * 0.6, call: f.call + f.fold * 0.4, raise: f.raise });
        return a === 'raise' ? { act: 'raise', to: c.currentBet * 3 } : a === 'call' ? { act: 'call' } : { act: 'fold' };
      }
      chart = vsOpenChart(s.pos, c.openerPos ?? 'CO', c.callers);
      const ip = s.pos !== 'SB' && s.pos !== 'BB';
      raiseTo = c.currentBet * (ip ? 3 : 3.8) + c.callers * c.currentBet;
      let f = adjFreq(chart, cls, st.loose);
      if (hero && s.pos === 'BB' && f.call > 0 && f.raise < 0.5 && rand() < 0.45) f = { fold: 1, call: 0, raise: 0 }; // overfolds BB
      if (hero && ip && f.fold > 0.9 && CLASS_PCT[cls] < 0.4 && rand() < 0.35) f = { fold: 0, call: 1, raise: 0 }; // cold calls too wide
      if (hero && f.raise > 0.5 && rand() < 0.3) f = { fold: 0, call: 1, raise: 0 }; // flats premiums
      const a = pickFreq(f);
      return a === 'raise' ? { act: 'raise', to: raiseTo } : a === 'call' ? { act: 'call' } : { act: 'fold' };
    }
    if (c.raiseLevel === 2) {
      if (s.pfLine.includes('open')) chart = vs3betChart(s.pos, c.threeBettorPos ?? 'BTN');
      else if (s.pfLine.includes('call')) chart = vsSqueezeChart();
      else chart = cold4betChart();
      let f = adjFreq(chart, cls, st.loose * 0.5);
      if (hero && f.fold > 0.9 && CLASS_PCT[cls] < 0.35 && rand() < 0.55) f = { fold: 0, call: 1, raise: 0 }; // calls 3-bets too wide
      const a = pickFreq(f);
      return a === 'raise' ? { act: 'raise', to: c.currentBet * 2.3 } : a === 'call' ? { act: 'call' } : { act: 'fold' };
    }
    chart = vs4betChart();
    const f = freqOf(chart, cls);
    const a = pickFreq(f);
    return a === 'raise' ? { act: 'raise', to: s.stack + s.commit } : a === 'call' ? { act: 'call' } : { act: 'fold' };
  }

  function postflopDecision(
    s: S,
    c: { street: string; toCall: number; pot: number; currentBet: number; betsThisStreet: number; isAggressor: boolean; live: number; ip: boolean },
  ): { act: string; to?: number } {
    const bs = boardStrength(board);
    const ci = comboIndex(s.cards[0], s.cards[1]);
    const hs = bs.hs[ci];
    const ehs = bs.ehs[ci];
    const draw = (bs.draws[ci] & (DRAW_FD | DRAW_OESD)) !== 0 && c.street !== 'river';
    const st = s.style;
    const hero = !!st.hero;
    const river = c.street === 'river';
    const potBefore = c.pot;
    if (c.toCall <= 1e-9) {
      // Bet or check
      const sizeFrac = rand() < 0.5 ? 0.5 : rand() < 0.6 ? 0.33 : 0.75;
      const betAmt = Math.max(BB, Math.round(potBefore * sizeFrac * 100) / 100);
      let pBet: number;
      if (hs >= 0.9) pBet = hero ? (river ? 0.35 : 0.45) : 0.8; // hero misses value
      else if (ehs >= 0.78) pBet = c.isAggressor ? 0.65 : 0.35;
      else if (draw) pBet = 0.45;
      else pBet = (c.isAggressor && c.street === 'flop' ? 0.45 : 0.18) * (c.live > 2 ? 0.4 : 1);
      if (hero && river && hs < 0.5 && rand() < 0.25) pBet = 0.9; // over-bluffs rivers
      pBet = Math.min(0.95, pBet * st.aggro);
      if (rand() < pBet) return { act: 'raise', to: betAmt };
      return { act: 'check' };
    }
    const price = c.toCall / (potBefore + c.toCall);
    const sizeFrac = c.toCall / Math.max(potBefore - c.toCall, 1e-9);
    let callT = 0.55 + 0.25 * Math.min(sizeFrac, 1.5) - st.sticky;
    if (hero && river) callT -= 0.12; // calling station on rivers
    if (hero && c.street === 'turn' && sizeFrac > 0.6) callT += 0.06; // overfolds big turn bets
    if (hs >= 0.95 && rand() < 0.4 * st.aggro && s.stack > c.toCall) return { act: 'raise', to: c.currentBet * 3 };
    if (draw && rand() < 0.15 * st.aggro && s.stack > c.toCall) return { act: 'raise', to: c.currentBet * 3 };
    if ((river ? hs : ehs) >= callT) return { act: 'call' };
    if (draw && bs.ppot[ci] >= price * 0.9) return { act: 'call' };
    if (rand() < 0.04 * st.aggro && s.stack > c.toCall * 3) return { act: 'raise', to: c.currentBet * 3 };
    return { act: 'fold' };
  }

  // Preflop
  round('preflop', PRE_ORDER.map(byPos));
  const streets: [string, number][] = [['FLOP', 3], ['TURN', 1], ['RIVER', 1]];
  let sawFlop = false;
  for (const [name, n] of streets) {
    const live = seats.filter((s) => !s.folded);
    if (live.length <= 1) break;
    for (const s of seats) s.commit = 0;
    const prev = [...board];
    for (let i = 0; i < n; i++) board.push(deck.pop()!);
    if (name === 'FLOP') {
      sawFlop = true;
      lines.push(`*** FLOP *** [${board.map(cardToString).join(' ')}]`);
    } else lines.push(`*** ${name} *** [${prev.map(cardToString).join(' ')}] [${cardToString(board[board.length - 1])}]`);
    const canBet = live.filter((s) => !s.allIn).length >= 2;
    if (canBet) round(name.toLowerCase(), POST_ORDER.map(byPos));
  }
  // If players went all-in early, deal the rest silently (already dealt above since loop continues)
  const live = seats.filter((s) => !s.folded);
  // Uncalled bet
  if (live.length >= 1) {
    const sorted = [...seats].sort((a, b) => b.commit - a.commit);
    const top = sorted[0];
    const second = sorted[1].commit;
    if (top.commit - second > 1e-9 && !top.folded) {
      const ret = Math.round((top.commit - second) * 100) / 100;
      top.stack += ret;
      top.totalIn -= ret;
      pot -= ret;
      lines.push(`Uncalled bet (${money(ret)}) returned to ${top.name}`);
    }
  }
  pot = Math.round(pot * 100) / 100;
  const rake = sawFlop ? Math.min(1.5, Math.floor(pot * 0.05 * 100) / 100) : 0;
  const net = Math.round((pot - rake) * 100) / 100;
  const winners: S[] = [];
  if (live.length === 1) {
    winners.push(live[0]);
    lines.push(`${live[0].name} collected ${money(net)} from pot`);
    lines.push(`${live[0].name}: doesn't show hand`);
  } else {
    lines.push('*** SHOW DOWN ***');
    const vals = live.map((s) => evaluate7(s.cards[0], s.cards[1], board[0], board[1], board[2], board[3], board[4]));
    const best = Math.min(...vals);
    live.forEach((s, i) => {
      lines.push(`${s.name}: shows [${cardToString(s.cards[0])} ${cardToString(s.cards[1])}] (${categoryOf(vals[i]).toLowerCase()})`);
      if (vals[i] === best) winners.push(s);
    });
    const share = Math.floor((net / winners.length) * 100) / 100;
    for (const w of winners) lines.push(`${w.name} collected ${money(share)} from pot`);
  }
  lines.push('*** SUMMARY ***');
  lines.push(`Total pot ${money(pot)} | Rake ${money(rake)}`);
  if (board.length) lines.push(`Board [${board.map(cardToString).join(' ')}]`);
  for (const s of seats) {
    const tag = s.pos === 'BTN' ? ' (button)' : s.pos === 'SB' ? ' (small blind)' : s.pos === 'BB' ? ' (big blind)' : '';
    if (s.folded) lines.push(`Seat ${s.seat}: ${s.name}${tag} folded`);
    else if (winners.includes(s)) lines.push(`Seat ${s.seat}: ${s.name}${tag} won`);
    else lines.push(`Seat ${s.seat}: ${s.name}${tag} lost`);
  }
  out.push(lines.join('\n'));
  void lastAggressor;
}

for (let i = 0; i < N; i++) {
  if (i > 0 && i % 200 === 0) time += 22 * 3600 * 1000;
  playHand(i % 6);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out.join('\n\n\n') + '\n');
console.log(`Wrote ${N} hands to ${OUT}`);
