/**
 * Builds the puzzle bank (public/puzzles/bank.json):
 *  - postflop river puzzles solved with the GTO solver (postflop-solver, WebAssembly) and kept only
 *    when one answer is clearly best for the hero's exact hand
 *  - preflop puzzles from the range charts (pure spots only)
 *  - pot-odds maths puzzles
 * Each puzzle gets a difficulty rating (Elo scale) from how surprising and how close the answer is.
 *
 * Usage: node --experimental-strip-types --no-warnings scripts/gen-puzzles.ts [candidatesPerTemplate=420]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { initSync, SpotSolver } from '../src/solver/pkg/leakfinder_solver.js';
import { CLASS_COMBOS, COMBOS, comboIndex, hashString, rng, type Card } from '../src/lib/cards.ts';
import { analyzeHand, chartHands, describeComposition, rangeComposition } from '../src/lib/engine/analyze.ts';
import { freqOf, rfiChart, vs3betChart, vsOpenChart, type Chart } from '../src/lib/engine/charts.ts';
import { CLASS_EQUITY_VS_RANDOM } from '../src/lib/engine/preflopEquity.ts';
import { CLASS_ORDER } from '../src/lib/engine/ranges.ts';
import { boardStrength, describeBoard, describeHand } from '../src/lib/engine/strength.ts';
import { fromSolverCard } from '../src/lib/solver/common.ts';
import { readNode, solveSpot, type SpotSolverCtor } from '../src/lib/solver/run.ts';
import { buildSolverSpot } from '../src/lib/solver/spot.ts';
import { buildSyntheticHand } from '../src/lib/training/synthetic.ts';
import type { Hand, Position } from '../src/lib/types.ts';
import type { Puzzle, PuzzleOption, Theme } from '../src/puzzles/types.ts';
import { ideaFor, spreadRatings } from './puzzle-post.ts';

initSync({ module: readFileSync(new URL('../src/solver/pkg/leakfinder_solver_bg.wasm', import.meta.url)) });
const Ctor = SpotSolver as unknown as SpotSolverCtor;
const PER_TEMPLATE = parseInt(process.argv[2] ?? '420');
const rand = rng(20261104);
const r1 = (x: number) => Math.round(x * 10) / 10;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

// ---------------------------------------------------------------------------
// Postflop (river) puzzles via the solver
// ---------------------------------------------------------------------------
interface Template {
  id: string;
  hero: Position;
  villain: Position;
  script: string[];
  base: number;
}
const T: Template[] = [
  { id: 'srp-btn-checked-to', hero: 'BTN', villain: 'BB', base: 0, script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:bet:0.33', 'BB:call', 'TURN', 'BB:check', 'BTN:check', 'RIVER', 'BB:check', 'BTN:?'] },
  { id: 'srp-btn-barrel-checked-to', hero: 'BTN', villain: 'BB', base: 40, script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:bet:0.33', 'BB:call', 'TURN', 'BB:check', 'BTN:bet:0.66', 'BB:call', 'RIVER', 'BB:check', 'BTN:?'] },
  { id: 'srp-bb-vs-triple', hero: 'BB', villain: 'BTN', base: 60, script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:bet:0.33', 'BB:call', 'TURN', 'BB:check', 'BTN:bet:0.66', 'BB:call', 'RIVER', 'BB:check', 'BTN:bet:0.75', 'BB:?'] },
  { id: 'srp-bb-first-river', hero: 'BB', villain: 'BTN', base: 40, script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:bet:0.33', 'BB:call', 'TURN', 'BB:check', 'BTN:check', 'RIVER', 'BB:?'] },
  { id: 'srp-btn-vs-lead', hero: 'BTN', villain: 'BB', base: 30, script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:bet:0.33', 'BB:call', 'TURN', 'BB:check', 'BTN:check', 'RIVER', 'BB:bet:0.66', 'BTN:?'] },
  { id: 'srp-co-checked-to', hero: 'CO', villain: 'BB', base: 30, script: ['CO:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'CO:bet:0.5', 'BB:call', 'TURN', 'BB:check', 'CO:bet:0.66', 'BB:call', 'RIVER', 'BB:check', 'CO:?'] },
  { id: 'srp-bb-vs-co-bet', hero: 'BB', villain: 'CO', base: 50, script: ['CO:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'CO:bet:0.5', 'BB:call', 'TURN', 'BB:check', 'CO:check', 'RIVER', 'BB:check', 'CO:bet:0.75', 'BB:?'] },
  { id: '3bp-btn-vs-bet', hero: 'BTN', villain: 'BB', base: 120, script: ['BTN:raise:2.5', 'BB:raise:11', 'BTN:call', 'FLOP', 'BB:bet:0.33', 'BTN:call', 'TURN', 'BB:bet:0.5', 'BTN:call', 'RIVER', 'BB:bet:0.75', 'BTN:?'] },
  { id: '3bp-bb-first-river', hero: 'BB', villain: 'BTN', base: 120, script: ['BTN:raise:2.5', 'BB:raise:11', 'BTN:call', 'FLOP', 'BB:bet:0.33', 'BTN:call', 'TURN', 'BB:check', 'BTN:check', 'RIVER', 'BB:?'] },
  { id: 'bvb-bb-vs-sb-bet', hero: 'BB', villain: 'SB', base: 80, script: ['SB:raise:3', 'BB:call', 'FLOP', 'SB:bet:0.33', 'BB:call', 'TURN', 'SB:check', 'BB:check', 'RIVER', 'SB:bet:0.66', 'BB:?'] },
];

function randomBoard(): Card[] {
  const s = new Set<number>();
  while (s.size < 5) s.add(Math.floor(rand() * 52));
  return [...s];
}

type Cat = 'fold' | 'passive' | 'aggr';
const catOf = (k: number): Cat => (k === 0 ? 'fold' : k <= 2 ? 'passive' : 'aggr');

function optionOf(kind: number, toBB: number): PuzzleOption {
  switch (kind) {
    case 0:
      return { key: 'fold', kind: 'fold' };
    case 1:
      return { key: 'check', kind: 'check' };
    case 2:
      return { key: 'call', kind: 'call' };
    case 3:
      return { key: `bet:${r1(toBB)}`, kind: 'bet', toBB: r1(toBB) };
    case 4:
      return { key: `raise:${r1(toBB)}`, kind: 'raise', toBB: r1(toBB) };
    default:
      return { key: 'allin', kind: 'allin', toBB: r1(toBB) };
  }
}

function postflopPuzzle(t: Template, n: number): Puzzle | null {
  const board = randomBoard();
  // Pass 1: discover the hero's range on this line; pass 2: deal a realistic hand from it.
  const placeholder = COMBOS.find(([a, b]) => !board.includes(a) && !board.includes(b))!;
  const s1 = buildSyntheticHand({ hero: t.hero, villain: t.villain, heroCards: placeholder, board, script: t.script }, 'p1');
  const sp1 = buildSolverSpot(s1.hand, s1.decisionIndex).spot;
  if (!sp1) return null;
  const heroList = sp1.heroIsOop ? sp1.oop : sp1.ip;
  const cands: [number, number][] = [];
  for (let i = 0; i < heroList.weights.length; i++) if (heroList.weights[i] >= 0.25) cands.push([fromSolverCard(heroList.cards[2 * i]), fromSolverCard(heroList.cards[2 * i + 1])]);
  if (!cands.length) return null;
  const heroCards = cands[Math.floor(rand() * cands.length)];
  const s2 = buildSyntheticHand({ hero: t.hero, villain: t.villain, heroCards, board, script: t.script }, `${t.id}-${n}`);
  const built = buildSolverSpot(s2.hand, s2.decisionIndex);
  const spot = built.spot;
  if (!spot) return null;
  spot.targetPct = 0.3;
  spot.maxIterations = 600;
  const { solver } = solveSpot(Ctor, spot);
  const heroPlayer = spot.heroIsOop ? 0 : 1;
  const node = readNode(solver, spot.before, { heroCards, heroPlayer });
  solver.free();
  if (node.player !== heroPlayer || !node.hand) return null;

  const evs = node.hand.evs;
  const freq = node.hand.strategy;
  const potBB = node.potBB;
  const evBest = Math.max(...evs);
  const tol = Math.max(0.02 * potBB, 0.05);
  const accepted = evs.map((e, j) => (e >= evBest - tol ? j : -1)).filter((j) => j >= 0);
  const cats = new Set(accepted.map((j) => catOf(node.actions[j].kind)));
  if (cats.size !== 1) return null;
  const fA = accepted.reduce((s, j) => s + freq[j], 0);
  if (fA < 0.8) return null;
  const others = evs.map((e, j) => (accepted.includes(j) ? -Infinity : e));
  const gap = evBest - Math.max(...others);
  if (others.some((x) => x !== -Infinity) && gap < Math.max(0.06 * potBB, 0.3)) return null;

  const analysis = analyzeHand(s2.hand, { iterations: 200 });
  const d = analysis.decisions.find((x) => x.actionIndex === s2.decisionIndex);
  if (!d) return null;
  const options = node.actions.map((a) => optionOf(a.kind, a.to / 100));
  const bestIdx = evs.indexOf(evBest);
  const answerCat = catOf(node.actions[bestIdx].kind);
  const facing = d.toCallBB > 0;
  const bs = boardStrength(board);
  const hs = bs.hs[comboIndex(heroCards[0], heroCards[1])];
  const eq = node.hand.equity;
  const potOdds = facing ? d.toCallBB / (potBB + d.toCallBB) : undefined;

  let theme: Theme;
  if (facing) theme = answerCat === 'fold' ? 'fold' : answerCat === 'passive' ? (hs < 0.9 ? 'bluffcatch' : 'value') : 'raise';
  else theme = answerCat === 'aggr' ? (hs >= 0.9 || eq >= 0.5 ? 'value' : 'bluff') : 'check';

  // Difficulty: how counter-intuitive the answer is for this hand's raw strength, how close the
  // runner-up option is, how mixed the solver is, and how complex the line is.
  let c: number;
  if (facing) {
    if (answerCat === 'fold') c = clamp((hs - 0.55) / 0.4, 0, 1);
    else if (answerCat === 'passive') c = hs >= 0.97 ? 0.35 : clamp((0.92 - hs) / 0.4, 0, 1);
    else c = hs >= 0.9 ? 0.25 : 0.95;
  } else if (answerCat === 'aggr') c = hs >= 0.9 ? 0.08 : hs < 0.55 ? 0.45 : 0.8;
  else c = hs >= 0.9 ? 0.95 : hs >= 0.72 ? 0.4 : hs >= 0.55 ? 0.3 : 0.5;
  const g = Number.isFinite(gap) ? gap / potBB : 1;
  const closeness = 1 - clamp(g / 0.25, 0, 1);
  const noise = (hashString(`${t.id}-${n}-${board}`) % 121) - 60;
  const rating = Math.round(clamp(600 + 1350 * c + 250 * closeness + 0.6 * t.base + 400 * clamp(0.95 - fA, 0, 0.15) + noise, 500, 2600));

  // Villain range at the decision (modeled), for the explanation.
  const villList = spot.heroIsOop ? spot.ip : spot.oop;
  const vr = new Float32Array(1326);
  for (let i = 0; i < villList.weights.length; i++) vr[comboIndex(fromSolverCard(villList.cards[2 * i]), fromSolverCard(villList.cards[2 * i + 1]))] = villList.weights[i];
  const comp = describeComposition(rangeComposition(vr, bs));
  const handLabel = describeHand(heroCards, board);
  const toCall = r1(d.toCallBB);
  const prompt = facing
    ? `River: ${t.villain} bets ${toCall}bb into ${r1(potBB - toCall)}bb.`
    : d.spot.includes('checked to you')
      ? `River: ${t.villain} checks to you.`
      : `River: you're first to act.`;
  const correct = accepted.map((j) => options[j].key);
  const idea = ideaFor(theme, { hs, eq, potOdds, handLabel, comp, answer: options[bestIdx], facing });
  return {
    id: `pf-${hashString(`${t.id}|${heroCards}|${board}`).toString(36)}`,
    rating,
    theme,
    kind: 'postflop',
    street: 'river',
    heroPos: t.hero,
    villainPos: t.villain,
    heroCards,
    board,
    potBB: r1(potBB),
    toCallBB: toCall,
    stackBB: r1(d.stackBB),
    history: compactHistory(s2.hand, s2.decisionIndex),
    prompt,
    options,
    correct,
    best: options[bestIdx].key,
    freq: freq.map((x) => Math.round(x * 1000) / 1000),
    ev: evs.map((x) => Math.round(x * 100) / 100),
    equity: Math.round(eq * 1000) / 1000,
    potOdds: potOdds === undefined ? undefined : Math.round(potOdds * 1000) / 1000,
    handLabel,
    villainRange: comp,
    board_texture: describeBoard(board),
    idea,
  };
}

/** One short line per street, e.g. "Flop  BB checks · You bet 1.8bb · BB calls". */
function compactHistory(hand: Hand, upto: number): string[] {
  const out: string[] = [];
  let cur = '';
  let acts: string[] = [];
  let raises = 0;
  const posOf = (name: string) => hand.players.find((p) => p.name === name)!;
  const flush = () => {
    if (cur && acts.length) out.push(`${cur}: ${acts.join(' · ')}`);
  };
  for (let i = 0; i < upto; i++) {
    const a = hand.actions[i];
    if (a.type === 'post') continue;
    if (a.street !== cur) {
      flush();
      cur = a.street;
      acts = [];
    }
    if (a.type === 'fold' && cur === 'preflop') continue;
    const p = posOf(a.player);
    const who = p.isHero ? 'You' : p.position;
    const amt = `${r1(a.toAmount / hand.bb)}bb`;
    const you = p.isHero;
    let verb: string;
    if (a.type === 'raise') {
      raises++;
      if (cur !== 'preflop') verb = `${you ? 'raise' : 'raises'} to ${amt}`;
      else if (raises === 1) verb = `${you ? 'open' : 'opens'} ${amt}`;
      else verb = `${raises + 1}-bet${you ? '' : 's'} ${amt}`.replace(/^2-bet/, '3-bet');
    } else if (a.type === 'bet') verb = `${you ? 'bet' : 'bets'} ${amt}`;
    else verb = you ? a.type : `${a.type}s`;
    acts.push(`${who} ${verb}`);
  }
  flush();
  return out.map((l) => l.charAt(0).toUpperCase() + l.slice(1));
}

