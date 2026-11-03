import { useMemo } from 'react';
import { LEAKS, type DrillType } from '../engine/leaks.ts';
import { isError, type HandAnalysis, type LeakId } from '../engine/types.ts';
import { dueCards, type Progress } from './progress.ts';

export interface OwnMistake {
  qid: string;
  handId: string;
  actionIndex: number;
  drill: DrillType;
  leak?: LeakId;
  loss: number;
}

/** Every graded error in the imported hands that maps to a leak, costliest first. */
export function ownMistakes(ordered: readonly HandAnalysis[]): OwnMistake[] {
  const out: OwnMistake[] = [];
  for (const a of ordered)
    for (const d of a.decisions)
      if (!d.trivial && isError(d.classification) && d.leak)
        out.push({ qid: `own-${a.handId}-${d.actionIndex}`, handId: a.handId, actionIndex: d.actionIndex, drill: LEAKS[d.leak].drill, leak: d.leak, loss: d.evLoss });
  return out.sort((x, y) => y.loss - x.loss);
}

export function useOwnMistakesOf(ordered: readonly HandAnalysis[]): OwnMistake[] {
  return useMemo(() => ownMistakes(ordered), [ordered]);
}

export type QueueItem = { own: { handId: string; actionIndex: number; drill: DrillType } } | { gen: DrillType };

export interface QueueSpec {
  drill?: DrillType | null;
  leak?: LeakId | null;
  /** Only your own mistakes (spaced-repetition review). */
  own?: boolean;
  /** Start with this exact decision. */
  hand?: string | null;
  idx?: number | null;
  n: number;
}

/**
 * Builds a training session: your own mistakes first (due cards, then the least-learned and the
 * costliest), topped up with generated drills for the same leak.
 */
export function buildQueue(spec: QueueSpec, mistakes: readonly OwnMistake[], progress: Progress, analyses: Map<string, HandAnalysis>, rand: () => number = Math.random): QueueItem[] {
  const { drill, leak, own, hand, idx, n } = spec;
  const q: QueueItem[] = [];
  if (hand && idx !== null && idx !== undefined) {
    const d = analyses.get(hand)?.decisions.find((x) => x.actionIndex === idx);
    if (d?.leak) q.push({ own: { handId: hand, actionIndex: d.actionIndex, drill: LEAKS[d.leak].drill } });
  }
  const pool = leak ? mistakes.filter((m) => m.leak === leak) : mistakes;
  if (own || leak || hand) {
    const due = new Set(dueCards(progress).map((c) => `own-${c.handId}-${c.actionIndex}`));
    const ordered = [...pool].sort((x, y) => {
      const dx = due.has(x.qid) ? 0 : 1;
      const dy = due.has(y.qid) ? 0 : 1;
      const bx = progress.cards[x.qid]?.box ?? 0;
      const by = progress.cards[y.qid]?.box ?? 0;
      return dx - dy || bx - by || y.loss - x.loss;
    });
    const ownCap = own ? n : leak ? Math.ceil(n * 0.4) : n;
    for (const m of ordered) {
      if (q.length >= ownCap) break;
      if (q.some((x) => 'own' in x && x.own.handId === m.handId && x.own.actionIndex === m.actionIndex)) continue;
      if ((progress.cards[m.qid]?.box ?? 0) >= 5) continue;
      q.push({ own: { handId: m.handId, actionIndex: m.actionIndex, drill: m.drill } });
    }
  }
  const genDrill: DrillType | null = drill ?? (leak ? LEAKS[leak].drill : null);
  if (genDrill) while (q.length < n) q.push({ gen: genDrill });
  // Shuffle own + generated a little for variety (keep the first if it was explicitly requested).
  const head = hand ? q.slice(0, 1) : [];
  const tail = q.slice(head.length);
  for (let i = tail.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [tail[i], tail[j]] = [tail[j], tail[i]];
  }
  return [...head, ...tail].slice(0, n);
}
