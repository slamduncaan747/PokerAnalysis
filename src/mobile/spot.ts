import type { Question } from '../lib/training/drills.ts';
import type { RealStake } from '../settings.ts';
import type { Puzzle } from '../puzzles/types.ts';

/** What the player screen needs to draw one decision, whatever it came from (puzzle or own-hand drill). */
export interface ViewOption {
  key: string;
  /** Main text, already in the user's units. */
  label: string;
  sub?: string;
  group: 'passive' | 'aggr' | 'choice';
  tone: 'fold' | 'neutral' | 'aggr';
}

export interface SpotView {
  id: string;
  kind: 'table' | 'math';
  street: string;
  heroCards: [number, number];
  board: number[];
  heroPos: string;
  villainPos?: string;
  /** e.g. "Bets 15.9bb" / "Checks" next to the villain. */
  villainAction?: string;
  centerPotBB: number;
  toCallBB: number;
  stackBB: number;
  history: string[];
  prompt: string;
  handLabel?: string;
  options: ViewOption[];
  real?: RealStake;
}

export interface OutcomeBar {
  key: string;
  label: string;
  freq?: number;
  ev?: number;
}

export interface Outcome {
  ok: boolean;
  chosenKey: string;
  bestKey: string;
  correctKeys: string[];
  bestLabel: string;
  bars: OutcomeBar[];
  barSource?: 'solver' | 'chart' | 'engine';
  idea?: string;
  lines?: string[];
  facts: { label: string; value: string }[];
  delta?: number;
  ratingBefore?: number;
  /** Solved a puzzle well above your rating. */
  brilliant?: boolean;
}

type Fmt = (bb: number) => string;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function puzzleOptionLabels(p: Puzzle, fmt: Fmt): ViewOption[] {
  return p.options.map((o): ViewOption => {
    switch (o.kind) {
      case 'fold':
        return { key: o.key, label: 'Fold', group: 'passive', tone: 'fold' };
      case 'check':
        return { key: o.key, label: 'Check', group: 'passive', tone: 'neutral' };
      case 'call':
        return { key: o.key, label: `Call ${fmt(p.toCallBB)}`, group: 'passive', tone: 'neutral' };
      case 'bet':
        return { key: o.key, label: `Bet ${fmt(o.toBB!)}`, sub: `${Math.round((o.toBB! / Math.max(0.01, p.potBB)) * 100)}% pot`, group: 'aggr', tone: 'aggr' };
      case 'raise':
        return {
          key: o.key,
          label: `${p.street === 'preflop' && p.toCallBB <= 1 && !p.villainPos ? 'Raise' : 'Raise to'} ${fmt(o.toBB!)}`,
          sub: p.street === 'preflop' ? undefined : `${Math.round(((o.toBB! - p.toCallBB) / Math.max(0.01, p.potBB + p.toCallBB)) * 100)}% pot`,
          group: 'aggr',
          tone: 'aggr',
        };
      case 'allin':
        return { key: o.key, label: 'All-in', sub: fmt(o.toBB ?? p.stackBB), group: 'aggr', tone: 'aggr' };
      default:
        return { key: o.key, label: o.label ?? o.key, group: 'choice', tone: 'neutral' };
    }
  });
}

function villainActionOf(history: string[], villain?: string): string | undefined {
  if (!villain || !history.length) return undefined;
  // The villain's most recent action on the current street.
  const segs = history[history.length - 1].split(': ').slice(1).join(': ').split(' · ');
  const last = [...segs].reverse().find((x) => x.startsWith(villain + ' '));
  if (!last) return undefined;
  return cap(last.slice(villain.length + 1));
}

export function puzzleView(p: Puzzle, fmt: Fmt): SpotView {
  return {
    id: p.id,
    kind: p.kind === 'math' ? 'math' : 'table',
    street: p.street,
    heroCards: p.heroCards,
    board: p.board,
    heroPos: p.heroPos,
    villainPos: p.villainPos,
    villainAction: villainActionOf(p.history, p.villainPos),
    centerPotBB: p.kind === 'preflop' ? p.potBB : p.potBB - p.toCallBB,
    toCallBB: p.toCallBB,
    stackBB: p.stackBB,
    history: p.history,
    prompt: p.prompt,
    handLabel: p.handLabel,
    options: puzzleOptionLabels(p, fmt),
  };
}

