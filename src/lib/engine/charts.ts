import type { Position } from '../types.ts';
import { parseRangeClasses, RFI_SPECS } from './ranges.ts';

/**
 * Preflop strategy charts (6-max / 9-max cash, ~100bb, 2.5x opens).
 * These are simplified, solver-inspired baselines — tidy enough to memorise, close enough
 * to equilibrium that deviations from them are almost always real leaks.
 */
export interface ChartSpec {
  raise: string;
  call: string;
  /** Label for the aggressive action ("Open", "3-bet", "4-bet", "Jam"...). */
  raiseLabel: string;
  /** Label for the passive action ("Call", "Limp", "Check"). */
  callLabel: string;
  /** When true, the passive action costs nothing (BB checking a limped pot). */
  freeCall?: boolean;
}

export interface Chart extends ChartSpec {
  raiseW: Map<string, number>;
  callW: Map<string, number>;
}

export interface Freq {
  fold: number;
  call: number;
  raise: number;
}

const cache = new Map<string, Chart>();
export function chart(spec: ChartSpec): Chart {
  const key = JSON.stringify(spec);
  let c = cache.get(key);
  if (!c) {
    c = { ...spec, raiseW: parseRangeClasses(spec.raise), callW: parseRangeClasses(spec.call) };
    cache.set(key, c);
  }
  return c;
}

export function freqOf(c: Chart, cls: string): Freq {
  const raise = c.raiseW.get(cls) ?? 0;
  const call = Math.min(c.callW.get(cls) ?? 0, 1 - raise);
  return { raise, call, fold: Math.max(0, 1 - raise - call) };
}

export type OpenerGroup = 'EP' | 'HJ' | 'CO' | 'BTN' | 'SB';
export function openerGroup(pos: Position): OpenerGroup {
  if (pos === 'HJ') return 'HJ';
  if (pos === 'CO') return 'CO';
  if (pos === 'BTN') return 'BTN';
  if (pos === 'SB') return 'SB';
  return 'EP';
}

export function rfiSpecFor(pos: Position, tableSize: number): string {
  switch (pos) {
    case 'UTG':
      return tableSize >= 8 ? RFI_SPECS.EP9 : tableSize === 7 ? RFI_SPECS.EP8 : RFI_SPECS.UTG;
    case 'UTG+1':
      return tableSize >= 9 ? RFI_SPECS.EP9 : RFI_SPECS.EP8;
    case 'UTG+2':
    case 'UTG+3':
      return RFI_SPECS.EP8;
    case 'LJ':
      return RFI_SPECS.UTG;
    case 'HJ':
      return RFI_SPECS.HJ;
    case 'CO':
      return RFI_SPECS.CO;
    case 'BTN':
      return RFI_SPECS.BTN;
    case 'SB':
      return RFI_SPECS.SB;
    default:
      return RFI_SPECS.BTN;
  }
}

export const rfiChart = (pos: Position, tableSize: number) =>
  chart({ raise: rfiSpecFor(pos, tableSize), call: '', raiseLabel: 'Raise', callLabel: 'Limp' });

/** Short-stack (<= 20bb) open-shove ranges, roughly Nash push ranges. */
const JAM_SPECS: Record<OpenerGroup, string> = {
  EP: '55+, A9s+, ATo+, KJs+, KQo',
  HJ: '44+, A7s+, A9o+, KTs+, KQo, QJs',
  CO: '33+, A2s+, A8o+, K9s+, KJo+, QTs+, JTs',
  BTN: '22+, A2s+, A2o+, K5s+, K9o+, Q8s+, QTo+, J8s+, JTo, T8s+, 98s',
  SB: '22+, A2s+, A2o+, K2s+, K7o+, Q5s+, Q9o+, J7s+, J9o+, T7s+, T9o, 97s+, 86s+, 76s, 65s',
};
export const jamChart = (pos: Position) =>
  chart({ raise: JAM_SPECS[openerGroup(pos)], call: '', raiseLabel: 'Jam', callLabel: 'Limp' });

