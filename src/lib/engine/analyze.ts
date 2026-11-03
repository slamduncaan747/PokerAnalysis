import { COMBOS, cardsToString, handClass, hashString, rng, type Card } from '../cards.ts';
import type { Action, Hand, Position, Street } from '../types.ts';
import {
  BB_CHECK_RANGE, cold4betChart, freqOf, jamChart, LIMP_RANGE, limpVsRaiseChart, rfiChart, SB_COMPLETE_RANGE,
  vs3betChart, vs4betChart, vsLimpChart, vsOpenChart, vsSqueezeChart, type Chart, type Freq,
} from './charts.ts';
import { equityKnownHands, equityVsRanges } from './equity.ts';
import { CLASS_ORDER, CLASS_PCT, rangeFromClassWeights, rangeFromSpec, topPct, type Range } from './ranges.ts';
import {
  boardStrength, bucketOf, describeBoard, describeHand, DRAW_FD, DRAW_OESD, type BoardStrength, type StrengthBucket,
} from './strength.ts';
import { accuracyFor, classifyPostflop, weightedAccuracy } from './classify.ts';
import type { ActKind, Classification, Decision, HandAnalysis, HandStatFlags, LeakId, OptionEV } from './types.ts';

export { accuracyFor, classifyPostflop, weightedAccuracy };

const POST_ORDER: Position[] = ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'LJ', 'HJ', 'CO', 'BTN'];

export interface PState {
  name: string;
  pos: Position;
  stack: number; // chips behind
  commit: number; // current street live commitment
  totalIn: number;
  folded: boolean;
  allIn: boolean;
  isHero: boolean;
  range: Range;
  /** Preflop line, e.g. ['limp'], ['open'], ['call'], ['open','call'] */
  pfLine: string[];
}

export interface AnalyzeOptions {
  /** Monte Carlo iterations for the main equity estimate. */
  iterations?: number;
}