// ---------------------------------------------------------------------------
// Preflop puzzles from the charts
// ---------------------------------------------------------------------------
interface PfScenario {
  id: string;
  hero: Position;
  villain?: Position;
  chart: Chart;
  base: number;
  prompt: string;
  history: string;
  pot: number;
  toCall: number;
  raiseTo: number;
  options: ('fold' | 'call' | 'raise')[];
}
const pf: PfScenario[] = [];
for (const pos of ['UTG', 'HJ', 'CO', 'BTN', 'SB'] as Position[])
  pf.push({ id: `rfi-${pos}`, hero: pos, chart: rfiChart(pos, 6), base: 560, prompt: `Folded to you in the ${pos}. Raise or fold?`, history: `Preflop: folds to you`, pot: 1.5, toCall: pos === 'SB' ? 0.5 : 1, raiseTo: pos === 'SB' ? 3 : 2.5, options: ['fold', 'raise'] });
for (const [hero, op] of [['HJ', 'UTG'], ['CO', 'UTG'], ['CO', 'HJ'], ['BTN', 'UTG'], ['BTN', 'CO'], ['SB', 'CO'], ['SB', 'BTN']] as [Position, Position][])
  pf.push({ id: `vsopen-${hero}-${op}`, hero, villain: op, chart: vsOpenChart(hero, op, 0), base: 820, prompt: `${op} opens to 2.5bb. You're in the ${hero}.`, history: `Preflop: ${op} opens 2.5bb · folds to you`, pot: 4, toCall: hero === 'SB' ? 2 : 2.5, raiseTo: hero === 'SB' ? 11 : 7.5, options: ['fold', 'call', 'raise'] });