const VS_OPEN: Record<string, { raise: string; call: string }> = {
  'IP:EP': { raise: 'KK+, QQ:0.7, AKs:0.8, AKo:0.7, A5s:0.5, A4s:0.5', call: 'QQ-22, AK, AQs-ATs, KQs, KJs, QJs, JTs, T9s, 98s, AQo:0.6' },
  'IP:HJ': { raise: 'JJ+, AQs+, AKo, A5s-A4s, KQs:0.5', call: 'TT-22, AJs-ATs, KJs+, QJs, JTs, T9s, 98s, 87s, AQo, KQo:0.5' },
  'IP:CO': { raise: 'TT+, AJs+, AQo+, KQs, A5s-A2s, K9s:0.5, 76s:0.5, 65s:0.5', call: '99-22, ATs-A6s, KTs-KJs, QTs+, JTs, T9s, 98s, 87s, 76s, AJo, KQo' },
  'SB:EP': { raise: 'QQ+, AK, AQs, A5s:0.5', call: 'JJ-99:0.5' },
  'SB:HJ': { raise: 'JJ+, AQs+, AKo, KQs, A5s-A4s', call: 'TT-88:0.4' },
  'SB:CO': { raise: 'TT+, AJs+, AQo+, KQs, KJs:0.5, A5s-A2s, QJs:0.5, JTs:0.5', call: '' },
  'SB:BTN': { raise: '88+, A9s+, AJo+, KTs+, KQo, QTs+, JTs, T9s, A5s-A2s, 98s:0.5, 87s:0.5, 76s:0.5, 65s:0.5', call: '' },
  'BB:EP': {
    raise: 'QQ+, AKs, AKo:0.75, A5s:0.5',
    call: 'JJ-22, AQs-A2s, AQo-ATo, KQs-K8s, KJo+, QJs-Q9s, QJo, JTs-J9s, T9s-T8s, 98s-97s, 87s-86s, 76s-75s, 65s-64s, 54s',
  },
  'BB:HJ': {
    raise: 'JJ+, AQs+, AKo, A5s-A4s',
    call: 'TT-22, AJs-A2s, AQo-A9o, KQs-K6s, KTo+, QJs-Q8s, QTo+, JTs-J8s, JTo, T9s-T7s, 98s-96s, 87s-85s, 76s-75s, 65s-64s, 54s-53s',
  },
  'BB:CO': {
    raise: 'TT+, AJs+, AQo+, KQs, A5s-A2s, K9s:0.5, 76s:0.5, 65s:0.5',
    call: '99-22, ATs-A6s, AJo-A7o, KJs-K2s, K9o+, QJs-Q5s, Q9o+, JTs-J6s, J9o+, T9s-T6s, T9o, 98s-95s, 98o, 87s-85s, 87o:0.5, 76s-74s, 65s-63s, 54s-53s, 43s',
  },
  'BB:BTN': {
    raise: '99+, ATs+, AJo+, KJs+, A5s-A2s, K9s:0.5, Q9s:0.5, J9s:0.5, T8s:0.5, 87s:0.5, 76s:0.5, 65s:0.5',
    call: '88-22, A9s-A6s, ATo-A2o, KTs-K2s, KJo-K5o, Q2s+, Q8o+, J4s+, J8o+, T6s+, T8o+, 95s+, 97o+, 85s+, 86o+, 74s+, 75o+, 63s+, 64o+, 53s+, 54o, 42s+',
  },
  'BB:SB': {
    raise: '88+, ATs+, AJo+, KTs+, KQo, QJs, A5s-A2s, J9s:0.5, T8s:0.5, 97s:0.5, 86s:0.5, 75s:0.5, 64s:0.5',
    call: '77-22, A9s-A2s, ATo-A2o, K9s-K2s, KJo-K6o, Q2s+, Q8o+, J5s+, J8o+, T6s+, T8o+, 96s+, 97o+, 85s+, 87o, 74s+, 76o, 63s+, 65o, 53s+, 43s',
  },
};

export function heroGroupVsOpen(pos: Position): 'IP' | 'SB' | 'BB' {
  if (pos === 'SB') return 'SB';
  if (pos === 'BB') return 'BB';
  return 'IP';
}

export function vsOpenChart(heroPos: Position, openerPos: Position, callers: number): Chart {
  const hg = heroGroupVsOpen(heroPos);
  let og = openerGroup(openerPos);
  if (hg === 'IP' && (og === 'BTN' || og === 'SB')) og = 'CO';
  if (hg === 'SB' && og === 'SB') og = 'BTN';
  const base = VS_OPEN[`${hg}:${og}`] ?? VS_OPEN['IP:CO'];
  // With callers in between (squeeze spot) tighten the flatting range a bit; BB gets a better price.
  const call = callers > 0 && hg !== 'BB' ? scaleSpec(base.call, 0.6) : base.call;
  return chart({ raise: base.raise, call, raiseLabel: '3-bet', callLabel: 'Call' });
}

