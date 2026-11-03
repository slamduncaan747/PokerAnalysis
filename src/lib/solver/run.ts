import { handClass, type Card } from '../cards.ts';
import { fromSolverCard, SCALE, toSolverCard, type SolverAction } from './common.ts';
import type { SolverSpot } from './spot.ts';

/** Minimal shape of the wasm-bindgen SpotSolver class (see solver/src/lib.rs). */
export interface WasmSpotSolver {
  memory_mb(): Float64Array | number[];
  allocate(compress: boolean): void;
  step(n: number): number;
  iterations(): number;
  finalize(): void;
  navigate(line: Int32Array): Int32Array | number[];
  current_player(): number;
  actions(): Int32Array | number[];
  hands(player: number): Uint8Array | number[];
  weights(player: number): Float32Array | number[];
  strategy(): Float32Array | number[];
  ev_detail(player: number): Float32Array | number[];
  equity(player: number): Float32Array | number[];
  pot_info(): Int32Array | number[];
  free(): void;
}
export type SpotSolverCtor = new (
  oopCards: Uint8Array, oopWeights: Float32Array, ipCards: Uint8Array, ipWeights: Float32Array, board: Uint8Array,
  startingPot: number, effectiveStack: number,
  flopBets: string, flopRaises: string, turnBets: string, turnRaises: string, riverBets: string, riverRaises: string, line: Int32Array,
) => WasmSpotSolver;

export interface SolverActionInfo {
  kind: number;
  to: number;
  label: string;
}

export interface SolveStats {
  iterations: number;
  exploitabilityPct: number;
  memoryMB: number;
  compressed: boolean;
  ms: number;
}

export interface NodeInfo {
  /** 0 OOP, 1 IP, -1 terminal, -2 chance */
  player: number;
  line: SolverActionInfo[];
  potBB: number;
  actions: SolverActionInfo[];
  /** Range-wide action frequencies of the acting player. */
  range: number[];
  /** Per hand class: action mix and reach weight (acting player). */
  grid: Record<string, { mix: number[]; weight: number; ev: number; equity: number }>;
  /** Strategy for a specific hand, when requested and in range. */
  hand?: { cards: [Card, Card]; strategy: number[]; evs: number[]; equity: number; ev: number };
  /** Per-combo detail for one hand class (acting player). */
  combos?: { cards: [Card, Card]; weight: number; strategy: number[]; evs: number[]; equity: number }[];
}

const flat = (xs: SolverAction[]) => Int32Array.from(xs.flatMap((a) => [a.kind, a.to]));
const bbStr = (x: number) => `${Math.round((x / SCALE) * 10) / 10}bb`;

export function actionLabel(kind: number, to: number, potNow: number, commit: number): string {
  switch (kind) {
    case 0:
      return 'Fold';
    case 1:
      return 'Check';
    case 2:
      return 'Call';
    case 3:
      return potNow > 0 ? `Bet ${bbStr(to)} (${Math.round(((to - commit) / potNow) * 100)}%)` : `Bet ${bbStr(to)}`;
    case 4:
      return `Raise to ${bbStr(to)}`;
    case 5:
      return `All-in ${bbStr(to)}`;
    default:
      return '?';
  }
}

/** Builds the tree, allocates memory and runs CFR until the target exploitability. */
export function solveSpot(Ctor: SpotSolverCtor, spot: SolverSpot, onProgress?: (iteration: number, exploitabilityPct: number) => void): { solver: WasmSpotSolver; stats: SolveStats } {
  const t0 = Date.now();
  const order = ['flop', 'turn', 'river'];
  // Later streets repeat for every runout, so they can use a leaner raise tree.
  const raisesFor = (st: string) => (order.indexOf(st) > order.indexOf(spot.street) ? spot.sizes.laterRaises ?? spot.sizes.raises : spot.sizes.raises);
  const s = new Ctor(
    Uint8Array.from(spot.oop.cards), Float32Array.from(spot.oop.weights),
    Uint8Array.from(spot.ip.cards), Float32Array.from(spot.ip.weights),
    Uint8Array.from(spot.board.map(toSolverCard)),
    spot.potStart, spot.effStack,
    spot.sizes.flop, raisesFor('flop'), spot.sizes.turn, raisesFor('turn'), spot.sizes.river, raisesFor('river'),
    flat(spot.heroAction ? [...spot.before, spot.heroAction] : spot.before),
  );
  try {
    const [mem, memC] = Array.from(s.memory_mb());
    const compressed = mem > 700;
    const need = compressed ? memC : mem;
    if (need > 1800) throw new Error(`This spot needs ~${Math.round(need)} MB of memory — too large for a browser tab. Try narrower ranges, fewer bet sizes, or a turn/river spot.`);
    s.allocate(compressed);
    const target = (spot.potStart * spot.targetPct) / 100;
    let expl = Infinity;
    // Exploitability costs about one iteration to compute, so check it less often on big trees.
    const chunk = spot.street === 'flop' ? 5 : spot.street === 'turn' ? 5 : 10;
    while (s.iterations() < spot.maxIterations) {
      expl = s.step(chunk);
      onProgress?.(s.iterations(), (expl / spot.potStart) * 100);
      if (expl <= target) break;
    }
    s.finalize();
    return { solver: s, stats: { iterations: s.iterations(), exploitabilityPct: (expl / spot.potStart) * 100, memoryMB: need, compressed, ms: Date.now() - t0 } };
  } catch (e) {
    s.free();
    throw e;
  }
}

