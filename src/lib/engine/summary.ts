import type { Position, Street } from '../types.ts';
import { weightedAccuracy } from './classify.ts';
import { LEAKS, type LeakInfo } from './leaks.ts';
import type { Classification, Decision, HandAnalysis, LeakId } from './types.ts';

export interface LeakAgg {
  id: LeakId;
  info: LeakInfo;
  count: number;
  lossBB: number;
  per100: number;
  examples: { handId: string; actionIndex: number; loss: number }[];
}

export interface StatLine {
  key: string;
  label: string;
  value: number | null;
  n: number;
  lo: number;
  hi: number;
  unit: '%' | 'x';
  status: 'low' | 'ok' | 'high' | 'na';
  tipLow: string;
  tipHigh: string;
}

export interface PosAgg {
  pos: Position;
  hands: number;
  netBB: number;
  bb100: number;
  vpip: number;
  evLossBB: number;
}

export interface Summary {
  hands: number;
  netBB: number;
  evNetBB: number;
  bb100: number;
  evBb100: number;
  accuracy: number | null;
  decisionsReviewed: number;
  classCounts: Record<Classification, number>;
  evLossBB: number;
  evLossPer100: number;
  leaks: LeakAgg[];
  stats: StatLine[];
  positions: PosAgg[];
  graph: { i: number; net: number; ev: number; sd: number; nsd: number }[];
  streets: { street: Street; decisions: number; lossBB: number; accuracy: number | null }[];
  worstHands: { handId: string; loss: number; worst: Classification | null; netBB: number }[];
  sessions: { date: string; hands: number; netBB: number; accuracy: number | null }[];
}

const EMPTY_COUNTS = (): Record<Classification, number> => ({
  brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0,
});

export function summarize(analyses: HandAnalysis[]): Summary {
  const n = analyses.length;
  const classCounts = EMPTY_COUNTS();
  const leakMap = new Map<LeakId, LeakAgg>();
  let netBB = 0;
  let evNetBB = 0;
  let evLossBB = 0;
  const allDecisions: Decision[] = [];
  const streetAgg: Record<Street, { d: number; loss: number; list: typeof allDecisions }> = {
    preflop: { d: 0, loss: 0, list: [] }, flop: { d: 0, loss: 0, list: [] }, turn: { d: 0, loss: 0, list: [] }, river: { d: 0, loss: 0, list: [] },
  };
  const graph: Summary['graph'] = [];
  let sd = 0;
  let nsd = 0;
  const step = Math.max(1, Math.ceil(n / 600));
  const posMap = new Map<Position, PosAgg>();
  const sessMap = new Map<string, { hands: number; netBB: number; ds: typeof allDecisions }>();

  analyses.forEach((a, i) => {
    netBB += a.netBB;
    evNetBB += a.evNetBB;
    evLossBB += a.evLossBB;
    if (a.wentToShowdown) sd += a.netBB;
    else nsd += a.netBB;
    if (i % step === 0 || i === n - 1) graph.push({ i: i + 1, net: r1(netBB), ev: r1(evNetBB), sd: r1(sd), nsd: r1(nsd) });
    const pa = posMap.get(a.heroPosition) ?? { pos: a.heroPosition, hands: 0, netBB: 0, bb100: 0, vpip: 0, evLossBB: 0 };
    pa.hands++;
    pa.netBB += a.netBB;
    pa.evLossBB += a.evLossBB;
    if (a.stats.vpip) pa.vpip++;
    posMap.set(a.heroPosition, pa);
    const day = (a.date || '').slice(0, 10) || 'unknown';
    const sess = sessMap.get(day) ?? { hands: 0, netBB: 0, ds: [] };
    sess.hands++;
    sess.netBB += a.netBB;
    for (const d of a.decisions) {
      if (d.trivial) continue;
      classCounts[d.classification]++;
      allDecisions.push(d);
      sess.ds.push(d);
      const sa = streetAgg[d.street];
      sa.d++;
      sa.loss += d.evLoss;
      sa.list.push(d);
      if (d.leak) {
        const la = leakMap.get(d.leak) ?? { id: d.leak, info: LEAKS[d.leak], count: 0, lossBB: 0, per100: 0, examples: [] };
        la.count++;
        la.lossBB += d.evLoss;
        la.examples.push({ handId: a.handId, actionIndex: d.actionIndex, loss: d.evLoss });
        leakMap.set(d.leak, la);
      }
    }
    sessMap.set(day, sess);
  });

  const leaks = [...leakMap.values()]
    .map((l) => ({ ...l, lossBB: r1(l.lossBB), per100: n ? r1((l.lossBB / n) * 100) : 0, examples: l.examples.sort((x, y) => y.loss - x.loss).slice(0, 25) }))
    .sort((x, y) => y.lossBB - x.lossBB);

  const positions = ORDER.filter((p) => posMap.has(p)).map((p) => {
    const x = posMap.get(p)!;
    return { ...x, netBB: r1(x.netBB), bb100: r1((x.netBB / x.hands) * 100), vpip: x.vpip / x.hands, evLossBB: r1(x.evLossBB) };
  });

  const worstHands = analyses
    .filter((a) => a.evLossBB > 0)
    .map((a) => ({ handId: a.handId, loss: a.evLossBB, worst: a.worst, netBB: a.netBB }))
    .sort((x, y) => y.loss - x.loss)
    .slice(0, 12);

  return {
    hands: n,
    netBB: r1(netBB),
    evNetBB: r1(evNetBB),
    bb100: n ? r1((netBB / n) * 100) : 0,
    evBb100: n ? r1((evNetBB / n) * 100) : 0,
    accuracy: allDecisions.length ? weightedAccuracy(allDecisions) : null,
    decisionsReviewed: allDecisions.length,
    classCounts,
    evLossBB: r1(evLossBB),
    evLossPer100: n ? r1((evLossBB / n) * 100) : 0,
    leaks,
    stats: computeStats(analyses),
    positions,
    graph,
    streets: (['preflop', 'flop', 'turn', 'river'] as Street[]).map((s) => ({
      street: s,
      decisions: streetAgg[s].d,
      lossBB: r1(streetAgg[s].loss),
      accuracy: streetAgg[s].list.length ? weightedAccuracy(streetAgg[s].list) : null,
    })),
    worstHands,
    sessions: [...sessMap.entries()].sort().map(([date, s]) => ({ date, hands: s.hands, netBB: r1(s.netBB), accuracy: s.ds.length ? weightedAccuracy(s.ds) : null })),
  };
}

