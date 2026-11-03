import { Cpu } from 'lucide-react';
import { useMemo } from 'react';
import { buildSolverSpot } from '../lib/solver/spot.ts';
import type { Decision } from '../lib/engine/types.ts';
import { isError } from '../lib/engine/types.ts';
import type { Hand } from '../lib/types.ts';
import { CLASS_META } from './ui.tsx';
import { SolveProgress, SolverExplorer, SolverFooter, useSolver } from './Solver.tsx';

const ETA: Record<string, string> = { river: 'about a second', turn: 'roughly 10–60 seconds', flop: '1–3 minutes (coarser tree)' };

/** GTO solver for one hero decision in the hand replayer. */
export default function GtoPanel({ hand, actionIndex, decision }: { hand: Hand; actionIndex: number; decision?: Decision }) {
  const { spot, reason } = useMemo(() => buildSolverSpot(hand, actionIndex), [hand, actionIndex]);
  const { state, solve, query, cancel } = useSolver();
  const names: [string, string] = spot
    ? [spot.heroIsOop ? `You (${spot.oop.pos})` : String(spot.oop.pos), spot.heroIsOop ? String(spot.ip.pos) : `You (${spot.ip.pos})`]
    : ['OOP', 'IP'];
  return (
    <div className="panel flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Cpu size={18} className="text-great" /> GTO solver
          </div>
          <p className="text-xs text-mute">
            Solves this {spot?.street ?? ''} spot to equilibrium with both players' modeled ranges and compares the solver's play with yours.
          </p>
        </div>
        {spot && state.phase !== 'solving' && (
          <button className="btn btn-primary" onClick={() => solve(spot)}>
            <Cpu size={16} /> {state.phase === 'solved' ? 'Re-solve' : 'Solve this spot'}
          </button>
        )}
      </div>
      {!spot && <div className="rounded-lg bg-panel-2 p-3 text-sm text-mute">{reason}</div>}
      {spot && state.phase === 'idle' && (
        <div className="text-xs text-dim">
          {spot.oop.pos} vs {spot.ip.pos} · pot {spot.potStart / 100}bb · stacks {spot.effStack / 100}bb · {spot.oop.weights.length} vs {spot.ip.weights.length} combos · expected time: {ETA[spot.street]}.
          Runs entirely in your browser.
        </div>
      )}
      {spot && state.phase === 'solving' && <SolveProgress state={state} onCancel={cancel} maxIterations={spot.maxIterations} targetPct={spot.targetPct} />}
      {state.phase === 'error' && <div className="rounded-lg bg-loss/10 p-3 text-sm text-loss">{state.error}</div>}
      {spot && state.phase === 'solved' && state.stats && (
        <>
          <SolverExplorer query={query} rootLine={spot.before} heroCards={spot.heroCards} heroPlayer={spot.heroIsOop ? 0 : 1} heroAction={spot.heroAction}
            names={names}
            quickGrade={decision && !decision.trivial ? { label: CLASS_META[decision.classification].label, isError: isError(decision.classification) } : undefined}
          />
          <SolverFooter stats={state.stats} spot={spot} />
        </>
      )}
    </div>
  );
}