/** Reads strategy/EV information at the node reached by `line` from the root. */
export function readNode(s: WasmSpotSolver, line: SolverAction[], opts: { heroCards?: [Card, Card]; heroPlayer?: number; detailClass?: string } = {}): NodeInfo {
  const taken = Array.from(s.navigate(flat(line)));
  const mapped: SolverActionInfo[] = [];
  for (let i = 0; i < taken.length; i += 2) mapped.push({ kind: taken[i], to: taken[i + 1], label: actionLabel(taken[i], taken[i + 1], 0, 0) });
  const [potStart, oopC, ipC] = Array.from(s.pot_info());
  const potNow = potStart + oopC + ipC;
  const player = s.current_player();
  if (player < 0) return { player, line: mapped, potBB: potNow / SCALE, actions: [], range: [], grid: {} };
  const commit = player === 0 ? oopC : ipC;
  const raw = Array.from(s.actions());
  const actions: SolverActionInfo[] = [];
  for (let i = 0; i < raw.length; i += 2) actions.push({ kind: raw[i], to: raw[i + 1], label: actionLabel(raw[i], raw[i + 1], potNow, commit) });
  const nA = actions.length;
  const hands = Array.from(s.hands(player));
  const nH = hands.length / 2;
  const weights = Array.from(s.weights(player));
  const strat = Array.from(s.strategy());
  const evd = Array.from(s.ev_detail(player));
  const eq = Array.from(s.equity(player));
  const range = new Array(nA).fill(0);
  let wt = 0;
  const grid: NodeInfo['grid'] = {};
  const combos: NonNullable<NodeInfo['combos']> = [];
  let hand: NodeInfo['hand'];
  const h0 = opts.heroCards ? toSolverCard(opts.heroCards[0]) : -1;
  const h1 = opts.heroCards ? toSolverCard(opts.heroCards[1]) : -1;
  for (let i = 0; i < nH; i++) {
    const ca = hands[2 * i];
    const cb = hands[2 * i + 1];
    const w = weights[i];
    const strategy = Array.from({ length: nA }, (_, j) => strat[j * nH + i]);
    const evs = Array.from({ length: nA }, (_, j) => evd[j * nH + i] / SCALE);
    const ev = strategy.reduce((acc, p, j) => acc + p * evs[j], 0);
    const cards: [Card, Card] = [fromSolverCard(ca), fromSolverCard(cb)];
    if ((ca === h0 && cb === h1) || (ca === h1 && cb === h0)) {
      if (opts.heroPlayer === undefined || opts.heroPlayer === player) hand = { cards, strategy, evs, equity: eq[i], ev };
    }
    if (!(w > 0)) continue;
    wt += w;
    const cls = handClass(cards[0], cards[1]);
    const g = (grid[cls] ??= { mix: new Array(nA).fill(0), weight: 0, ev: 0, equity: 0 });
    g.weight += w;
    g.ev += w * ev;
    g.equity += w * eq[i];
    for (let j = 0; j < nA; j++) {
      range[j] += strategy[j] * w;
      g.mix[j] += strategy[j] * w;
    }
    if (opts.detailClass === cls) combos.push({ cards, weight: w, strategy, evs, equity: eq[i] });
  }
  for (const g of Object.values(grid)) {
    g.mix = g.mix.map((x) => x / g.weight);
    g.ev /= g.weight;
    g.equity /= g.weight;
  }
  return {
    player,
    line: mapped,
    potBB: potNow / SCALE,
    actions,
    range: range.map((x) => x / Math.max(wt, 1e-9)),
    grid,
    hand,
    combos: opts.detailClass ? combos : undefined,
  };
}

/** Index of the solver action closest to a real action (same kind, nearest size). */
export function closestAction(actions: SolverActionInfo[], a: SolverAction): number {
  let idx = -1;
  let bestD = Infinity;
  actions.forEach((x, j) => {
    const sameKind = x.kind === a.kind || (a.kind >= 3 && x.kind >= 3);
    if (!sameKind) return;
    const d = Math.abs(x.to - a.to) + (x.kind === a.kind ? 0 : 1);
    if (d < bestD) {
      bestD = d;
      idx = j;
    }
  });
  return idx;
}
