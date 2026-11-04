import { handClass } from '../lib/cards.ts';
import type { Question } from '../lib/training/drills.ts';
import type { RealStake } from '../settings.ts';
import type { Puzzle } from '../puzzles/types.ts';

/** What the player screen needs to draw one decision, whatever it came from (puzzle or own-hand drill). */
export interface ViewOption {
  key: string;
  /** Short action word ("Raise"), with the amount in `sub`. */
  label: string;
  sub?: string;
  /** The whole thing in one line ("Raise to 18.1bb"), for explanations. */
  full?: string;
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
  /** One short sentence: the verdict in plain words. */
  headline?: string;
  /** The longer explanation, shown under "Why?". */
  idea?: string;
  lines?: string[];
  /** Revealed after answering, e.g. the puzzle's theme. */
  tag?: string;
  facts: { label: string; value: string }[];
  delta?: number;
  ratingBefore?: number;
  /** Solved a puzzle well above your rating. */
  brilliant?: boolean;
}

type Fmt = (bb: number) => string;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Two pair (pocket pair + board pair)" → "Two pair"; "Pocket Nines (middle pair)" → "Pocket nines". */
export function friendlyHand(label?: string): string | undefined {
  if (!label) return label;
  const l = label.replace(/\s*\([^)]*\)/g, '').replace(/Full House/g, 'Full house');
  return l.replace(/^Pocket (\w+)/, (_m, r: string) => `Pocket ${r.toLowerCase()}`);
}

/** The verdict in one short sentence; the full explanation stays under "Why?". */
function puzzleHeadline(p: Puzzle, fmt: Fmt): string {
  const eq = p.equity ?? 0;
  const need = p.potOdds ?? 0;
  const best = p.options.find((o) => o.key === p.best);
  switch (p.theme) {
    case 'bluffcatch':
      return `You need ${pct(need)} and have ${pct(eq)}. Call.`;
    case 'fold':
      return `You need ${pct(need)} but have only ${pct(eq)}. Fold.`;
    case 'value':
      return p.toCallBB > 0 ? 'You’re way ahead of their bets. Call.' : 'Worse hands still call. Bet for value.';
    case 'bluff':
      return 'Their range is weak. Bet, and better hands fold.';
    case 'check':
      return eq >= 0.45 ? 'Only better hands call a bet. Check.' : 'No bluff works here. Take the free showdown.';
    case 'raise':
      return eq >= 0.75 ? 'You beat most of their bets. Raise for value.' : 'Their bet is weak. Raise them off it.';
    case 'preflop': {
      const cls = handClass(p.heroCards[0], p.heroCards[1]);
      if (best?.kind === 'fold') return `${cls} is too weak to play here.`;
      if (best?.kind === 'call') return `${cls} plays best as a call here.`;
      return `${cls} is a clear raise here.`;
    }
    case 'potodds':
      return `Call ${fmt(p.toCallBB)} to win ${fmt(p.potBB)}: you need ${p.best}%.`;
  }
}

export function puzzleOptionLabels(p: Puzzle, fmt: Fmt): ViewOption[] {
  return p.options.map((o): ViewOption => {
    switch (o.kind) {
      case 'fold':
        return { key: o.key, label: 'Fold', full: 'Fold', group: 'passive', tone: 'fold' };
      case 'check':
        return { key: o.key, label: 'Check', full: 'Check', group: 'passive', tone: 'neutral' };
      case 'call':
        return { key: o.key, label: 'Call', sub: fmt(p.toCallBB), full: `Call ${fmt(p.toCallBB)}`, group: 'passive', tone: 'neutral' };
      case 'bet': {
        const pctPot = Math.round((o.toBB! / Math.max(0.01, p.potBB)) * 100);
        return { key: o.key, label: 'Bet', sub: `${fmt(o.toBB!)} · ${pctPot}%`, full: `Bet ${fmt(o.toBB!)}`, group: 'aggr', tone: 'aggr' };
      }
      case 'raise':
        return { key: o.key, label: 'Raise', sub: `to ${fmt(o.toBB!)}`, full: `Raise to ${fmt(o.toBB!)}`, group: 'aggr', tone: 'aggr' };
      case 'allin':
        return { key: o.key, label: 'All-in', sub: fmt(o.toBB ?? p.stackBB), full: 'All-in', group: 'aggr', tone: 'aggr' };
      default:
        return { key: o.key, label: o.label ?? o.key, full: o.label ?? o.key, group: 'choice', tone: 'neutral' };
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
    handLabel: friendlyHand(p.handLabel),
    options: puzzleOptionLabels(p, fmt),
  };
}

export function puzzleOutcome(p: Puzzle, key: string, fmt: Fmt, tx: (s: string) => string, extra: { delta?: number; ratingBefore?: number } = {}): Outcome {
  const opts = puzzleOptionLabels(p, fmt);
  const label = (k: string) => {
    const o = opts.find((x) => x.key === k);
    return o?.full ?? o?.label ?? k;
  };
  const ok = p.correct.includes(key);
  const facts: Outcome['facts'] = [];
  if (p.equity !== undefined) facts.push({ label: p.toCallBB > 0 ? 'Your equity vs their bets' : 'Your equity vs their range', value: pct(p.equity) });
  if (p.potOdds !== undefined) facts.push({ label: 'Equity needed to call', value: pct(p.potOdds) });
  if (p.villainRange) facts.push({ label: `${p.villainPos ?? 'Their'} range`, value: p.villainRange });
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
    headline: tx(puzzleHeadline(p, fmt)),
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
    const full = tx(o.label);
    // "Raise to 7.5bb" → "Raise" + "to 7.5bb", so every button reads the same way.
    const m = g === 'choice' ? null : /^(Fold|Check|Call|Bet|Raise|All-in|Jam|Shove|Open|Limp|3-bet|4-bet)\b\s*(.*)$/i.exec(full);
    return { key: o.key, label: m ? m[1] : full, sub: m && m[2] ? m[2] : undefined, full, group: g, tone: o.key.startsWith('fold') ? 'fold' : g === 'aggr' ? 'aggr' : 'neutral' };
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
    handLabel: friendlyHand(q.handLabel),
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
    headline: q.explanation[0] ? tx(q.explanation[0]) : undefined,
    lines: q.explanation.slice(1).map(tx),
    facts: [],
  };
}