const ORDER: Position[] = ['UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const r1 = (x: number) => Math.round(x * 10) / 10;

export function computeStats(analyses: HandAnalysis[]): StatLine[] {
  const c = (f: (a: HandAnalysis) => boolean) => analyses.filter(f).length;
  const S = (a: HandAnalysis) => a.stats;
  const hands = analyses.length;
  const ratio = (num: number, den: number) => (den ? num / den : null);
  const bets = analyses.reduce((s, a) => s + a.stats.postBets + a.stats.postRaises, 0);
  const calls = analyses.reduce((s, a) => s + a.stats.postCalls, 0);
  const folds = analyses.reduce((s, a) => s + a.stats.postFolds, 0);
  const lines: Omit<StatLine, 'status'>[] = [
    { key: 'vpip', label: 'VPIP', value: ratio(c((a) => S(a).vpip), hands), n: hands, lo: 0.21, hi: 0.28, unit: '%', tipLow: 'You play very few hands — you can open and defend wider, especially in position.', tipHigh: 'You voluntarily play too many hands. Tighten up, especially out of position.' },
    { key: 'pfr', label: 'PFR', value: ratio(c((a) => S(a).pfr), hands), n: hands, lo: 0.17, hi: 0.23, unit: '%', tipLow: 'You raise too rarely — be the aggressor preflop instead of limping/calling.', tipHigh: 'You raise a very wide range; make sure your opens hold up versus 3-bets.' },
    { key: 'threebet', label: '3-Bet', value: ratio(c((a) => S(a).threeBet), c((a) => S(a).threeBetOpp)), n: c((a) => S(a).threeBetOpp), lo: 0.06, hi: 0.11, unit: '%', tipLow: 'You rarely 3-bet. Add value 3-bets (QQ+, AK, AQs) and suited-ace bluffs.', tipHigh: 'You 3-bet a lot; good players will 4-bet you light.' },
    { key: 'fold3bet', label: 'Fold to 3-Bet', value: ratio(c((a) => S(a).foldTo3Bet), c((a) => S(a).foldTo3BetOpp)), n: c((a) => S(a).foldTo3BetOpp), lo: 0.4, hi: 0.58, unit: '%', tipLow: 'You continue vs 3-bets too often — many of those hands are dominated.', tipHigh: 'You fold too much vs 3-bets; opponents can 3-bet you with anything.' },
    { key: 'steal', label: 'Steal (ATS)', value: ratio(c((a) => S(a).steal), c((a) => S(a).stealOpp)), n: c((a) => S(a).stealOpp), lo: 0.35, hi: 0.52, unit: '%', tipLow: 'You miss steals from CO/BTN/SB — these are your most profitable opens.', tipHigh: 'You steal very wide; watch for blind 3-bets.' },
    { key: 'bbfold', label: 'BB fold vs steal', value: ratio(c((a) => S(a).bbFoldVsSteal), c((a) => S(a).bbVsStealOpp)), n: c((a) => S(a).bbVsStealOpp), lo: 0.3, hi: 0.48, unit: '%', tipLow: 'You defend the BB extremely wide — fine if you play well postflop.', tipHigh: 'You fold your big blind too often vs steals. You get a great price — defend wider.' },
    { key: 'limp', label: 'Open limp', value: ratio(c((a) => S(a).limp), hands), n: hands, lo: 0, hi: 0.02, unit: '%', tipLow: '', tipHigh: 'You open-limp. Raise or fold when first in.' },
    { key: 'cbet', label: 'Flop C-Bet', value: ratio(c((a) => S(a).cbet), c((a) => S(a).cbetOpp)), n: c((a) => S(a).cbetOpp), lo: 0.45, hi: 0.72, unit: '%', tipLow: 'You give up too often as the preflop raiser.', tipHigh: 'You c-bet almost always; observant players will float and raise you.' },
    { key: 'foldcbet', label: 'Fold to C-Bet', value: ratio(c((a) => S(a).foldToCbet), c((a) => S(a).foldToCbetOpp)), n: c((a) => S(a).foldToCbetOpp), lo: 0.35, hi: 0.52, unit: '%', tipLow: 'You rarely fold to c-bets — make sure you are not floating with nothing.', tipHigh: 'You fold to c-bets too much; opponents profit by betting any two cards.' },
    { key: 'wtsd', label: 'WTSD', value: ratio(c((a) => S(a).wtsd), c((a) => S(a).sawFlop)), n: c((a) => S(a).sawFlop), lo: 0.24, hi: 0.32, unit: '%', tipLow: 'You rarely reach showdown — you may be over-folding later streets.', tipHigh: 'You go to showdown too often — a classic calling-station sign.' },
    { key: 'wsd', label: 'W$SD', value: ratio(c((a) => S(a).wonAtShowdown), c((a) => S(a).wtsd)), n: c((a) => S(a).wtsd), lo: 0.48, hi: 0.58, unit: '%', tipLow: 'You lose too many showdowns — you are calling with too many weak hands.', tipHigh: 'You win most showdowns — you could be folding too much / missing thin calls.' },
    { key: 'wwsf', label: 'WWSF', value: ratio(c((a) => S(a).wonWhenSawFlop), c((a) => S(a).sawFlop)), n: c((a) => S(a).sawFlop), lo: 0.42, hi: 0.54, unit: '%', tipLow: 'You win few pots after the flop — add more aggression.', tipHigh: '' },
    { key: 'af', label: 'Aggression factor', value: calls ? bets / calls : bets ? 5 : null, n: bets + calls, lo: 2, hi: 4, unit: 'x', tipLow: 'Postflop you call much more than you bet/raise. Passive play leaves money on the table.', tipHigh: 'Very aggressive postflop; make sure your bluffs pick good spots.' },
    { key: 'afq', label: 'Aggression freq', value: ratio(bets, bets + calls + folds), n: bets + calls + folds, lo: 0.4, hi: 0.6, unit: '%', tipLow: 'Low aggression frequency postflop.', tipHigh: '' },
  ];
  return lines.map((l) => {
    const minN = l.key === 'vpip' || l.key === 'pfr' || l.key === 'limp' ? 30 : 12;
    let status: StatLine['status'] = 'ok';
    if (l.value === null || l.n < minN) status = 'na';
    else if (l.value < l.lo) status = 'low';
    else if (l.value > l.hi) status = 'high';
    if ((status === 'low' && !l.tipLow) || (status === 'high' && !l.tipHigh)) status = 'ok';
    return { ...l, status };
  });
}