export function puzzleOutcome(p: Puzzle, key: string, fmt: Fmt, tx: (s: string) => string, extra: { delta?: number; ratingBefore?: number } = {}): Outcome {
  const opts = puzzleOptionLabels(p, fmt);
  const label = (k: string) => opts.find((o) => o.key === k)?.label ?? k;
  const ok = p.correct.includes(key);
  const facts: Outcome['facts'] = [];
  if (p.handLabel) facts.push({ label: 'Your hand', value: p.handLabel });
  if (p.equity !== undefined) facts.push({ label: p.toCallBB > 0 ? 'Equity vs their bets' : 'Equity vs their range', value: pct(p.equity) });
  if (p.potOdds !== undefined) facts.push({ label: 'Needed to call', value: pct(p.potOdds) });
  if (p.villainRange) facts.push({ label: `${p.villainPos ?? 'Villain'}'s range`, value: p.villainRange });
  if (p.board_texture) facts.push({ label: 'Board', value: p.board_texture });
  const bars: OutcomeBar[] =
    p.kind === 'math'
      ? []
      : p.options.map((o, i) => ({ key: o.key, label: label(o.key), freq: p.freq?.[i], ev: p.ev?.[i] }));
  const ratingBefore = extra.ratingBefore;
  return {
    ok,
    chosenKey: key,
    bestKey: p.best,
    correctKeys: p.correct,
    bestLabel: p.correct.length > 1 && p.options.find((o) => o.key === p.best)?.kind === 'bet' ? 'Bet (any size)' : label(p.best),
    bars,
    barSource: p.kind === 'postflop' ? 'solver' : p.kind === 'preflop' ? 'chart' : undefined,
    idea: tx(p.idea),
    facts,
    delta: extra.delta,
    ratingBefore,
    brilliant: ok && ratingBefore !== undefined && p.rating >= ratingBefore + 250,
  };
}

/* ------------------------------------------------------------ drills */
function groupOf(key: string): ViewOption['group'] {
  if (/^(fold|check|call)/.test(key)) return 'passive';
  if (/^(bet|raise|allin|jam|shove|3bet|4bet|open|iso)/.test(key)) return 'aggr';
  return 'choice';
}

export function questionView(q: Question, tx: (s: string) => string, real?: RealStake): SpotView {
  const options: ViewOption[] = q.options.map((o) => {
    const g = q.kind === 'math' ? 'choice' : groupOf(o.key);
    return { key: o.key, label: tx(o.label), group: g, tone: o.key.startsWith('fold') ? 'fold' : g === 'aggr' ? 'aggr' : 'neutral' };
  });
  return {
    id: q.id,
    kind: q.kind === 'math' ? 'math' : 'table',
    street: q.board.length === 0 ? 'preflop' : q.board.length === 3 ? 'flop' : q.board.length === 4 ? 'turn' : 'river',
    heroCards: q.heroCards,
    board: q.board,
    heroPos: q.position,
    villainPos: q.villainPos,
    villainAction: q.toCallBB > 0 && q.board.length ? `Bets ${tx(`${Math.round(q.toCallBB * 10) / 10}bb`)}` : undefined,
    centerPotBB: q.board.length ? q.potBB - q.toCallBB : q.potBB,
    toCallBB: q.toCallBB,
    stackBB: q.stackBB,
    history: q.history.map(tx),
    prompt: tx(q.prompt),
    handLabel: q.handLabel,
    options,
    real,
  };
}

export function questionOutcome(q: Question, key: string, correct: boolean, tx: (s: string) => string): Outcome {
  const label = (k: string) => tx(q.options.find((o) => o.key === k)?.label ?? k);
  const hasEv = q.options.some((o) => o.ev !== undefined);
  const hasFreq = q.options.some((o) => o.freq !== undefined);
  return {
    ok: correct,
    chosenKey: key,
    bestKey: q.bestKey,
    correctKeys: q.correct,
    bestLabel: label(q.bestKey),
    bars: q.kind === 'math' ? [] : q.options.map((o) => ({ key: o.key, label: label(o.key), freq: o.freq, ev: o.ev })),
    barSource: hasFreq && !hasEv ? 'chart' : hasEv ? 'engine' : undefined,
    lines: q.explanation.map(tx),
    facts: q.handLabel ? [{ label: 'Your hand', value: q.handLabel }] : [],
  };
}
