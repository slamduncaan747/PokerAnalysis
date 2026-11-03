import { Cpu, Loader2, RotateCcw, Square, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GRID_CLASSES, type Card } from '../lib/cards.ts';
import type { NodeInfo, SolveStats, SolverActionInfo } from '../lib/solver/run.ts';
import { closestAction } from '../lib/solver/run.ts';
import type { SolverAction, SolverSpot } from '../lib/solver/spot.ts';
import type { SolverIn, SolverOut } from '../workers/solver.worker.ts';
import { CardText, ProgressBar } from './ui.tsx';

export interface SolverState {
  phase: 'idle' | 'solving' | 'solved' | 'error';
  iteration: number;
  exploitabilityPct: number | null;
  stats?: SolveStats;
  error?: string;
  startedAt?: number;
}

export function useSolver() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, { resolve: (n: NodeInfo) => void; reject: (e: Error) => void }>());
  const nextId = useRef(1);
  const [state, setState] = useState<SolverState>({ phase: 'idle', iteration: 0, exploitabilityPct: null });

  const terminate = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    for (const p of pending.current.values()) p.reject(new Error('cancelled'));
    pending.current.clear();
  }, []);
  useEffect(() => terminate, [terminate]);

  const solve = useCallback(
    (spot: SolverSpot) => {
      terminate();
      const w = new Worker(new URL('../workers/solver.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = w;
      setState({ phase: 'solving', iteration: 0, exploitabilityPct: null, startedAt: Date.now() });
      w.onmessage = (ev: MessageEvent<SolverOut>) => {
        const m = ev.data;
        if (m.type === 'progress') setState((s) => ({ ...s, iteration: m.iteration, exploitabilityPct: m.exploitabilityPct }));
        else if (m.type === 'solved') setState((s) => ({ ...s, phase: 'solved', stats: m.stats, iteration: m.stats.iterations, exploitabilityPct: m.stats.exploitabilityPct }));
        else if (m.type === 'node') {
          pending.current.get(m.id)?.resolve(m.node);
          pending.current.delete(m.id);
        } else if (m.type === 'error') {
          if (m.id !== undefined) {
            pending.current.get(m.id)?.reject(new Error(m.message));
            pending.current.delete(m.id);
          } else {
            setState((s) => ({ ...s, phase: 'error', error: m.message }));
            terminate();
          }
        }
      };
      w.onerror = (e) => {
        setState((s) => ({ ...s, phase: 'error', error: e.message || 'Solver failed to load.' }));
        terminate();
      };
      w.postMessage({ type: 'solve', spot } satisfies SolverIn);
    },
    [terminate],
  );

  const query = useCallback((line: SolverAction[], opts: { heroCards?: [Card, Card]; heroPlayer?: number; detailClass?: string } = {}) => {
    const w = workerRef.current;
    if (!w) return Promise.reject(new Error('Solver not running'));
    const id = nextId.current++;
    return new Promise<NodeInfo>((resolve, reject) => {
      pending.current.set(id, { resolve, reject });
      w.postMessage({ type: 'node', id, line, ...opts } satisfies SolverIn);
    });
  }, []);

  const cancel = useCallback(() => {
    terminate();
    setState({ phase: 'idle', iteration: 0, exploitabilityPct: null });
  }, [terminate]);

  return { state, solve, query, cancel };
}

/** Solver-style palette: fold blue, check/call green, bets warm → red by size. */
export function actionColors(actions: SolverActionInfo[]): string[] {
  const aggressive = actions.filter((a) => a.kind >= 3);
  const warm = ['#f3b13a', '#ef8a30', '#e65a35', '#d33a3a', '#a8233f', '#7d1d3f'];
  return actions.map((a) => {
    if (a.kind === 0) return '#5c8fdb';
    if (a.kind === 1 || a.kind === 2) return '#3ecf8e';
    const i = aggressive.indexOf(a);
    const start = Math.max(0, warm.length - aggressive.length - 1);
    return a.kind === 5 ? '#8f1f45' : warm[Math.min(warm.length - 1, start + i)];
  });
}

function StackedBar({ mix, colors, height = 10 }: { mix: number[]; colors: string[]; height?: number }) {
  return (
    <div className="flex w-full overflow-hidden rounded" style={{ height }}>
      {mix.map((p, j) => (p > 0.001 ? <div key={j} style={{ width: `${p * 100}%`, background: colors[j] }} /> : null))}
    </div>
  );
}

export function StrategyGrid({ node, colors, onPick, picked }: { node: NodeInfo; colors: string[]; onPick?: (cls: string) => void; picked?: string }) {
  const maxW = Math.max(1e-9, ...Object.values(node.grid).map((g) => g.weight));
  return (
    <div className="grid aspect-square w-full max-w-[460px] grid-cols-13 gap-[2px]" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
      {GRID_CLASSES.flat().map((cls) => {
        const g = node.grid[cls];
        const opacity = g ? 0.35 + 0.65 * Math.min(1, g.weight / maxW) : 1;
        return (
          <button
            key={cls}
            onClick={() => g && onPick?.(cls)}
            title={g ? `${cls}: ${node.actions.map((a, j) => `${a.label} ${Math.round(g.mix[j] * 100)}%`).join(' · ')}` : `${cls}: not in range`}
            className={`relative overflow-hidden rounded-[3px] ${picked === cls ? 'ring-2 ring-white' : ''} ${g ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ background: '#1b2029' }}
          >
            {g && (
              <div className="absolute inset-0 flex" style={{ opacity }}>
                {g.mix.map((p, j) => (p > 0.001 ? <div key={j} style={{ width: `${p * 100}%`, background: colors[j] }} /> : null))}
              </div>
            )}
            <span className={`relative z-10 text-[8px] font-semibold leading-none sm:text-[10px] ${g ? 'text-white drop-shadow' : 'text-dim/60'}`}>{cls}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Interactive explorer over a solved game. */
export function SolverExplorer({
  query,
  rootLine,
  heroCards,
  heroPlayer,
  heroAction,
  names,
  quickGrade,
}: {
  query: ReturnType<typeof useSolver>['query'];
  rootLine: SolverAction[];
  heroCards?: [Card, Card];
  heroPlayer?: number;
  heroAction?: SolverAction;
  names: [string, string];
  /** The fast engine's grade for this decision, to flag disagreements. */
  quickGrade?: { label: string; isError: boolean };
}) {
  const [line, setLine] = useState<SolverAction[]>(rootLine);
  const [node, setNode] = useState<NodeInfo | null>(null);
  const [picked, setPicked] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const atHeroNode = line.length === rootLine.length;
  useEffect(() => {
    let alive = true;
    setError(null);
    query(line, { heroCards, heroPlayer, detailClass: picked })
      .then((n) => alive && setNode(n))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [line, picked, query, heroCards, heroPlayer]);

  if (error) return <div className="text-sm text-loss">{error}</div>;
  if (!node) return <div className="flex items-center gap-2 text-sm text-mute"><Loader2 size={14} className="animate-spin" /> Reading strategy…</div>;
  const colors = actionColors(node.actions);
  const heroIdx = atHeroNode && heroAction ? closestAction(node.actions, heroAction) : -1;
  const bestIdx = node.hand ? node.hand.evs.indexOf(Math.max(...node.hand.evs)) : -1;
  const actor = node.player === 0 ? names[0] : node.player === 1 ? names[1] : '';
  const isHeroActing = heroPlayer !== undefined && node.player === heroPlayer;
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <button className="rounded bg-panel-3 px-2 py-1 text-mute hover:text-ink" onClick={() => { setLine(rootLine); setPicked(undefined); }}>
          {heroAction ? 'Your decision' : 'Root'}
        </button>
        {line.slice(rootLine.length).map((_, i) => (
          <span key={i} className="rounded bg-panel-2 px-2 py-1 text-mute">→ {node.line[rootLine.length + i]?.label ?? '…'}</span>
        ))}
        {line.length > rootLine.length && (
          <button className="ml-1 flex items-center gap-1 rounded px-1.5 py-1 text-accent hover:underline" onClick={() => { setLine(line.slice(0, -1)); setPicked(undefined); }}>
            <Undo2 size={12} /> back
          </button>
        )}
      </div>

      {node.player < 0 ? (
        <div className="rounded-lg bg-panel-2 p-3 text-sm text-mute">
          {node.player === -1 ? 'Hand over at this node.' : 'Street complete — the next card would be dealt here. (Explore later streets by solving from that street.)'}
        </div>
      ) : (
        <>
          {node.hand && isHeroActing && (
            <div className="rounded-xl border border-line bg-panel-2 p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold">
                  Solver strategy for your <CardText cards={node.hand.cards} />
                </span>
                <span className="text-xs text-mute">equity {pct(node.hand.equity)}</span>
              </div>
              <StackedBar mix={node.hand.strategy} colors={colors} height={14} />
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {node.actions.map((a, j) => (
                    <tr key={j} className={`${j === heroIdx ? 'bg-panel-3/70' : ''}`}>
                      <td className="py-1 pl-1">
                        <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colors[j] }} />
                        {a.label}
                        {j === heroIdx && <span className="ml-2 rounded bg-ink/10 px-1 text-[10px] font-semibold text-mute">YOU</span>}
                        {j === bestIdx && <span className="ml-1 rounded bg-best/20 px-1 text-[10px] font-semibold text-best">MAX EV</span>}
                      </td>
                      <td className="py-1 text-right tabular-nums">{pct(node.hand!.strategy[j])}</td>
                      <td className="py-1 pr-1 text-right tabular-nums text-mute">{node.hand!.evs[j] >= 0 ? '+' : ''}{node.hand!.evs[j].toFixed(2)}bb</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {heroIdx >= 0 && (
                <SolverVerdict freq={node.hand.strategy[heroIdx]} evLoss={Math.max(...node.hand.evs) - node.hand.evs[heroIdx]} potBB={node.potBB} label={node.actions[heroIdx].label} quickGrade={quickGrade} />
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[minmax(0,460px)_1fr]">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-mute">{actor} · range strategy</div>
              <StrategyGrid node={node} colors={colors} picked={picked} onPick={(c) => setPicked(c === picked ? undefined : c)} />
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-mute">Whole range · pot {Math.round(node.potBB * 10) / 10}bb</div>
                <StackedBar mix={node.range} colors={colors} height={12} />
                <div className="mt-2 flex flex-col gap-1">
                  {node.actions.map((a, j) => (
                    <button
                      key={j}
                      onClick={() => {
                        setLine([...line, { kind: a.kind, to: a.to }]);
                        setPicked(undefined);
                      }}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-panel-2"
                      title="Explore what happens after this action"
                    >
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colors[j] }} />
                        {a.label}
                      </span>
                      <span className="tabular-nums text-mute">{pct(node.range[j])} →</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-dim">Click an action to see how the solver continues.</p>
              </div>
              {picked && node.combos && (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-mute">{picked} combos</div>
                  <div className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1 scroll-thin">
                    {node.combos.map((c, k) => (
                      <div key={k} className="flex items-center gap-2 text-xs">
                        <CardText cards={c.cards} />
                        <div className="flex-1">
                          <StackedBar mix={c.strategy} colors={colors} height={8} />
                        </div>
                        <span className="w-12 text-right tabular-nums text-mute">eq {pct(c.equity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SolverVerdict({ freq, evLoss, potBB, label, quickGrade }: { freq: number; evLoss: number; potBB: number; label: string; quickGrade?: { label: string; isError: boolean } }) {
  const ok = freq >= 0.2 || evLoss <= 0.01 * potBB;
  const close = !ok && (freq >= 0.05 || evLoss <= 0.04 * potBB);
  const conflict = quickGrade && ((ok && quickGrade.isError) || (!ok && !close && !quickGrade.isError));
  return (
    <div className={`mt-2 rounded-lg px-3 py-2 text-sm ${ok ? 'bg-accent/10 text-accent' : close ? 'bg-inaccuracy/10 text-inaccuracy' : 'bg-loss/10 text-loss'}`}>
      {ok
        ? `GTO-approved: the solver plays ${label.toLowerCase()} ${Math.round(freq * 100)}% of the time here.`
        : close
          ? `Close: the solver rarely chooses ${label.toLowerCase()} (${Math.round(freq * 100)}%), costing ~${evLoss.toFixed(2)}bb.`
          : `Solver disagrees: ${label.toLowerCase()} is played ${Math.round(freq * 100)}% and costs ~${evLoss.toFixed(2)}bb vs the best line.`}
      {conflict && (
        <div className="mt-1 text-xs text-mute">
          The quick review graded this “{quickGrade!.label}”. The solver models both ranges and every later street, so trust it over the quick review here.
        </div>
      )}
    </div>
  );
}

export function SolveProgress({ state, onCancel, maxIterations, targetPct }: { state: SolverState; onCancel: () => void; maxIterations: number; targetPct: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 500);
    return () => clearInterval(t);
  }, []);
  const secs = state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : 0;
  const ex = state.exploitabilityPct;
  const conv = ex === null ? 0 : Math.min(100, Math.max((state.iteration / maxIterations) * 100, (targetPct / Math.max(ex, targetPct)) * 100));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-accent" /> Solving… {state.iteration} iterations · {secs}s
        </span>
        <button className="btn btn-ghost !px-2.5 !py-1 text-xs" onClick={onCancel}>
          <Square size={12} /> Stop
        </button>
      </div>
      <ProgressBar value={conv} />
      <div className="text-xs text-mute">Exploitability: {ex === null ? 'building tree…' : `${ex.toFixed(2)}% of pot (target ${targetPct}%)`}</div>
    </div>
  );
}

export function SolverFooter({ stats, spot }: { stats: SolveStats; spot: SolverSpot }) {
  return (
    <p className="text-[11px] leading-relaxed text-dim">
      Solved with <a className="underline hover:text-mute" href="https://github.com/b-inary/postflop-solver" target="_blank" rel="noreferrer">postflop-solver</a> (Discounted CFR, WebAssembly) ·{' '}
      {stats.iterations} iterations · exploitability {stats.exploitabilityPct.toFixed(2)}% of pot · {(stats.ms / 1000).toFixed(1)}s · {stats.memoryMB < 1 ? '<1' : Math.round(stats.memoryMB)} MB
      {stats.compressed ? ' (compressed)' : ''}. Bet sizes: flop {spot.sizes.flop} · turn {spot.sizes.turn} · river {spot.sizes.river} · raises {spot.sizes.raises} (+ the sizes actually used). Ranges: {spot.oop.weights.length} vs {spot.ip.weights.length} combos.
    </p>
  );
}

export function useSpotKey(spot: SolverSpot | undefined) {
  return useMemo(() => (spot ? JSON.stringify([spot.board, spot.potStart, spot.effStack, spot.before, spot.heroAction]) : ''), [spot]);
}

export const SolverIcon = Cpu;
export const ResetIcon = RotateCcw;
