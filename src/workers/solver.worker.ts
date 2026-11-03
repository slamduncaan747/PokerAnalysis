/// <reference lib="webworker" />
// Runs b-inary's postflop-solver (compiled to WebAssembly, AGPL-3.0-or-later) off the main thread.
// One worker = one solved game; the page can then query any node of the tree.
import init, { SpotSolver } from '../solver/pkg/leakfinder_solver.js';
import { readNode, solveSpot, type NodeInfo, type SolveStats, type SpotSolverCtor, type WasmSpotSolver } from '../lib/solver/run.ts';
import type { SolverAction } from '../lib/solver/common.ts';
import type { SolverSpot } from '../lib/solver/spot.ts';
import type { Card } from '../lib/cards.ts';

export type SolverIn =
  | { type: 'solve'; spot: SolverSpot }
  | { type: 'node'; id: number; line: SolverAction[]; heroCards?: [Card, Card]; heroPlayer?: number; detailClass?: string };

export type SolverOut =
  | { type: 'progress'; iteration: number; exploitabilityPct: number }
  | { type: 'solved'; stats: SolveStats }
  | { type: 'node'; id: number; node: NodeInfo }
  | { type: 'error'; message: string; id?: number };

const post = (m: SolverOut) => (self as unknown as Worker).postMessage(m);
let ready: Promise<unknown> | null = null;
let solver: WasmSpotSolver | null = null;

function message(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (/unreachable|RuntimeError/i.test(m)) return 'The solver hit an internal error on this spot (unsupported line or sizes).';
  if (/memory/i.test(m) && !/needs/.test(m)) return 'Out of memory — this spot is too large to solve in the browser.';
  return m;
}

self.onmessage = async (ev: MessageEvent<SolverIn>) => {
  const msg = ev.data;
  try {
    ready ??= init();
    await ready;
    if (msg.type === 'solve') {
      solver?.free();
      solver = null;
      let last = 0;
      const { solver: s, stats } = solveSpot(SpotSolver as unknown as SpotSolverCtor, msg.spot, (iteration, exploitabilityPct) => {
        const now = Date.now();
        if (now - last > 150) {
          last = now;
          post({ type: 'progress', iteration, exploitabilityPct });
        }
      });
      solver = s;
      post({ type: 'solved', stats });
    } else if (msg.type === 'node') {
      if (!solver) throw new Error('Nothing solved yet.');
      post({ type: 'node', id: msg.id, node: readNode(solver, msg.line, msg) });
    }
  } catch (e) {
    post({ type: 'error', message: message(e), id: msg.type === 'node' ? msg.id : undefined });
  }
};