for (const op of ['UTG', 'HJ', 'CO', 'BTN', 'SB'] as Position[])
  pf.push({ id: `bb-${op}`, hero: 'BB', villain: op, chart: vsOpenChart('BB', op, 0), base: 900, prompt: `${op} opens to ${op === 'SB' ? 3 : 2.5}bb. You're in the big blind.`, history: `Preflop: ${op} opens ${op === 'SB' ? 3 : 2.5}bb · folds to you`, pot: op === 'SB' ? 4 : 4, toCall: op === 'SB' ? 2 : 1.5, raiseTo: op === 'SB' ? 9 : 11, options: ['fold', 'call', 'raise'] });
for (const [hero, tb] of [['UTG', 'BTN'], ['CO', 'BTN'], ['BTN', 'BB'], ['BTN', 'SB'], ['SB', 'BB']] as [Position, Position][])
  pf.push({ id: `vs3-${hero}-${tb}`, hero, villain: tb, chart: vs3betChart(hero, tb), base: 1080, prompt: `You open the ${hero} to ${hero === 'SB' ? 3 : 2.5}bb and the ${tb} 3-bets to ${tb === 'SB' || tb === 'BB' ? 10 : 8}bb.`, history: `Preflop: You open ${hero === 'SB' ? 3 : 2.5}bb · ${tb} 3-bets ${tb === 'SB' || tb === 'BB' ? 10 : 8}bb`, pot: (tb === 'SB' || tb === 'BB' ? 10 : 8) + (hero === 'SB' ? 3 : 2.5) + (hero === 'SB' ? 0 : tb === 'SB' ? 1 : tb === 'BB' ? 0.5 : 1.5), toCall: (tb === 'SB' || tb === 'BB' ? 10 : 8) - (hero === 'SB' ? 3 : 2.5), raiseTo: 22, options: ['fold', 'call', 'raise'] });

