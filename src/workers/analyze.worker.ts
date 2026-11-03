/// <reference lib="webworker" />
import { analyzeHand } from '../lib/engine/analyze.ts';
import type { HandAnalysis } from '../lib/engine/types.ts';
import { parseHandHistories } from '../lib/parser/index.ts';
import type { Hand } from '../lib/types.ts';

export type WorkerIn =
  | { type: 'analyze'; files: { name: string; text: string }[]; known: string[] }
  | { type: 'reanalyze'; hands: Hand[] };

export type WorkerOut =
  | { type: 'parsed'; total: number; newHands: number; errors: { snippet: string; message: string }[]; skipped: number; duplicates: number }
  | { type: 'progress'; done: number; total: number }
  | { type: 'batch'; hands: Hand[]; analyses: HandAnalysis[] }
  | { type: 'done' }
  | { type: 'error'; message: string };

const post = (m: WorkerOut) => (self as unknown as Worker).postMessage(m);

function run(hands: Hand[]) {
  const total = hands.length;
  let batchH: Hand[] = [];
  let batchA: HandAnalysis[] = [];
  let last = performance.now();
  for (let i = 0; i < hands.length; i++) {
    try {
      batchA.push(analyzeHand(hands[i]));
      batchH.push(hands[i]);
    } catch (e) {
      console.warn('analysis failed', hands[i].id, e);
    }
    if (batchH.length >= 150 || performance.now() - last > 400 || i === hands.length - 1) {
      post({ type: 'batch', hands: batchH, analyses: batchA });
      post({ type: 'progress', done: i + 1, total });
      batchH = [];
      batchA = [];
      last = performance.now();
    }
  }
  post({ type: 'done' });
}

self.onmessage = (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'analyze') {
      const known = new Set(msg.known);
      const all: Hand[] = [];
      const errors: { snippet: string; message: string }[] = [];
      let skipped = 0;
      for (const f of msg.files) {
        const r = parseHandHistories(f.text);
        all.push(...r.hands);
        errors.push(...r.errors.map((e) => ({ ...e, snippet: `${f.name}: ${e.snippet}` })));
        skipped += r.skipped;
      }
      const seen = new Set<string>();
      const fresh = all.filter((h) => {
        if (known.has(h.id) || seen.has(h.id)) return false;
        seen.add(h.id);
        return true;
      });
      fresh.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      post({ type: 'parsed', total: all.length, newHands: fresh.length, errors: errors.slice(0, 50), skipped, duplicates: all.length - fresh.length });
      run(fresh);
    } else if (msg.type === 'reanalyze') {
      post({ type: 'parsed', total: msg.hands.length, newHands: msg.hands.length, errors: [], skipped: 0, duplicates: 0 });
      run(msg.hands);
    }
  } catch (e) {
    post({ type: 'error', message: (e as Error).message });
  }
};