const VS_3BET = {
  OOP: { raise: 'KK+, AKs:0.7, AKo:0.5, A5s:0.5', call: 'QQ-77, AKs, AQs-ATs, AKo, KQs, KJs, QJs, JTs, T9s, AQo:0.4' },
  IP: { raise: 'KK+, QQ:0.6, AKs:0.7, AKo:0.6, A5s:0.5, A4s:0.5', call: 'QQ-55, AKs, AKo, AQs-A8s, AQo-AJo, KTs+, KQo, QTs+, JTs, T9s, 98s, 87s, 76s, 65s' },
  SBvsBB: { raise: 'KK+, QQ:0.6, AK:0.6, A5s:0.5', call: 'QQ-66, AK, AQs-A8s, AQo-AJo, KTs+, KQo, QTs+, JTs, T9s, 98s, 87s' },
};

export function vs3betChart(heroPos: Position, threeBettorPos: Position): Chart {
  let key: keyof typeof VS_3BET;
  if (heroPos === 'SB' && threeBettorPos === 'BB') key = 'SBvsBB';
  else if (threeBettorPos === 'SB' || threeBettorPos === 'BB') key = 'IP';
  else key = 'OOP';
  return chart({ ...VS_3BET[key], raiseLabel: '4-bet', callLabel: 'Call' });
}

export const vs4betChart = () =>
  chart({ raise: 'QQ+, AKs, AKo:0.75', call: 'JJ:0.4, AQs:0.3', raiseLabel: '5-bet jam', callLabel: 'Call' });

export const cold4betChart = () =>
  chart({ raise: 'QQ+, AKs, AKo:0.6, A5s:0.2', call: 'JJ:0.3, AQs:0.25', raiseLabel: '4-bet', callLabel: 'Call' });

export const vsSqueezeChart = () =>
  chart({ raise: 'QQ+, AK', call: 'JJ-99, AQs, AJs, KQs', raiseLabel: '4-bet', callLabel: 'Call' });

export function vsLimpChart(heroPos: Position): Chart {
  if (heroPos === 'BB')
    return chart({ raise: '88+, A9s+, ATo+, KTs+, KQo, QJs:0.5', call: 'any', raiseLabel: 'Raise', callLabel: 'Check', freeCall: true });
  if (heroPos === 'SB')
    return chart({
      raise: '77+, A9s+, ATo+, KTs+, KQo, QJs',
      call: '22+, A2s+, K2s+, Q2s+, J4s+, T6s+, 95s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o+, K7o+, Q8o+, J8o+, T8o+, 97o+, 87o',
      raiseLabel: 'Raise',
      callLabel: 'Complete',
    });
  const late = heroPos === 'CO' || heroPos === 'BTN';
  return chart({
    raise: late ? '55+, A7s+, A5s-A2s, A9o+, K9s+, KJo+, QTs+, JTs, T9s' : '77+, A9s+, ATo+, KTs+, KQo, QJs',
    call: late ? '22-44, A6s, 98s, 87s, 76s, 65s, 54s' : '22-66, A2s-A8s, 98s, 87s, 76s, 65s',
    raiseLabel: 'Iso-raise',
    callLabel: 'Over-limp',
  });
}

export const limpVsRaiseChart = () =>
  chart({ raise: 'QQ+, AK', call: 'JJ-22, AQs-A9s, A5s-A4s, KQs, KJs, QJs, JTs, T9s, 98s, 87s, 76s, AQo', raiseLabel: 'Raise', callLabel: 'Call' });

/** Ranges villains are assumed to hold after a given preflop line. */
export const LIMP_RANGE =
  '22+:0.8, A2s+, K2s+, Q5s+, J7s+, T7s+, 97s+, 86s+, 76s, 65s, 54s, A2o+, K9o+, Q9o+, J9o+, T9o, AA:0.2, KK:0.2, QQ:0.3, AKs:0.3, AKo:0.3';
export const SB_COMPLETE_RANGE =
  '22+, A2s+, K2s+, Q2s+, J4s+, T6s+, 95s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o+, K7o+, Q8o+, J8o+, T8o+, 97o+, 87o, AA:0.2, KK:0.2, QQ:0.3, AK:0.3';
export const BB_CHECK_RANGE = 'any, AA:0.1, KK:0.1, QQ:0.2, JJ:0.4, AK:0.3, AQs:0.5';

function scaleSpec(spec: string, k: number): string {
  if (!spec) return spec;
  return [...parseRangeClasses(spec)].map(([c, w]) => `${c}:${(w * k).toFixed(2)}`).join(', ');
}