function preflopPuzzles(): Puzzle[] {
  const out: Puzzle[] = [];
  for (const s of pf) {
    const mine: (Puzzle & { _close: number })[] = [];
    const best = (cls: string) => {
      const f = freqOf(s.chart, cls);
      return f.raise >= f.call && f.raise >= f.fold ? 'raise' : f.call >= f.fold ? 'call' : 'fold';
    };
    CLASS_ORDER.forEach((cls, idx) => {
      const f = freqOf(s.chart, cls);
      const b = best(cls);
      if (Math.max(f.raise, f.call, f.fold) < 0.95) return;
      if (b === 'call' && !s.options.includes('call')) return;
      // Closeness to a decision boundary in the hand ranking → harder.
      let differ = 0;
      for (let k = -6; k <= 6; k++) {
        const o = CLASS_ORDER[idx + k];
        if (o && k !== 0 && best(o) !== b) differ++;
      }
      const close = differ / 12;
      // Hands whose raw strength suggests the opposite answer are trickier.
      const raw = CLASS_EQUITY_VS_RANDOM[cls];
      const trick = (b === 'fold' && raw > 0.58) || (b !== 'fold' && raw < 0.47) ? 160 : 0;
      const noise = (hashString(`${s.id}${cls}`) % 61) - 30;
      const rating = Math.round(clamp(s.base + 900 * close + trick + noise, 450, 2100));
      const combos = CLASS_COMBOS[cls];
      const [a0, b0] = COMBOS[combos[hashString(cls + s.id) % combos.length]];
      const options: PuzzleOption[] = s.options.map((o) =>
        o === 'fold' ? { key: 'fold', kind: 'fold' } : o === 'call' ? { key: 'call', kind: 'call' } : { key: `raise:${s.raiseTo}`, kind: 'raise', toBB: s.raiseTo },
      );
      const key = (o: string) => (o === 'raise' ? `raise:${s.raiseTo}` : o);
      const freqArr = s.options.map((o) => (o === 'fold' ? f.fold : o === 'call' ? f.call : f.raise));
      const label = describeHand([a0, b0], []);
      const what = b === 'raise' ? (s.id.startsWith('rfi') ? 'open' : s.id.startsWith('vs3') ? '4-bet' : '3-bet') : b;
      mine.push({
        _close: close + trick / 400,
        id: `pre-${hashString(s.id + cls).toString(36)}`,
        rating,
        theme: 'preflop',
        kind: 'preflop',
        street: 'preflop',
        heroPos: s.hero,
        villainPos: s.villain,
        heroCards: [a0, b0],
        board: [],
        potBB: s.pot,
        toCallBB: s.toCall,
        stackBB: 100,
        history: [s.history],
        prompt: s.prompt,
        options,
        correct: [key(b)],
        best: key(b),
        freq: freqArr,
        handLabel: label,
        idea:
          b === 'fold'
            ? `${label} is outside the range here. This spot is played with: ${chartHands(s.chart, 'play', 14)}.`
            : `${label} is a clear ${what} here. ${s.chart.raiseLabel} range: ${chartHands(s.chart, 'raise', 14)}.`,
      });
    });
    // Keep a spread per scenario: the boundary hands (hard) plus a few obvious ones (easy).
    const hard = mine.filter((p) => p._close > 0).sort((x, y) => hashString(x.id) - hashString(y.id)).slice(0, 12);
    const easy = mine.filter((p) => p._close === 0).sort((x, y) => hashString(x.id) - hashString(y.id)).slice(0, 4);
    for (const { _close, ...p } of [...hard, ...easy]) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pot-odds maths
// ---------------------------------------------------------------------------
function mathPuzzles(): Puzzle[] {
  const out: Puzzle[] = [];
  const pots = [4, 6, 9, 10, 12, 15, 20, 24, 30, 40];
  const fracs = [0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.5, 2];
  for (const pot of pots)
    for (const f of fracs) {
      const bet = r1(pot * f);
      const need = bet / (pot + 2 * bet);
      const ans = Math.round(need * 100);
      const ch = new Set<number>([ans]);
      for (const d of [Math.round((bet / pot) * 100), Math.round((bet / (pot + bet)) * 100), ans + 9, ans - 7, ans + 15])
        if (ch.size < 4 && d > 3 && d < 95 && !ch.has(d)) ch.add(d);
      const opts = [...ch].sort((a, b) => a - b).map((x) => ({ key: String(x), kind: 'choice' as const, label: `${x}%` }));
      const odd = !Number.isInteger(bet) || ![0.5, 1, 0.33, 0.75].includes(f);
      const rating = Math.round(560 + (odd ? 180 : 0) + (f > 1 ? 120 : 0) + (hashString(`${pot}-${f}`) % 61) - 30);
      out.push({
        id: `math-${pot}-${f}`,
        rating,
        theme: 'potodds',
        kind: 'math',
        street: 'river',
        heroPos: 'BB',
        heroCards: [0, 0],
        board: [],
        potBB: pot + bet,
        toCallBB: bet,
        stackBB: 100,
        history: [],
        prompt: `The pot is ${pot}bb and villain bets ${bet}bb. How much equity do you need to call?`,
        options: opts,
        correct: [String(ans)],
        best: String(ans),
        handLabel: '',
        idea: `You call ${bet}bb to win a final pot of ${r1(pot + 2 * bet)}bb, so you need ${bet} ÷ ${r1(pot + 2 * bet)} ≈ ${ans}%. Shortcut: half-pot 25%, two-thirds 28%, pot 33%, 2× pot 40%.`,
      });
    }
  return out;
}

// ---------------------------------------------------------------------------
const t0 = Date.now();
const post: Puzzle[] = [];
for (const t of T) {
  let kept = 0;
  for (let n = 0; n < PER_TEMPLATE; n++) {
    try {
      const p = postflopPuzzle(t, n);
      if (p) {
        post.push(p);
        kept++;
      }
    } catch (e) {
      if (n < 3) console.warn(t.id, (e as Error).message);
    }
  }
  console.log(`${t.id}: kept ${kept}/${PER_TEMPLATE} (${Math.round((Date.now() - t0) / 1000)}s)`);
}
// Balance: cap each theme, keeping an even spread of ratings within it.
const CAP = 260;
const balanced: Puzzle[] = [];
for (const th of new Set(post.map((p) => p.theme))) {
  const list = post.filter((p) => p.theme === th).sort((a, b) => a.rating - b.rating);
  if (list.length <= CAP) balanced.push(...list);
  else for (let i = 0; i < CAP; i++) balanced.push(list[Math.floor((i * list.length) / CAP)]);
}
const seen = new Set<string>();
const all = [...preflopPuzzles(), ...mathPuzzles(), ...balanced].filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
spreadRatings(all);
all.sort((a, b) => (a.id < b.id ? -1 : 1));
const byTheme: Record<string, number> = {};
for (const p of all) byTheme[p.theme] = (byTheme[p.theme] ?? 0) + 1;
const ratings = all.map((p) => p.rating).sort((a, b) => a - b);
console.log('total', all.length, byTheme, 'rating p10/p50/p90', ratings[Math.floor(ratings.length * 0.1)], ratings[Math.floor(ratings.length / 2)], ratings[Math.floor(ratings.length * 0.9)]);
writeFileSync(new URL('../public/puzzles/bank.json', import.meta.url), JSON.stringify({ version: 1, generated: new Date().toISOString().slice(0, 10), puzzles: all }));
console.log(`wrote ${all.length} puzzles in ${Math.round((Date.now() - t0) / 1000)}s`);
