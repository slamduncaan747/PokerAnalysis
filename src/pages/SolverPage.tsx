import { Cpu, Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SolveProgress, SolverExplorer, SolverFooter, useSolver } from '../components/Solver.tsx';
import { COMBOS, parseCards, type Card } from '../lib/cards.ts';
import { chartRangeSpec, rfiChart, vs3betChart, vsOpenChart } from '../lib/engine/charts.ts';
import { rangeCombos, rangeFromSpec } from '../lib/engine/ranges.ts';
import { SCALE, toSolverCard, type SolverSpot } from '../lib/solver/spot.ts';

interface Preset {
  name: string;
  oop: string;
  ip: string;
  oopRange: string;
  ipRange: string;
  pot: number;
  stack: number;
}

const PRESETS: Preset[] = [
  { name: 'BTN open vs BB call (single-raised pot)', oop: 'BB', ip: 'BTN', oopRange: chartRangeSpec(vsOpenChart('BB', 'BTN', 0), 'call'), ipRange: chartRangeSpec(rfiChart('BTN', 6), 'raise'), pot: 5.5, stack: 97.5 },
  { name: 'CO open vs BB call', oop: 'BB', ip: 'CO', oopRange: chartRangeSpec(vsOpenChart('BB', 'CO', 0), 'call'), ipRange: chartRangeSpec(rfiChart('CO', 6), 'raise'), pot: 5.5, stack: 97.5 },
  { name: 'UTG open vs BB call', oop: 'BB', ip: 'UTG', oopRange: chartRangeSpec(vsOpenChart('BB', 'UTG', 0), 'call'), ipRange: chartRangeSpec(rfiChart('UTG', 6), 'raise'), pot: 5.5, stack: 97.5 },
  { name: 'SB open vs BB call', oop: 'SB', ip: 'BB', oopRange: chartRangeSpec(rfiChart('SB', 6), 'raise'), ipRange: chartRangeSpec(vsOpenChart('BB', 'SB', 0), 'call'), pot: 6, stack: 97 },
  { name: 'BB 3-bets BTN, BTN calls (3-bet pot)', oop: 'BB', ip: 'BTN', oopRange: chartRangeSpec(vsOpenChart('BB', 'BTN', 0), 'raise'), ipRange: chartRangeSpec(vs3betChart('BTN', 'BB'), 'call'), pot: 22.5, stack: 89 },
];

const STREET_DEFAULTS: Record<number, { flop: string; turn: string; river: string; raises: string; target: number; iters: number }> = {
  3: { flop: '33%, 75%', turn: '75%', river: '75%', raises: '3x', target: 1.5, iters: 150 },
  4: { flop: '50%', turn: '33%, 75%', river: '75%', raises: '3x', target: 0.7, iters: 300 },
  5: { flop: '50%', turn: '75%', river: '33%, 75%, 150%', raises: '3x', target: 0.3, iters: 500 },
};

function toLists(spec: string, dead: Set<Card>) {
  const r = rangeFromSpec(spec);
  const cards: number[] = [];
  const weights: number[] = [];
  for (let i = 0; i < 1326; i++) {
    if (r[i] <= 0) continue;
    const [a, b] = COMBOS[i];
    if (dead.has(a) || dead.has(b)) continue;
    cards.push(toSolverCard(a), toSolverCard(b));
    weights.push(r[i]);
  }
  return { cards, weights, combos: rangeCombos(r) };
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-mute">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-dim">{hint}</span>}
    </label>
  );
}
const inputCls = 'rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent';