export function analyzeHand(hand: Hand, opts: AnalyzeOptions = {}): HandAnalysis {
  const iters = opts.iterations ?? 2000;
  const rand = rng(hashString(hand.id));
  const bb = hand.bb;
  const tableSize = hand.players.length;
  const P = new Map<string, PState>();
  for (const p of hand.players) {
    P.set(p.name, {
      name: p.name, pos: p.position, stack: p.stack, commit: 0, totalIn: 0, folded: false, allIn: false,
      isHero: p.isHero, range: rangeFromSpec('any'), pfLine: [],
    });
  }
  const hero = P.get(hand.hero)!;
  const heroCards = hand.heroCards;
  const decisions: Decision[] = [];
  const stats = emptyStats();

  // Street/pot tracking
  let street: Street = 'preflop';
  let pot = hand.splash ?? 0; // site-added money (CoinPoker splash) is dead money in the pot
  let currentBet = 0;
  let lastRaiseSize = bb;
  let raiseLevel = 0;
  let limpers = 0;
  let callersSinceRaise = 0;
  let openerPos: Position | null = null;
  let opener: string | null = null;
  let threeBettor: string | null = null;
  let lastAggressor: string | null = null;
  let pfAggressor: string | null = null;
  let streetBetCount = 0;
  let board: Card[] = [];
  let heroStreetActed = false;
  let heroFoldedPreflop = false;

  const effStack = (p: PState) => {
    let maxOther = 0;
    for (const q of P.values()) if (q !== p && !q.folded) maxOther = Math.max(maxOther, q.stack + q.commit);
    return Math.min(p.stack + p.commit, maxOther);
  };
  const streetIndex = (s: Street) => ['preflop', 'flop', 'turn', 'river'].indexOf(s);

  const boardFor = (s: Street): Card[] => hand.board.slice(0, s === 'flop' ? 3 : s === 'turn' ? 4 : s === 'river' ? 5 : 0);

  for (let ai = 0; ai < hand.actions.length; ai++) {
    const a = hand.actions[ai];
    if (a.street !== street) {
      // New street: reset commitments
      street = a.street;
      for (const q of P.values()) q.commit = 0;
      currentBet = 0;
      lastRaiseSize = bb;
      streetBetCount = 0;
      board = boardFor(street);
      heroStreetActed = false;
      if (street === 'flop') {
        const alive = [...P.values()].filter((q) => !q.folded);
        if (!hero.folded) stats.sawFlop = true;
        void alive;
      }
    }
    const p = P.get(a.player);
    if (!p) continue;

    // ----- Hero decision analysis (before applying) -----
    if (p.isHero && a.type !== 'post' && !hero.folded) {
      const ctx = {
        hand, ai, street, pot, currentBet, lastRaiseSize, raiseLevel, limpers, callersSinceRaise, openerPos, opener,
        threeBettor, lastAggressor, pfAggressor, board, P, hero, heroCards, bb, tableSize, rand, iters, effStack: effStack(hero), streetBetCount,
      };
      const d = street === 'preflop' ? analyzePreflop(ctx, a) : analyzePostflop(ctx, a);
      if (d) decisions.push(d);
      // Stats bookkeeping
      if (street === 'preflop') {
        if (a.type === 'call' || a.type === 'raise' || a.type === 'bet') stats.vpip = true;
        if (a.type === 'raise' || a.type === 'bet') stats.pfr = true;
        if (raiseLevel === 0 && limpers === 0 && ['CO', 'BTN', 'SB'].includes(hero.pos) && !heroStreetActed) {
          stats.stealOpp = true;
          if (a.type === 'raise' || a.type === 'bet') stats.steal = true;
        }
        if (raiseLevel === 0 && a.type === 'call' && hero.pos !== 'BB') stats.limp = true;
        if (raiseLevel === 1 && !hero.pfLine.includes('open')) {
          stats.threeBetOpp = true;
          if (a.type === 'raise') stats.threeBet = true;
        }
        if (raiseLevel === 2 && hero.pfLine.includes('open') && threeBettor !== hero.name) {
          stats.foldTo3BetOpp = true;
          if (a.type === 'fold') stats.foldTo3Bet = true;
        }
        if (hero.pos === 'BB' && raiseLevel === 1 && callersSinceRaise === 0 && openerPos && ['CO', 'BTN', 'SB'].includes(openerPos)) {
          stats.bbVsStealOpp = true;
          if (a.type === 'fold') stats.bbFoldVsSteal = true;
        }
      } else {
        if (street === 'flop' && pfAggressor === hero.name && streetBetCount === 0 && !heroStreetActed) {
          stats.cbetOpp = true;
          if (a.type === 'bet') stats.cbet = true;
        }
        if (street === 'flop' && pfAggressor && pfAggressor !== hero.name && lastAggressor === pfAggressor && streetBetCount === 1 && !heroStreetActed) {
          stats.foldToCbetOpp = true;
          if (a.type === 'fold') stats.foldToCbet = true;
        }
        if (a.type === 'bet') stats.postBets++;
        else if (a.type === 'raise') stats.postRaises++;
        else if (a.type === 'call') stats.postCalls++;
        else if (a.type === 'check') stats.postChecks++;
        else if (a.type === 'fold') stats.postFolds++;
      }
      heroStreetActed = true;
    }

    // ----- Villain range bookkeeping -----
    if (!p.isHero && a.type !== 'post') {
      if (street === 'preflop') {
        assignPreflopRange(p, a, { raiseLevel, limpers, openerPos, opener, threeBettor, P, bb, tableSize });
      } else if (a.type !== 'fold') {
        const bs = boardStrength(board);
        const sizeFrac = a.type === 'bet' || a.type === 'raise' ? (a.toAmount - p.commit) / Math.max(pot + (currentBet - p.commit), 1e-9) : 0;
        narrowRange(p.range, bs, a.type, sizeFrac, street, currentBet > p.commit);
      }
    } else if (p.isHero && street === 'preflop' && a.type !== 'post') {
      p.pfLine.push(lineTag(a, raiseLevel, limpers));
    }

    // ----- Apply action -----
    switch (a.type) {
      case 'post':
        if (a.postKind === 'ante' || a.postKind === 'dead') {
          pot += a.amount;
          p.stack -= a.amount;
          p.totalIn += a.amount;
        } else {
          pot += a.amount;
          p.stack -= a.amount;
          p.totalIn += a.amount;
          p.commit = a.toAmount;
          currentBet = Math.max(currentBet, a.toAmount);
        }
        break;
      case 'fold':
        p.folded = true;
        if (p.isHero && street === 'preflop') heroFoldedPreflop = true;
        break;
      case 'check':
        break;
      case 'call':
        pot += a.amount;
        p.stack -= a.amount;
        p.totalIn += a.amount;
        p.commit = a.toAmount;
        if (street === 'preflop') {
          if (raiseLevel === 0) limpers++;
          else callersSinceRaise++;
        }
        break;
      case 'bet':
      case 'raise': {
        pot += a.amount;
        p.stack -= a.amount;
        p.totalIn += a.amount;
        const inc = a.toAmount - currentBet;
        if (inc > 0) lastRaiseSize = Math.max(lastRaiseSize, inc);
        p.commit = a.toAmount;
        currentBet = Math.max(currentBet, a.toAmount);
        lastAggressor = p.name;
        streetBetCount++;
        if (street === 'preflop') {
          raiseLevel++;
          callersSinceRaise = 0;
          if (raiseLevel === 1) {
            opener = p.name;
            openerPos = p.pos;
          } else if (raiseLevel === 2) threeBettor = p.name;
          pfAggressor = p.name;
        }
        break;
      }
    }
    if (p.stack <= 1e-9) p.allIn = true;
  }
  void heroFoldedPreflop;
  void streetIndex;

  // Showdown / results
  stats.wtsd = stats.sawFlop && hand.wentToShowdown;
  stats.wonAtShowdown = stats.wtsd && hand.heroNet > 0;
  stats.wonWhenSawFlop = stats.sawFlop && hand.heroNet > 0;

  const netBB = hand.heroNet / bb;
  const evNetBB = allInAdjustedNet(hand, rand) ?? netBB;

  const counted = decisions.filter((d) => !d.trivial);
  const evLossBB = decisions.reduce((s, d) => s + d.evLoss, 0);
  const accuracy = counted.length ? weightedAccuracy(counted) : null;
  let worst: Classification | null = null;
  const sev: Classification[] = ['blunder', 'mistake', 'miss', 'inaccuracy'];
  for (const c of sev) if (decisions.some((d) => d.classification === c)) {
    worst = c;
    break;
  }
  if (!worst && counted.length) worst = counted.some((d) => d.classification === 'brilliant') ? 'brilliant' : counted.some((d) => d.classification === 'great') ? 'great' : 'best';

  return {
    handId: hand.id,
    date: hand.date,
    heroPosition: hero.pos,
    heroCards: [heroCards[0], heroCards[1]],
    netBB: round(netBB),
    evNetBB: round(evNetBB),
    wentToShowdown: hand.wentToShowdown,
    bbSize: bb,
    evLossBB: round(evLossBB),
    accuracy,
    decisions,
    worst,
    stats,
    tableSize,
    gameType: hand.gameType,
  };
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

function emptyStats(): HandStatFlags {
  return {
    vpip: false, pfr: false, threeBetOpp: false, threeBet: false, foldTo3BetOpp: false, foldTo3Bet: false,
    stealOpp: false, steal: false, bbVsStealOpp: false, bbFoldVsSteal: false, limp: false, sawFlop: false,
    cbetOpp: false, cbet: false, foldToCbetOpp: false, foldToCbet: false, wtsd: false, wonAtShowdown: false,
    wonWhenSawFlop: false, postBets: 0, postRaises: 0, postCalls: 0, postChecks: 0, postFolds: 0,
  };
}

function lineTag(a: Action, raiseLevel: number, limpers: number): string {
  if (a.type === 'fold') return 'fold';
  if (a.type === 'check') return 'check';
  if (a.type === 'call') return raiseLevel === 0 ? 'limp' : `call${raiseLevel}`;
  if (raiseLevel === 0) return limpers ? 'iso' : 'open';
  return `raise${raiseLevel + 1}`; // raise2 = 3-bet...
}

// ---------------------------------------------------------------------------
// Villain preflop ranges
// ---------------------------------------------------------------------------

export function assignPreflopRange(
  p: PState,
  a: Action,
  c: { raiseLevel: number; limpers: number; openerPos: Position | null; opener: string | null; threeBettor: string | null; P: Map<string, PState>; bb: number; tableSize: number },
) {
  const tag = lineTag(a, c.raiseLevel, c.limpers);
  const prev = p.pfLine[p.pfLine.length - 1];
  p.pfLine.push(tag);
  const stackBB = (p.stack + p.commit) / c.bb;
  const jam = a.allIn && (a.type === 'raise' || a.type === 'bet');
  let spec: Range | null = null;
  const chartRange = (ch: Chart, part: 'raise' | 'call' | 'both') => {
    const w = new Map<string, number>();
    for (const cls of CLASS_ORDER) {
      const f = freqOf(ch, cls);
      const v = part === 'raise' ? f.raise : part === 'call' ? f.call : f.raise + f.call;
      if (v > 0) w.set(cls, v);
    }
    return rangeFromClassWeights(w);
  };
  if (tag === 'fold') return;
  if (tag === 'check') {
    if (p.pos === 'BB') spec = rangeFromSpec(BB_CHECK_RANGE);
  } else if (tag === 'limp') {
    spec = rangeFromSpec(p.pos === 'SB' ? SB_COMPLETE_RANGE : LIMP_RANGE);
  } else if (tag === 'open') {
    spec = jam || stackBB <= 20 ? chartRange(jamChart(p.pos), 'raise') : chartRange(rfiChart(p.pos, c.tableSize), 'raise');
  } else if (tag === 'iso') {
    spec = chartRange(vsLimpChart(p.pos), 'raise');
    if (prev === 'limp') spec = rangeFromSpec('QQ+, AK, JJ:0.5');
  } else if (tag === 'call1') {
    if (prev === 'limp') spec = chartRange(limpVsRaiseChart(), 'call');
    else spec = chartRange(vsOpenChart(p.pos, c.openerPos ?? 'CO', 0), 'call');
    // Real players flat wider than charts: blend in a bit of the 3-bet range too.
    blendInPlace(spec, chartRange(vsOpenChart(p.pos, c.openerPos ?? 'CO', 0), 'raise'), 0.25);
  } else if (tag === 'raise2') {
    spec = jam && stackBB <= 30 ? topPct(0.14) : chartRange(vsOpenChart(p.pos, c.openerPos ?? 'CO', 0), 'raise');
    if (prev === 'limp') spec = rangeFromSpec('QQ+, AK');
  } else if (tag === 'call2') {
    const tbPos = c.threeBettor ? c.P.get(c.threeBettor)?.pos ?? 'BTN' : 'BTN';
    if (prev === 'open') spec = chartRange(vs3betChart(p.pos, tbPos), 'call');
    else if (prev === 'call1') spec = chartRange(vsSqueezeChart(), 'call');
    else spec = chartRange(cold4betChart(), 'call');
  } else if (tag === 'raise3') {
    spec = prev === 'open' ? chartRange(vs3betChart(p.pos, 'BTN'), 'raise') : chartRange(cold4betChart(), 'raise');
    if (jam && stackBB <= 40) spec = topPct(0.08);
  } else if (tag.startsWith('call')) {
    spec = rangeFromSpec('QQ+, AK, JJ:0.5, AQs:0.3');
    if (a.allIn || stackBB <= 40) spec = topPct(Math.max(0.03, Math.min(0.2, 0.4 - stackBB * 0.008)));
  } else if (tag.startsWith('raise')) {
    spec = rangeFromSpec('QQ+, AK:0.8');
  }
  if (spec) p.range = spec;
}

function blendInPlace(r: Range, other: Range, w: number) {
  for (let i = 0; i < 1326; i++) r[i] = Math.min(1, r[i] + other[i] * w);
}

// ---------------------------------------------------------------------------
// Postflop range narrowing
// ---------------------------------------------------------------------------

export function narrowRange(r: Range, bs: BoardStrength, type: string, sizeFrac: number, street: Street, facingBet: boolean) {
  const before = Float32Array.from(r);
  const river = street === 'river';
  const s = Math.min(Math.max(sizeFrac, 0.15), 2);
  for (let i = 0; i < 1326; i++) {
    if (r[i] <= 0) continue;
    const ehs = bs.ehs[i];
    if (Number.isNaN(ehs)) {
      r[i] = 0;
      continue;
    }
    const hs = bs.hs[i];
    const strongDraw = !river && (bs.draws[i] & (DRAW_FD | DRAW_OESD)) !== 0;
    let f: number;
    if (type === 'bet' || type === 'raise') {
      const raise = type === 'raise';
      const tv = Math.min(0.97, 0.8 + 0.07 * s + (raise ? 0.06 : 0));
      if (ehs >= tv) f = 1;
      else if (strongDraw) f = raise ? 0.45 : 0.75;
      else if (hs >= 0.62) {
        const t = (hs - 0.62) / (tv - 0.62);
        const base = raise ? 0.08 : s <= 0.4 ? 0.55 : 0.3;
        f = base + (1 - base) * t * t * 0.6;
      } else f = raise ? 0.08 : river ? 0.16 : street === 'turn' ? 0.2 : 0.26;
    } else if (type === 'call') {
      const tc = 0.6 + 0.09 * s;
      if (hs >= 0.97) f = facingBet ? 0.55 : 0.8;
      else if (ehs >= tc) f = 1;
      else if (strongDraw) f = 1;
      else if (ehs >= tc - 0.08) f = 0.45;
      else f = river ? 0.03 : street === 'turn' ? 0.08 : 0.15;
    } else {
      // check
      if (hs >= 0.95) f = 0.4;
      else if (hs >= 0.85) f = 0.65;
      else if (strongDraw) f = 0.75;
      else f = 1;
    }
    r[i] *= f;
  }
  let tot = 0;
  for (let i = 0; i < 1326; i++) tot += r[i];
  if (tot < 3) r.set(before);
}

export function rangeComposition(r: Range, bs: BoardStrength): Record<StrengthBucket | 'draw', number> {
  const out = { nuts: 0, strong: 0, medium: 0, weak: 0, air: 0, draw: 0 };
  let tot = 0;
  for (let i = 0; i < 1326; i++) {
    const w = r[i];
    if (w <= 0 || Number.isNaN(bs.hs[i])) continue;
    tot += w;
    const b = bucketOf(bs.hs[i]);
    if ((b === 'air' || b === 'weak') && bs.board.length < 5 && bs.draws[i] & (DRAW_FD | DRAW_OESD)) out.draw += w;
    else out[b] += w;
  }
  if (tot) for (const k of Object.keys(out) as (keyof typeof out)[]) out[k] /= tot;
  return out;
}

export function describeComposition(c: Record<StrengthBucket | 'draw', number>): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const parts: string[] = [];
  const value = c.nuts + c.strong;
  parts.push(`${pct(value)} strong`);
  parts.push(`${pct(c.medium)} medium`);
  if (c.draw > 0.02) parts.push(`${pct(c.draw)} draws`);
  parts.push(`${pct(c.weak + c.air)} weak/air`);
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Preflop decisions
// ---------------------------------------------------------------------------

interface Ctx {
  hand: Hand;
  ai: number;
  street: Street;
  pot: number;
  currentBet: number;
  lastRaiseSize: number;
  raiseLevel: number;
  limpers: number;
  callersSinceRaise: number;
  openerPos: Position | null;
  opener: string | null;
  threeBettor: string | null;
  lastAggressor: string | null;
  pfAggressor: string | null;
  board: Card[];
  P: Map<string, PState>;
  hero: PState;
  heroCards: [Card, Card];
  bb: number;
  tableSize: number;
  rand: () => number;
  iters: number;
  effStack: number;
  streetBetCount: number;
}

const v = (p: number) => 4 * Math.exp(-p / 0.06);

function heroActKind(a: Action): ActKind {
  return a.type === 'post' ? 'check' : (a.type as ActKind);
}

function preflopScenario(c: Ctx): { chart: Chart; spot: string; scenario: string; ctxW: number; leakFamily: string } {
  const h = c.hero;
  const heroLine = h.pfLine;
  const effBB = c.effStack / c.bb;
  if (c.raiseLevel === 0) {
    if (c.limpers === 0) {
      if (effBB <= 20) return { chart: jamChart(h.pos), spot: `${h.pos} open (${Math.round(effBB)}bb, push/fold)`, scenario: 'pf_rfi', ctxW: 0.8, leakFamily: 'open' };
      return { chart: rfiChart(h.pos, c.tableSize), spot: `${h.pos} first in (unopened pot)`, scenario: 'pf_rfi', ctxW: 0.7, leakFamily: 'open' };
    }
    return { chart: vsLimpChart(h.pos), spot: `${h.pos} vs ${c.limpers} limper${c.limpers > 1 ? 's' : ''}`, scenario: 'pf_vs_limp', ctxW: 0.7, leakFamily: 'limp' };
  }
  const tbPos = c.threeBettor ? c.P.get(c.threeBettor)?.pos ?? 'BTN' : 'BTN';
  if (c.raiseLevel === 1) {
    if (heroLine.includes('limp')) return { chart: limpVsRaiseChart(), spot: `${h.pos} limped, facing raise`, scenario: 'pf_vs_open', ctxW: 0.8, leakFamily: 'vsopen' };
    const op = c.openerPos ?? 'CO';
    const sq = c.callersSinceRaise > 0 ? ` + ${c.callersSinceRaise} caller${c.callersSinceRaise > 1 ? 's' : ''}` : '';
    return {
      chart: vsOpenChart(h.pos, op, c.callersSinceRaise),
      spot: `${h.pos} vs ${op} open${sq}`,
      scenario: h.pos === 'BB' ? 'pf_bb_defense' : 'pf_vs_open',
      ctxW: h.pos === 'BB' ? 0.8 : 1,
      leakFamily: h.pos === 'BB' ? 'bb' : 'vsopen',
    };
  }
  if (c.raiseLevel === 2) {
    if (heroLine.includes('open') || heroLine.includes('iso')) return { chart: vs3betChart(h.pos, tbPos), spot: `${h.pos} open, facing ${tbPos} 3-bet`, scenario: 'pf_vs_3bet', ctxW: 2, leakFamily: 'vs3bet' };
    if (heroLine.some((t) => t.startsWith('call'))) return { chart: vsSqueezeChart(), spot: `${h.pos} called, facing squeeze`, scenario: 'pf_vs_3bet', ctxW: 2, leakFamily: 'vs3bet' };
    return { chart: cold4betChart(), spot: `${h.pos} facing open + 3-bet`, scenario: 'pf_vs_3bet', ctxW: 2, leakFamily: 'vs3bet' };
  }
  return { chart: vs4betChart(), spot: `${h.pos} facing ${c.raiseLevel === 3 ? '4-bet' : '5-bet+'}`, scenario: 'pf_4bet', ctxW: 3.5, leakFamily: '4bet' };
}

function weakestPct(chart: Chart, kind: 'raise' | 'call' | 'play'): number {
  let worst = 0;
  for (const cls of CLASS_ORDER) {
    const f = freqOf(chart, cls);
    const val = kind === 'raise' ? f.raise : kind === 'call' ? f.call : f.raise + f.call;
    if (val > 0.05) worst = Math.max(worst, CLASS_PCT[cls]);
  }
  return worst;
}

function analyzePreflop(c: Ctx, a: Action): Decision {
  const h = c.hero;
  const cls = handClass(c.heroCards[0], c.heroCards[1]);
  const pct = CLASS_PCT[cls];
  const toCall = Math.max(0, Math.min(c.currentBet - h.commit, h.stack));
  const potBB = c.pot / c.bb;
  const { chart, spot, scenario, ctxW, leakFamily } = preflopScenario(c);
  const freq = freqOf(chart, cls);
  const heroKind = heroActKind(a);
  const heroBucket: keyof Freq = heroKind === 'fold' ? 'fold' : heroKind === 'call' || heroKind === 'check' ? 'call' : 'raise';
  const handLabel = describeHand(c.heroCards, []);
  const explanation: string[] = [];
  const addedBB = a.amount / c.bb;
  const stackBB = h.stack / c.bb;
  const heroLabel = actionLabel(a, c.bb, chart, c.raiseLevel === 0 && c.limpers === 0 ? 'Open' : undefined);

  // Facing a big all-in / committing decision: use equity math.
  const villainAllIn = c.lastAggressor ? c.P.get(c.lastAggressor)?.allIn ?? false : false;
  const committing = toCall > 0 && (villainAllIn || toCall >= 0.4 * h.stack || (a.allIn && a.amount >= 0.4 * (h.stack)));
  if (committing && c.lastAggressor) {
    return preflopAllIn(c, a, { spot, chart, freq, handLabel, heroLabel, toCall });
  }

  const best: keyof Freq = freq.raise >= freq.call && freq.raise >= freq.fold ? 'raise' : freq.call >= freq.fold ? 'call' : 'fold';
  let loss = 0;
  let cls_: Classification;
  let leak: LeakId | undefined;
  const fHero = freq[heroBucket];
  const playPct = weakestPct(chart, 'play');
  let trivial = false;
  const chartDesc = `chart: ${chart.raiseLabel} ${Math.round(freq.raise * 100)}% · ${chart.callLabel} ${Math.round(freq.call * 100)}% · Fold ${Math.round(freq.fold * 100)}%`;

  if (heroBucket === 'fold' && chart.freeCall) {
    // Folding when you could check for free.
    loss = 0.5 + v(pct) * 0.3;
    cls_ = loss >= 1 ? 'blunder' : 'mistake';
    leak = 'pf_bb_defense';
    explanation.push('You folded when you could have checked for free — never fold the big blind in an unraised pot.');
  } else if (fHero >= 0.3 || heroBucket === best) {
    loss = 0;
    cls_ = 'book';
    trivial = heroBucket === 'fold' && freq.fold >= 0.999 && pct > playPct + 0.08;
    explanation.push(
      heroBucket === 'fold'
        ? `${handLabel} is a standard fold here (${chartDesc}).`
        : `${handLabel}: ${heroLabel} is standard here (${chartDesc}).`,
    );
  } else if (fHero > 0) {
    loss = 0.02;
    cls_ = 'excellent';
    explanation.push(`${heroLabel} with ${handLabel} is a low-frequency play in the baseline (${chartDesc}) — fine as a mix.`);
  } else {
    if (heroBucket !== 'fold' && freq.fold >= 0.6) {
      // Too loose
      const stake = Math.min(heroBucket === 'call' ? toCall / c.bb : addedBB, 20);
      const wp = weakestPct(chart, heroBucket === 'raise' ? 'raise' : 'play');
      const gap = Math.max(0, pct - Math.max(wp, playPct));
      loss = Math.max(0.05, stake * (0.06 + 0.5 * gap));
      leak = looseLeak(leakFamily, heroBucket, c);
      explanation.push(`${handLabel} is outside the range for this spot (${chartDesc}).`);
      explanation.push(`This spot is played with: ${chartHands(chart, heroBucket === 'raise' ? 'raise' : 'play')}.`);
      explanation.push(looseReason(leakFamily, heroBucket));
    } else if (heroBucket === 'fold') {
      const wp = weakestPct(chart, 'play');
      loss = Math.max(0.04, ctxW * (v(pct) - v(wp)));
      leak = tightLeak(leakFamily);
      explanation.push(
        `Folding ${handLabel} gives up a profitable hand (${chartDesc}). It's in the top ${Math.max(1, Math.round(pct * 100))}% of starting hands and the baseline plays it ${Math.round((1 - freq.fold) * 100)}% of the time.`,
      );
    } else if (heroBucket === 'call' && freq.raise >= 0.5) {
      loss = Math.max(0.03, ctxW * (0.06 * v(pct) + 0.25 * Math.max(0, v(pct) - 3)));
      leak = c.raiseLevel === 0 && c.limpers === 0 ? 'pf_limp' : c.raiseLevel === 0 ? 'pf_vs_limp' : 'pf_flat_3bet_hands';
      explanation.push(
        `${handLabel} wants to ${chart.raiseLabel.toLowerCase()} here (${chartDesc}). Just calling lets weaker hands in cheaply and gives up initiative.`,
      );
      explanation.push(`${chart.raiseLabel} range: ${chartHands(chart, 'raise')}.`);
    } else if (heroBucket === 'raise' && freq.call >= 0.5) {
      const extra = Math.max(0.5, addedBB - toCall / c.bb);
      const gapR = Math.max(0, pct - weakestPct(chart, 'raise'));
      loss = Math.max(0.03, Math.min(extra, 8) * (0.04 + 0.4 * gapR));
      leak = c.raiseLevel >= 1 ? 'pf_3bet_light' : 'pf_vs_limp';
      explanation.push(
        `${handLabel} is a ${chart.callLabel.toLowerCase()} in the baseline (${chartDesc}). Raising turns a hand that plays well in a smaller pot into a bluff that gets called mostly by better.`,
      );
    } else {
      loss = 0.1;
      leak = looseLeak(leakFamily, heroBucket, c);
      explanation.push(`Unusual choice here (${chartDesc}).`);
    }
    cls_ = loss < 0.08 ? 'good' : loss < 0.4 ? 'inaccuracy' : loss < 1.2 ? 'mistake' : 'blunder';
  }

  const options: OptionEV[] = [
    { key: 'fold', kind: 'fold', label: 'Fold', freq: freq.fold },
    { key: 'call', kind: chart.freeCall ? 'check' : 'call', label: chart.freeCall ? 'Check' : toCall > 0 ? `${chart.callLabel} ${fmtBB(toCall / c.bb)}` : chart.callLabel, freq: freq.call },
    { key: 'raise', kind: 'raise', label: chart.raiseLabel, freq: freq.raise },
  ];
  if (chart.freeCall) options.shift();
  const accuracy = accuracyFor(loss, Math.max(potBB, 2.5));
  return {
    actionIndex: c.ai,
    street: 'preflop',
    heroKey: heroBucket,
    heroLabel,
    potBB: round(potBB),
    toCallBB: round(toCall / c.bb),
    stackBB: round(stackBB),
    spot,
    scenario,
    options,
    bestKey: best,
    evLoss: round(loss),
    classification: cls_,
    accuracy,
    trivial,
    handLabel,
    chartFreq: freq,
    chartLabels: { raise: chart.raiseLabel, call: chart.callLabel },
    leak: cls_ === 'book' || cls_ === 'excellent' ? undefined : leak,
    explanation,
    board: [],
  };
}

/** Compact list of the hands a chart plays, strongest first. */
export function chartHands(chart: Chart, kind: 'raise' | 'call' | 'play', max = 18): string {
  const out: string[] = [];
  for (const cls of CLASS_ORDER) {
    const f = freqOf(chart, cls);
    const val = kind === 'raise' ? f.raise : kind === 'call' ? f.call : f.raise + f.call;
    if (val >= 0.5) out.push(cls);
    else if (val > 0.05) out.push(`${cls}*`);
  }
  if (!out.length) return 'nothing (fold everything)';
  const s = out.length > max ? `${out.slice(0, max).join(', ')} … (${out.length} hand types)` : out.join(', ');
  return s + (out.some((x) => x.endsWith('*')) ? ' (* = sometimes)' : '');
}

function looseLeak(family: string, bucket: keyof Freq, c: Ctx): LeakId {
  switch (family) {
    case 'open':
      return bucket === 'call' && c.hero.pos !== 'SB' ? 'pf_limp' : 'pf_open_loose';
    case 'limp':
      return 'pf_vs_limp';
    case 'vsopen':
    case 'bb':
      return bucket === 'raise' ? 'pf_3bet_light' : 'pf_cold_call_loose';
    case 'vs3bet':
      return 'pf_vs3bet_loose';
    default:
      return 'pf_4bet_pots';
  }
}
function tightLeak(family: string): LeakId {
  switch (family) {
    case 'open':
      return 'pf_open_tight';
    case 'limp':
      return 'pf_vs_limp';
    case 'vsopen':
      return 'pf_fold_vs_open';
    case 'bb':
      return 'pf_bb_defense';
    case 'vs3bet':
      return 'pf_vs3bet_tight';
    default:
      return 'pf_4bet_pots';
  }
}
function looseReason(family: string, bucket: keyof Freq): string {
  if (family === 'open' && bucket === 'call') return 'Open-limping invites raises and gives up the blinds you could win with a raise. Raise or fold when first in.';
  if (family === 'open') return 'Hands below the opening threshold get 3-bet off or called by better hands and play poorly out of position.';
  if (family === 'vs3bet') return 'Against a 3-bet range, weak hands are dominated and rarely realize their equity.';
  if (family === 'bb') return 'Even with the big-blind discount, this hand loses more than its 1bb when defending.';
  return "Cold-calling with hands outside the range leaves you dominated and squeezed — you're paying to play a worse hand than your opponent's range.";
}

function preflopAllIn(
  c: Ctx,
  a: Action,
  x: { spot: string; chart: Chart; freq: Freq; handLabel: string; heroLabel: string; toCall: number },
): Decision {
  const h = c.hero;
  const vill = c.P.get(c.lastAggressor!)!;
  const others = [...c.P.values()].filter((q) => !q.isHero && !q.folded);
  const villRanges = others.filter((q) => q.commit > 0 || q === vill).map((q) => q.range);
  const eq = equityVsRanges(c.heroCards, [], villRanges.length ? villRanges : [vill.range], c.iters, c.rand).equity;
  const C = Math.min(x.toCall, h.stack);
  const P = c.pot;
  const evCall = eq * (P + C) - C;
  // Hero jam option (if villain not all-in and hero has more behind)
  const options: OptionEV[] = [
    { key: 'fold', kind: 'fold', label: 'Fold', ev: 0, freq: x.freq.fold },
    { key: 'call', kind: 'call', label: `Call ${fmtBB(C / c.bb)}`, ev: round(evCall / c.bb), freq: x.freq.call },
  ];
  if (!vill.allIn && h.stack > C) {
    const A = h.stack;
    const K = Math.min(vill.stack + vill.commit, h.stack + h.commit) - vill.commit;
    const jamBB = (h.stack + h.commit) / c.bb;
    const cont = intersect(vill.range, topPct(Math.max(0.03, Math.min(0.35, 0.45 - jamBB * 0.012))));
    const fc = sumW(cont) / Math.max(sumW(vill.range), 1e-9);
    const eqc = equityVsRanges(c.heroCards, [], [cont], c.iters, c.rand).equity;
    const evJam = (1 - fc) * P + fc * (eqc * (P + A + K) - A);
    options.push({ key: 'raise', kind: 'raise', label: 'All-in', toBB: round((h.stack + h.commit) / c.bb), ev: round(evJam / c.bb), freq: x.freq.raise, foldPct: 1 - fc, eqWhenCalled: eqc });
  }
  const heroKind = heroActKind(a);
  const heroKey = heroKind === 'fold' ? 'fold' : heroKind === 'call' ? 'call' : options.find((o) => o.key === 'raise') ? 'raise' : 'call';
  const best = options.reduce((m, o) => ((o.ev ?? -1e9) > (m.ev ?? -1e9) ? o : m), options[0]);
  const heroOpt = options.find((o) => o.key === heroKey) ?? options[1];
  const loss = Math.max(0, (best.ev ?? 0) - (heroOpt.ev ?? 0));
  const potBB = P / c.bb;
  const potOdds = C / (P + C);
  let cls_: Classification = classifyPostflop(loss, potBB + C / c.bb);
  if (loss < 1e-9) cls_ = 'best';
  const explanation = [
    `${x.handLabel} vs ${vill.pos}'s ${vill.allIn ? 'all-in' : 'raise'} range: you have about ${pctStr(eq)} equity and need ${pctStr(potOdds)} to call ${fmtBB(C / c.bb)} into ${fmtBB(potBB)}.`,
    `Calling is worth ${signedBB(evCall / c.bb)} vs folding (0bb). Best: ${best.label} (${signedBB(best.ev ?? 0)}).`,
  ];
  let leak: LeakId | undefined;
  if (cls_ !== 'best' && isErrorC(cls_)) leak = 'pf_allin';
  return {
    actionIndex: c.ai,
    street: 'preflop',
    heroKey,
    heroLabel: x.heroLabel,
    potBB: round(potBB),
    toCallBB: round(C / c.bb),
    stackBB: round(h.stack / c.bb),
    spot: x.spot + ' (all-in decision)',
    scenario: 'pf_allin',
    options,
    bestKey: best.key,
    evLoss: round(loss),
    classification: cls_,
    accuracy: accuracyFor(loss, potBB + C / c.bb),
    trivial: false,
    handLabel: x.handLabel,
    equity: eq,
    potOdds,
    chartFreq: x.freq,
    chartLabels: { raise: x.chart.raiseLabel, call: x.chart.callLabel },
    leak,
    explanation,
    board: [],
  };
}

const isErrorC = (c: Classification) => c === 'inaccuracy' || c === 'mistake' || c === 'miss' || c === 'blunder';

function intersect(a: Range, b: Range): Range {
  const r = new Float32Array(1326);
  for (let i = 0; i < 1326; i++) r[i] = a[i] * b[i];
  return r;
}
const sumW = (r: Range) => r.reduce((s, x) => s + x, 0);

// ---------------------------------------------------------------------------
// Postflop decisions
// ---------------------------------------------------------------------------

function analyzePostflop(c: Ctx, a: Action): Decision | null {
  const h = c.hero;
  const bb = c.bb;
  const board = c.board;
  if (board.length < 3) return null;
  const bs = boardStrength(board);
  const villains = [...c.P.values()].filter((q) => !q.isHero && !q.folded);
  if (!villains.length) return null;
  const P = c.pot;
  const C = Math.max(0, Math.min(c.currentBet - h.commit, h.stack));
  const S = h.stack;
  const river = c.street === 'river';
  const heroIdx = POST_ORDER.indexOf(h.pos);
  const ip = villains.every((q) => POST_ORDER.indexOf(q.pos) < heroIdx);
  const multiway = villains.length > 1;
  const R = river ? 1 : c.street === 'turn' ? (ip ? 0.98 : 0.9) : ip ? 0.95 : 0.85;
  const Rm = multiway ? R * 0.92 : R;
  const ranges = villains.map((q) => q.range);
  const eqRes = equityVsRanges(c.heroCards, board, ranges, c.iters, c.rand);
  const eq = eqRes.equity;
  const ci = comboIdx(c.heroCards);
  const heroHS = bs.hs[ci];
  const heroDraw = !river && (bs.draws[ci] & (DRAW_FD | DRAW_OESD)) !== 0;
  const heroPpot = bs.ppot[ci];
  const handLabel = describeHand(c.heroCards, board);
  const options: OptionEV[] = [];
  const villainBehindStack = Math.max(...villains.map((q) => q.stack + q.commit));
  const allVillainsAllIn = villains.every((q) => q.allIn);

  // Future-street value: with stacks behind, a hand that is ahead wins more than the current pot.
  const fv = (e: number, potAfter: number, behind: number) =>
    river || behind <= 0 ? 0 : Math.max(0, e - 0.5) * Math.min(behind, potAfter) * (c.street === 'flop' ? 0.45 : 0.3);
  const evBetTo = (to: number): { ev: number; fold: number; eqc: number } => {
    const A = Math.min(to - h.commit, S);
    let foldAll = 1;
    const contRanges: Range[] = [];
    let K = 0;
    for (const q of villains) {
      const Kq = Math.max(0, Math.min(h.commit + A, q.stack + q.commit) - q.commit);
      K = Math.max(K, Kq);
      if (q.allIn || Kq <= 0) {
        foldAll *= 0;
        contRanges.push(q.range);
        continue;
      }
      const price = Kq / (P + A + Kq);
      let tmin = Math.min(0.92, Math.max(0.5, 0.42 + 1.1 * price + (river ? 0.03 : 0)));
      // Minimum defence: a sensible opponent doesn't fold more than the bet size allows,
      // otherwise any two cards would profit as a bluff. Lower the threshold until they defend MDF.
      const mdf = P / (P + A);
      const strengths: [number, number][] = [];
      let tw = 0;
      for (let i = 0; i < 1326; i++) {
        const w = q.range[i];
        if (w <= 0) continue;
        const e = river ? bs.hs[i] : bs.ehs[i];
        if (Number.isNaN(e)) continue;
        strengths.push([e, w]);
        tw += w;
      }
      strengths.sort((x, y) => y[0] - x[0]);
      let acc = 0;
      for (const [e, w] of strengths) {
        acc += w;
        if (acc >= mdf * tw) {
          tmin = Math.min(tmin, e + 0.02);
          break;
        }
      }
      const cr = new Float32Array(1326);
      let cw = 0;
      for (let i = 0; i < 1326; i++) {
        const w = q.range[i];
        if (w <= 0) continue;
        const e = river ? bs.hs[i] : bs.ehs[i];
        if (Number.isNaN(e)) continue;
        let k = 1 / (1 + Math.exp(-(e - tmin) / 0.03));
        if (!river && bs.ppot[i] >= price * 0.85) k = Math.max(k, 0.9);
        cr[i] = w * k;
        cw += w * k;
      }
      const f = tw > 0 ? 1 - cw / tw : 0;
      foldAll *= f;
      contRanges.push(cw > 0.5 ? cr : q.range);
    }
    const eqc = equityVsRanges(c.heroCards, board, contRanges, Math.round(c.iters * 0.6), c.rand).equity;
    const allin = A >= S - 1e-9;
    const Rb = river || allin ? 1 : ip ? 1 : 0.92;
    const ev = foldAll * P + (1 - foldAll) * (Rb * eqc * (P + A + K) - A + fv(eqc, P + A + K, S - A));
    return { ev, fold: foldAll, eqc };
  };

  if (C > 0) {
    options.push({ key: 'fold', kind: 'fold', label: 'Fold', ev: 0 });
    const allInCall = C >= S - 1e-9 || allVillainsAllIn;
    let evCall = (allInCall ? 1 : Rm) * eq * (P + C) - C + (allInCall ? 0 : fv(eq, P + C, S - C));
    if (!allInCall && heroDraw) evCall += (river ? 0 : heroPpot / (c.street === 'flop' ? 2 : 1)) * 0.35 * Math.min(S - C, P + C) * 0.6;
    options.push({ key: 'call', kind: 'call', label: `Call ${fmtBB(C / bb)}`, ev: evCall / bb });
    if (S > C && !allVillainsAllIn) {
      const sizes = new Set<number>();
      const cents = (x: number) => Math.round(x * 100) / 100;
      const std = cents(c.currentBet * 3);
      const allInTo = cents(h.commit + S);
      if (std < allInTo * 0.8) sizes.add(std);
      if (allInTo <= (P + C) * 3 || sizes.size === 0) sizes.add(allInTo);
      if (a.type === 'raise') sizes.add(cents(a.toAmount));
      for (const to of [...sizes].sort((x, y) => x - y)) {
        if (options.some((o) => o.key === `raise:${round(to / bb, 1)}`)) continue;
        const r = evBetTo(to);
        const isAllIn = to >= allInTo - 1e-9;
        options.push({ key: `raise:${round(to / bb, 1)}`, kind: 'raise', label: isAllIn ? `All-in (${fmtBB(to / bb)})` : `Raise to ${fmtBB(to / bb)}`, toBB: to / bb, ev: r.ev / bb, foldPct: r.fold, eqWhenCalled: r.eqc });
      }
    }
  } else {
    let evCheck = Rm * eq * P + fv(eq, P, S);
    // Out of position, checking gives villain the chance to bet: model villain's betting range,
    // our best response to it, and the pot when villain checks back.
    const after = villains.filter((q) => POST_ORDER.indexOf(q.pos) > heroIdx && !q.allIn);
    if (after.length) {
      const mv = after.find((q) => q.name === c.lastAggressor) ?? after.find((q) => q.name === c.pfAggressor) ?? after[0];
      const others = villains.filter((q) => q !== mv).map((q) => q.range);
      const betR = Float32Array.from(mv.range);
      narrowRange(betR, bs, 'bet', 0.6, c.street, false);
      const chkR = Float32Array.from(mv.range);
      narrowRange(chkR, bs, 'check', 0, c.street, false);
      const wAll = sumW(mv.range);
      const aggr = mv.name === c.lastAggressor || mv.name === c.pfAggressor;
      const aggrMult = aggr ? (c.street === 'flop' ? 1.25 : c.street === 'turn' ? 1.1 : 1) : 1;
      const b = Math.min(0.85, Math.max(0.15, (sumW(betR) / Math.max(wAll, 1e-9)) * aggrMult));
      const sBet = Math.min(0.6 * P, mv.stack, S);
      const it2 = Math.round(c.iters * 0.5);
      const eqB = equityVsRanges(c.heroCards, board, [betR, ...others], it2, c.rand).equity;
      const eqK = equityVsRanges(c.heroCards, board, [chkR, ...others], it2, c.rand).equity;
      const Rv = river ? 1 : R;
      const evVsBet = Math.max(0, Rv * eqB * (P + 2 * sBet) - sBet + fv(eqB, P + 2 * sBet, S - sBet));
      evCheck = b * evVsBet + (1 - b) * (Rm * eqK * P + fv(eqK, P, S));
    }
    options.push({ key: 'check', kind: 'check', label: 'Check', ev: evCheck / bb });
    if (S > 0 && !allVillainsAllIn) {
      const sizes = new Set<number>();
      const maxBet = Math.min(S, villainBehindStack - 0);
      for (const f of [0.33, 0.5, 0.75, 1.0]) {
        const amt = P * f;
        if (amt < maxBet * 0.9) sizes.add(Math.round(amt * 100) / 100);
      }
      if (maxBet <= P * 1.3 || sizes.size === 0) sizes.add(Math.round(maxBet * 100) / 100);
      if (a.type === 'bet') sizes.add(Math.round(a.toAmount * 100) / 100);
      for (const amt of [...sizes].sort((x, y) => x - y)) {
        if (options.some((o) => o.key === `bet:${round(amt / bb, 1)}`)) continue;
        const r = evBetTo(amt + h.commit);
        const isAllIn = amt >= maxBet - 1e-9;
        const frac = amt / P;
        options.push({
          key: `bet:${round(amt / bb, 1)}`,
          kind: 'bet',
          label: isAllIn ? `All-in (${fmtBB(amt / bb)})` : `Bet ${Math.round(frac * 100)}% (${fmtBB(amt / bb)})`,
          toBB: amt / bb,
          ev: r.ev / bb,
          foldPct: r.fold,
          eqWhenCalled: r.eqc,
        });
      }
    }
  }

  // Hero's option key
  let heroKey: string;
  if (a.type === 'fold') heroKey = 'fold';
  else if (a.type === 'check') heroKey = 'check';
  else if (a.type === 'call') heroKey = 'call';
  else {
    const to = a.type === 'bet' ? a.toAmount : a.toAmount;
    heroKey = `${a.type === 'bet' && C === 0 ? 'bet' : 'raise'}:${round(to / bb, 1)}`;
    if (!options.some((o) => o.key === heroKey)) {
      // Find closest option of same kind
      const kind = C === 0 ? 'bet' : 'raise';
      const same = options.filter((o) => o.kind === kind);
      if (same.length) heroKey = same.reduce((m, o) => (Math.abs((o.toBB ?? 0) - to / bb) < Math.abs((m.toBB ?? 0) - to / bb) ? o : m)).key;
    }
  }
  if (a.type === 'check' && C > 0) heroKey = 'call';
  for (const o of options) o.ev = round(o.ev ?? 0, 2);
  let best = options[0];
  for (const o of options) if ((o.ev ?? 0) > (best.ev ?? 0) + 1e-9) best = o;
  const heroOpt = options.find((o) => o.key === heroKey) ?? options[0];
  if (Math.abs((heroOpt.ev ?? 0) - (best.ev ?? 0)) < 1e-6) best = heroOpt;
  const loss = Math.max(0, (best.ev ?? 0) - (heroOpt.ev ?? 0));
  const potBB = P / bb;
  // Same action, different size: the model is least certain about sizing, so grade it more gently.
  const sizingOnly = heroOpt.kind === best.kind && (heroOpt.kind === 'bet' || heroOpt.kind === 'raise');
  // Slow-playing a very strong hand before the river is a legitimate mixed strategy; grade it gently.
  const slowplay = !river && heroHS >= 0.9 && (heroOpt.kind === 'check' || heroOpt.kind === 'call') && (best.kind === 'bet' || best.kind === 'raise');
  let cls_ = classifyPostflop(sizingOnly || slowplay ? loss * 0.5 : loss, potBB);
  if (slowplay && (cls_ === 'mistake' || cls_ === 'blunder')) cls_ = 'inaccuracy';

  // Special labels
  const sorted = [...options].sort((x, y) => (y.ev ?? 0) - (x.ev ?? 0));
  const second = sorted.find((o) => o.key !== best.key && !(o.kind === best.kind && (o.kind === 'bet' || o.kind === 'raise')));
  const passiveBest = Math.max(...options.filter((o) => o.kind === 'check' || o.kind === 'fold' || o.kind === 'call').map((o) => o.ev ?? 0));
  if (cls_ === 'best') {
    const margin = second ? (best.ev ?? 0) - (second.ev ?? 0) : 0;
    if ((heroOpt.kind === 'bet' || heroOpt.kind === 'raise') && eq < 0.35 && (heroOpt.ev ?? 0) - passiveBest >= 0.08 * potBB && (heroOpt.toBB ?? 0) >= 0.45 * potBB) cls_ = 'brilliant';
    else if (heroOpt.kind === 'call' && C / bb >= 0.5 * (potBB - C / bb) && heroHS < 0.75 && (heroOpt.ev ?? 0) >= 0.05 * potBB && eq < 0.5) cls_ = 'brilliant';
    else if (
      margin >= 0.2 * potBB && margin >= 2 &&
      !((heroOpt.kind === 'fold' || heroOpt.kind === 'check') && eq < 0.25) &&
      !(heroOpt.kind === 'call' && eq > 0.8)
    ) cls_ = 'great';
  } else if ((cls_ === 'inaccuracy' || cls_ === 'mistake') && (heroOpt.kind === 'check' || heroOpt.kind === 'call') && (best.kind === 'bet' || best.kind === 'raise') && (heroHS >= 0.85 || eq >= 0.7) && loss >= 1) {
    cls_ = 'miss';
  }

  // Leak tagging
  let leak: LeakId | undefined;
  if (isErrorC(cls_)) {
    const hk = heroOpt.kind;
    const bk = best.kind;
    if (hk === 'fold') leak = 'pos_overfold';
    else if ((hk === 'bet' || hk === 'raise') && bk === hk) leak = 'pos_sizing';
    else if (hk === 'call' && bk === 'fold') leak = 'pos_call_loose';
    else if ((hk === 'call' || hk === 'check') && (bk === 'bet' || bk === 'raise')) leak = heroHS >= 0.8 ? 'pos_missed_value' : heroDraw ? 'pos_passive_draws' : eq >= 0.62 ? 'pos_missed_value' : 'pos_missed_bluff';
    else if (hk === 'bet' || hk === 'raise') leak = eq < 0.4 ? 'pos_overbluff' : 'pos_thin_value';
  }

  // Explanation
  const comp = multiway
    ? villains.slice(0, 3).map((q) => `${q.pos}: ${describeComposition(rangeComposition(q.range, bs))}`).join(' | ')
    : describeComposition(rangeComposition(ranges[0], bs));
  const facing = C > 0 ? `facing ${Math.round((C / Math.max(P - C, 1e-9)) * 100)}% pot ${c.streetBetCount > 1 ? 'raise' : 'bet'}` : c.streetBetCount === 0 ? (ip ? 'checked to you' : 'first to act') : '';
  const streetName = c.street[0].toUpperCase() + c.street.slice(1);
  const role = c.pfAggressor === h.name ? 'as preflop raiser' : c.pfAggressor ? 'as preflop caller' : 'limped pot';
  const spot = `${streetName} · ${ip ? 'IP' : 'OOP'}${multiway ? ` · ${villains.length + 1}-way` : ''} · ${facing}`;
  const scenario = `${c.street}_${C > 0 ? 'facing_bet' : c.pfAggressor === h.name && c.streetBetCount === 0 ? 'as_aggressor' : 'checked_to'}`;
  const potOdds = C > 0 ? C / (P + C) : undefined;
  const explanation: string[] = [];
  explanation.push(`You hold ${handLabel} on a ${describeBoard(board)} board (${role}).`);
  explanation.push(
    multiway
      ? `Opponents' ranges here — ${comp}. Your equity vs all of them: ${pctStr(eq)}.`
      : `${villains[0].pos}'s range here: ${comp}. Your equity vs it: ${pctStr(eq)}.`,
  );
  if (potOdds !== undefined) explanation.push(`You need ${pctStr(potOdds)} equity to call ${fmtBB(C / bb)} into ${fmtBB(potBB)}${heroDraw && !river ? ' (plus some implied odds with your draw)' : ''}.`);
  const fmtOpt = (o: OptionEV) => `${o.label} (${signedBB(o.ev ?? 0)}${o.foldPct !== undefined ? `, folds ${pctStr(o.foldPct)}, ${pctStr(o.eqWhenCalled ?? 0)} when called` : ''})`;
  if (best.key === heroOpt.key) explanation.push(`Your play — ${fmtOpt(heroOpt)} — is the top option.`);
  else explanation.push(`You chose ${fmtOpt(heroOpt)}; best was ${fmtOpt(best)}. Difference: ${fmtBB(loss)}.`);
  const tip = postflopTip(leak, { eq, potOdds, heroHS, heroDraw, river, best, heroOpt });
  if (tip) explanation.push(tip);

  return {
    actionIndex: c.ai,
    street: c.street,
    heroKey: heroOpt.key,
    heroLabel: actionLabel(a, bb),
    potBB: round(potBB),
    toCallBB: round(C / bb),
    stackBB: round(S / bb),
    spot,
    scenario,
    options: sorted,
    bestKey: best.key,
    evLoss: round(loss),
    classification: cls_,
    accuracy: accuracyFor(loss, potBB),
    trivial: false,
    handLabel,
    equity: eq,
    potOdds,
    villainRange: comp,
    leak,
    explanation,
    board: [...board],
    ip,
    multiway,
  };
}

function postflopTip(
  leak: LeakId | undefined,
  x: { eq: number; potOdds?: number; heroHS: number; heroDraw: boolean; river: boolean; best: OptionEV; heroOpt: OptionEV },
): string | null {
  switch (leak) {
    case 'pos_call_loose':
      return `Calling needs ${pctStr(x.potOdds ?? 0)} but you only have ~${pctStr(x.eq)} against a betting range this strong. When the price is wrong and you're not drawing, let it go.`;
    case 'pos_overfold':
      return `You had ~${pctStr(x.eq)} equity against a ${pctStr(x.potOdds ?? 0)} price. Folding here lets bets with weak hands print money against you.`;
    case 'pos_missed_value':
      return 'Strong hands make money by getting called by worse. Checking/calling here leaves value on the table — bet or raise and let weaker hands pay you.';
    case 'pos_missed_bluff':
      return x.eq >= 0.35
        ? `${x.best.label} folds out hands that beat or chop with you (${pctStr(x.best.foldPct ?? 0)} folds) and still has ${pctStr(x.best.eqWhenCalled ?? 0)} equity when called.`
        : `${x.best.label} wins the pot often enough (${pctStr(x.best.foldPct ?? 0)} folds) to be profitable with a hand that rarely wins at showdown.`;
    case 'pos_overbluff':
      return `This bluff doesn't get enough folds (${pctStr(x.heroOpt.foldPct ?? 0)}) against a range that is strong here, and you have little equity when called.`;
    case 'pos_thin_value':
      return `When called you're only ${pctStr(x.heroOpt.eqWhenCalled ?? 0)} — worse hands fold and better hands continue. Pot control is better with this hand.`;
    case 'pos_passive_draws':
      return 'Strong draws play best aggressively: you can win immediately with fold equity and still have plenty of outs when called.';
    case 'pos_sizing':
      return `Same idea, wrong size. ${x.best.label} gets a better mix of folds and calls than your sizing.`;
    default:
      return null;
  }
}

function comboIdx([a, b]: [Card, Card]): number {
  for (let i = 0; i < 1326; i++) {
    const [x, y] = COMBOS[i];
    if ((x === a && y === b) || (x === b && y === a)) return i;
  }
  return 0;
}

export const fmtBB = (x: number) => `${x >= 10 ? Math.round(x * 10) / 10 : Math.round(x * 100) / 100}bb`;
export const signedBB = (x: number) => `${x >= 0 ? '+' : ''}${fmtBB(x)}`;
export const pctStr = (x: number) => `${Math.round(x * 100)}%`;

function actionLabel(a: Action, bb: number, chart?: Chart, openWord?: string): string {
  switch (a.type) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      return chart?.freeCall ? 'Check' : `Call ${fmtBB(a.amount / bb)}${a.allIn ? ' (all-in)' : ''}`;
    case 'bet':
      return `Bet ${fmtBB(a.toAmount / bb)}${a.allIn ? ' (all-in)' : ''}`;
    case 'raise':
      return `${openWord ?? (chart ? chart.raiseLabel : 'Raise')} to ${fmtBB(a.toAmount / bb)}${a.allIn ? ' (all-in)' : ''}`;
    default:
      return a.type;
  }
}