export default function SolverPage() {
  const [preset, setPreset] = useState(0);
  const [oopName, setOopName] = useState(PRESETS[0].oop);
  const [ipName, setIpName] = useState(PRESETS[0].ip);
  const [oopRange, setOopRange] = useState(PRESETS[0].oopRange);
  const [ipRange, setIpRange] = useState(PRESETS[0].ipRange);
  const [board, setBoard] = useState('Ks 7d 2c 9h');
  const [pot, setPot] = useState(PRESETS[0].pot);
  const [stack, setStack] = useState(PRESETS[0].stack);
  const boardCards = useMemo(() => {
    try {
      return parseCards(board.replace(/([2-9TJQKA][shdc])/gi, '$1 '));
    } catch {
      return null;
    }
  }, [board]);
  const n = boardCards?.length ?? 0;
  const [sizes, setSizes] = useState(STREET_DEFAULTS[4]);
  const [lastN, setLastN] = useState(4);
  if (n >= 3 && n <= 5 && n !== lastN) {
    setLastN(n);
    setSizes(STREET_DEFAULTS[n]);
  }
  const { state, solve, query, cancel } = useSolver();
  const [spot, setSpot] = useState<SolverSpot | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const applyPreset = (i: number) => {
    const p = PRESETS[i];
    setPreset(i);
    setOopName(p.oop);
    setIpName(p.ip);
    setOopRange(p.oopRange);
    setIpRange(p.ipRange);
    setPot(p.pot);
    setStack(p.stack);
  };

  const run = () => {
    setFormError(null);
    try {
      if (!boardCards || boardCards.length < 3 || boardCards.length > 5) throw new Error('Board needs 3, 4 or 5 cards, e.g. "Ks 7d 2c".');
      if (new Set(boardCards).size !== boardCards.length) throw new Error('Board has duplicate cards.');
      const dead = new Set(boardCards);
      const o = toLists(oopRange, dead);
      const p = toLists(ipRange, dead);
      if (!o.weights.length || !p.weights.length) throw new Error('Both ranges need at least one hand.');
      if (!(pot > 0) || !(stack > 0)) throw new Error('Pot and stack must be positive.');
      const s: SolverSpot = {
        street: n === 3 ? 'flop' : n === 4 ? 'turn' : 'river',
        board: boardCards,
        oop: { pos: oopName || 'OOP', isHero: false, cards: o.cards, weights: o.weights },
        ip: { pos: ipName || 'IP', isHero: false, cards: p.cards, weights: p.weights },
        heroIsOop: true,
        potStart: Math.round(pot * SCALE),
        effStack: Math.round(stack * SCALE),
        before: [],
        bb: 1,
        sizes: { flop: sizes.flop, turn: sizes.turn, river: sizes.river, raises: sizes.raises },
        maxIterations: sizes.iters,
        targetPct: sizes.target,
      };
      setSpot(s);
      solve(s);
    } catch (e) {
      setFormError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Cpu className="text-great" /> GTO Solver
        </h1>
        <p className="text-sm text-mute">
          A full postflop game-theory solver (b-inary's open-source postflop-solver) running in your browser via WebAssembly. River spots solve in about a second, turn
          spots in under a minute; flops work with lean trees and narrow ranges.
        </p>
      </div>

      <div className="panel grid gap-4 p-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Field label="Preset">
            <select className={inputCls} value={preset} onChange={(e) => applyPreset(parseInt(e.target.value))}>
              {PRESETS.map((p, i) => (
                <option key={i} value={i}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-[90px_1fr] gap-2">
            <Field label="OOP name">
              <input className={inputCls} value={oopName} onChange={(e) => setOopName(e.target.value)} />
            </Field>
            <Field label={`OOP range (${rangeCombosSafe(oopRange)} combos)`}>
              <textarea className={`${inputCls} h-20 font-mono text-xs`} value={oopRange} onChange={(e) => setOopRange(e.target.value)} />
            </Field>
            <Field label="IP name">
              <input className={inputCls} value={ipName} onChange={(e) => setIpName(e.target.value)} />
            </Field>
            <Field label={`IP range (${rangeCombosSafe(ipRange)} combos)`}>
              <textarea className={`${inputCls} h-20 font-mono text-xs`} value={ipRange} onChange={(e) => setIpRange(e.target.value)} />
            </Field>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-dim">
            <Info size={12} className="mt-0.5 shrink-0" /> Range syntax: <code>TT+, A2s+, KTo+, K9s-K6s, 76s:0.5</code> (":0.5" = half weight).
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Board" hint={n ? `${n === 3 ? 'Flop' : n === 4 ? 'Turn' : n === 5 ? 'River' : '?'} spot` : 'e.g. Ks 7d 2c'}>
              <input className={`${inputCls} font-mono`} value={board} onChange={(e) => setBoard(e.target.value)} />
            </Field>
            <Field label="Pot (bb)">
              <input className={inputCls} type="number" step="0.5" value={pot} onChange={(e) => setPot(parseFloat(e.target.value))} />
            </Field>
            <Field label="Eff. stack (bb)">
              <input className={inputCls} type="number" step="1" value={stack} onChange={(e) => setStack(parseFloat(e.target.value))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['flop', 'turn', 'river', 'raises'] as const).map((k) => (
              <Field key={k} label={k === 'raises' ? 'Raise sizes' : `${k[0].toUpperCase()}${k.slice(1)} bets`}>
                <input className={`${inputCls} font-mono text-xs`} value={sizes[k]} onChange={(e) => setSizes({ ...sizes, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Target exploitability (% pot)">
              <input className={inputCls} type="number" step="0.1" value={sizes.target} onChange={(e) => setSizes({ ...sizes, target: parseFloat(e.target.value) })} />
            </Field>
            <Field label="Max iterations">
              <input className={inputCls} type="number" step="10" value={sizes.iters} onChange={(e) => setSizes({ ...sizes, iters: parseInt(e.target.value) })} />
            </Field>
          </div>
          <p className="text-[11px] text-dim">Sizes: "33%" of pot, "2.5x" previous bet, "a" all-in. All-in is added automatically when stacks get short.</p>
          <div className="mt-auto flex items-center gap-3">
            <button className="btn btn-primary" disabled={state.phase === 'solving'} onClick={run}>
              <Cpu size={16} /> Solve
            </button>
            {formError && <span className="text-sm text-loss">{formError}</span>}
          </div>
        </div>
      </div>

      {spot && state.phase === 'solving' && (
        <div className="panel p-4">
          <SolveProgress state={state} onCancel={cancel} maxIterations={spot.maxIterations} targetPct={spot.targetPct} />
        </div>
      )}
      {state.phase === 'error' && <div className="panel border-loss/40 p-4 text-sm text-loss">{state.error}</div>}
      {spot && state.phase === 'solved' && state.stats && (
        <div className="panel flex flex-col gap-4 p-4">
          <SolverExplorer query={query} rootLine={[]} names={[String(spot.oop.pos), String(spot.ip.pos)]} />
          <SolverFooter stats={state.stats} spot={spot} />
        </div>
      )}
    </div>
  );
}

function rangeCombosSafe(spec: string) {
  try {
    return Math.round(rangeCombos(rangeFromSpec(spec)));
  } catch {
    return '?';
  }
}