// ---------------------------------------------------------------------------
// All-in EV adjustment ("luck")
// ---------------------------------------------------------------------------

function allInAdjustedNet(hand: Hand, rand: () => number): number | null {
  if (!hand.wentToShowdown) return null;
  // Find the point where no further betting is possible: last action before board completes with an all-in.
  let allInStreet: Street | null = null;
  for (const a of hand.actions) if (a.allIn && a.type !== 'post' && a.type !== 'fold') allInStreet = a.street;
  if (!allInStreet || allInStreet === 'river') return null;
  // Ensure all remaining opponents' cards are known.
  const folded = new Set(hand.actions.filter((a) => a.type === 'fold').map((a) => a.player));
  const alive = hand.players.filter((p) => !folded.has(p.name));
  if (alive.length !== 2 || alive.some((p) => !p.cards)) return null;
  // Board at the time everybody was all-in = cards dealt before the next street after the last action.
  const lastActStreet = hand.actions[hand.actions.length - 1].street;
  const known = hand.board.slice(0, lastActStreet === 'preflop' ? 0 : lastActStreet === 'flop' ? 3 : lastActStreet === 'turn' ? 4 : 5);
  if (known.length === 5) return null;
  const heroIdx = alive.findIndex((p) => p.isHero);
  const eqs = equityKnownHands(alive.map((p) => p.cards!) as [Card, Card][], known, rand);
  const heroIn = hand.actions.filter((a) => a.player === hand.hero).reduce((s, a) => s + a.amount, 0) - (hand.uncalled[hand.hero] ?? 0);
  const potAfterRake = hand.totalPot - hand.rake;
  const evNet = eqs[heroIdx] * potAfterRake - heroIn;
  void cardsToString;
  return evNet / hand.bb;
}
