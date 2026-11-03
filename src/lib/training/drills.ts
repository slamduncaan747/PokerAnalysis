import { CLASS_COMBOS, COMBOS, comboIndex, handClass, rng, type Card } from '../cards.ts';
import { describeActions } from '../describe.ts';
import { analyzeHand, chartHands } from '../engine/analyze.ts';
import { classifyPostflop } from '../engine/classify.ts';
import { freqOf, rfiChart, vs3betChart, vsLimpChart, vsOpenChart, type Chart } from '../engine/charts.ts';
import type { DrillType } from '../engine/leaks.ts';
import { CLASS_ORDER, CLASS_PCT } from '../engine/ranges.ts';
import { boardStrength, describeHand, DRAW_FD, DRAW_OESD } from '../engine/strength.ts';
import type { Decision, LeakId } from '../engine/types.ts';
import type { Hand, Position } from '../types.ts';
import { buildSyntheticHand, type SynthSpec } from './synthetic.ts';

export interface QOption {
  key: string;
  label: string;
  ev?: number;
  freq?: number;
}

export interface Question {
  id: string;
  drill: DrillType;
  source: 'generated' | 'own';
  prompt: string;
  heroCards: [Card, Card];
  board: Card[];
  position: Position;
  villainPos?: Position;
  potBB: number;
  toCallBB: number;
  stackBB: number;
  history: string[];
  options: QOption[];
  correct: string[];
  bestKey: string;
  explanation: string[];
  handLabel: string;
  handId?: string;
  actionIndex?: number;
  leak?: LeakId;
  /** For pot-odds drills: answer format */
  kind?: 'action' | 'math';
}

let seedCounter = (Date.now() & 0xffff) * 7919;
const R = () => rng(seedCounter++);

function pick<T>(xs: readonly T[], r: () => number): T {
  return xs[Math.floor(r() * xs.length)];
}

function dealCombo(cls: string, r: () => number): [Card, Card] {
  const [a, b] = COMBOS[pick(CLASS_COMBOS[cls], r)];
  return r() < 0.5 ? [a, b] : [b, a];
}

/** Sample a hand class, biased towards the decision boundary of the chart so drills are informative. */
function sampleClass(chart: Chart, r: () => number): string {
  const boundary: string[] = [];
  let prev: string | null = null;
  for (const cls of CLASS_ORDER) {
    const f = freqOf(chart, cls);
    const top = f.raise >= f.call && f.raise >= f.fold ? 'r' : f.call >= f.fold ? 'c' : 'f';
    if (prev !== null && prev !== top) boundary.push(cls);
    if (f.raise > 0.05 && f.raise < 0.95) boundary.push(cls);
    prev = top;
  }
  if (boundary.length && r() < 0.65) {
    const b = pick(boundary, r);
    const idx = CLASS_ORDER.indexOf(b);
    const j = Math.max(0, Math.min(CLASS_ORDER.length - 1, idx + Math.round((r() - 0.5) * 16)));
    return CLASS_ORDER[j];
  }
  // weighted by combos
  const i = Math.floor(r() * 1326);
  return handClass(...COMBOS[i]);
}

function chartQuestion(
  drill: DrillType,
  chart: Chart,
  cls: string,
  r: () => number,
  ctx: { position: Position; villainPos?: Position; prompt: string; history: string[]; potBB: number; toCallBB: number },
): Question {
  const f = freqOf(chart, cls);
  const heroCards = dealCombo(cls, r);
  const options: QOption[] = [];
  if (!chart.freeCall) options.push({ key: 'fold', label: 'Fold', freq: f.fold });
  if (chart.callLabel && (chart.callW.size > 0 || chart.freeCall || drill !== 'rfi'))
    options.push({ key: 'call', label: chart.freeCall ? 'Check' : chart.callLabel, freq: f.call });
  options.push({ key: 'raise', label: chart.raiseLabel, freq: f.raise });
  const max = Math.max(...options.map((o) => o.freq ?? 0));
  const best = options.find((o) => (o.freq ?? 0) === max)!.key;
  const correct = options.filter((o) => (o.freq ?? 0) >= 0.3 || o.key === best).map((o) => o.key);
  const label = describeHand(heroCards, []);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const explanation = [
    `${label} (${cls}) in this spot: ${chart.raiseLabel} ${pct(f.raise)} · ${chart.freeCall ? 'Check' : chart.callLabel} ${pct(f.call)}${chart.freeCall ? '' : ` · Fold ${pct(f.fold)}`}.`,
    `${chart.raiseLabel} range: ${chartHands(chart, 'raise')}.`,
  ];
  if (chart.callW.size && !chart.freeCall) explanation.push(`${chart.callLabel} range: ${chartHands(chart, 'call')}.`);
  explanation.push(`${cls} sits around the top ${Math.max(1, Math.round(CLASS_PCT[cls] * 100))}% of starting hands.`);
  return {
    id: `g-${drill}-${seedCounter}-${cls}`,
    drill,
    source: 'generated',
    prompt: ctx.prompt,
    heroCards,
    board: [],
    position: ctx.position,
    villainPos: ctx.villainPos,
    potBB: ctx.potBB,
    toCallBB: ctx.toCallBB,
    stackBB: 100,
    history: ctx.history,
    options,
    correct,
    bestKey: best,
    explanation,
    handLabel: label,
    kind: 'action',
  };
}

const OPENERS: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

function genPreflop(drill: DrillType, r: () => number): Question {
  switch (drill) {
    case 'rfi': {
      const pos = pick(['UTG', 'HJ', 'CO', 'BTN', 'SB'] as Position[], r);
      const chart = rfiChart(pos, 6);
      const cls = sampleClass(chart, r);
      return chartQuestion(drill, chart, cls, r, {
        position: pos, prompt: `Folded to you in the ${pos}. Raise or fold?`, history: [`Preflop: folds to you (${pos})`], potBB: 1.5, toCallBB: 1,
      });
    }
    case 'vs_open': {
      const hero = pick(['HJ', 'CO', 'BTN', 'SB'] as Position[], r);
      const openers = OPENERS.slice(0, OPENERS.indexOf(hero));
      const op = pick(openers.length ? openers : ['UTG' as Position], r);
      const chart = vsOpenChart(hero, op, 0);
      const cls = sampleClass(chart, r);
      return chartQuestion(drill, chart, cls, r, {
        position: hero, villainPos: op, prompt: `${op} opens to 2.5bb. You're in the ${hero}.`, history: [`Preflop: ${op} raises to 2.5bb, folds to you (${hero})`], potBB: 4, toCallBB: hero === 'SB' ? 2 : 2.5,
      });
    }
    case 'bb_defense': {
      const op = pick(OPENERS, r);
      const chart = vsOpenChart('BB', op, 0);
      const cls = sampleClass(chart, r);
      const size = op === 'SB' ? 3 : 2.5;
      return chartQuestion(drill, chart, cls, r, {
        position: 'BB', villainPos: op, prompt: `${op} opens to ${size}bb and it's on you in the big blind.`, history: [`Preflop: ${op} raises to ${size}bb, folds to you (BB)`], potBB: size + 1 + (op === 'SB' ? 0 : 0.5), toCallBB: size - 1,
      });
    }
    case 'vs_3bet': {
      const hero = pick(['UTG', 'HJ', 'CO', 'BTN', 'SB'] as Position[], r);
      const after = (['HJ', 'CO', 'BTN', 'SB', 'BB'] as Position[]).slice(['UTG', 'HJ', 'CO', 'BTN', 'SB'].indexOf(hero));
      const tb = pick(after, r);
      const chart = vs3betChart(hero, tb);
      // Only ask with hands we'd actually open.
      const rfi = rfiChart(hero, 6);
      let cls = sampleClass(chart, r);
      for (let k = 0; k < 30 && freqOf(rfi, cls).raise < 0.5; k++) cls = sampleClass(chart, r);
      const size = tb === 'SB' || tb === 'BB' ? 10 : 8;
      return chartQuestion(drill, chart, cls, r, {
        position: hero, villainPos: tb, prompt: `You open ${hero} to 2.5bb and ${tb} 3-bets to ${size}bb.`, history: [`Preflop: you raise to 2.5bb (${hero}), ${tb} raises to ${size}bb`], potBB: size + 2.5 + 1.5, toCallBB: size - 2.5,
      });
    }
    case 'vs_limp': {
      const hero = pick(['CO', 'BTN', 'SB', 'BB'] as Position[], r);
      const chart = vsLimpChart(hero);
      const cls = sampleClass(chart, r);
      return chartQuestion(drill, chart, cls, r, {
        position: hero, prompt: `UTG limps. You're in the ${hero}.`, history: [`Preflop: UTG calls 1bb, folds to you (${hero})`], potBB: 2.5, toCallBB: hero === 'BB' ? 0 : hero === 'SB' ? 0.5 : 1,
      });
    }
    default:
      throw new Error('not preflop');
  }
}

function randomBoard(dead: Card[], r: () => number): Card[] {
  const used = new Set(dead);
  const out: Card[] = [];
  while (out.length < 5) {
    const c = Math.floor(r() * 52);
    if (!used.has(c)) {
      used.add(c);
      out.push(c);
    }
  }
  return out;
}

interface Template {
  hero: Position;
  villain: Position;
  script: string[];
  street: 'flop' | 'turn' | 'river';
  ok: (hs: number, draws: number) => boolean;
  prompt: string;
  stackBB?: number;
}

const TEMPLATES: Partial<Record<DrillType, Template[]>> = {
  bluffcatch: [
    { hero: 'BB', villain: 'BTN', street: 'river', ok: (hs) => hs >= 0.6 && hs < 0.9, prompt: 'Villain fires three streets. Call or fold?',
      script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:bet:0.33', 'BB:call', 'TURN', 'BB:check', 'BTN:bet:0.66', 'BB:call', 'RIVER', 'BB:check', 'BTN:bet:0.75', 'BB:?'] },
    { hero: 'CO', villain: 'BB', street: 'river', ok: (hs) => hs >= 0.62 && hs < 0.9, prompt: 'The big blind leads the river into you.',
      script: ['CO:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'CO:bet:0.5', 'BB:call', 'TURN', 'BB:check', 'CO:check', 'RIVER', 'BB:bet:0.66', 'CO:?'] },
    { hero: 'BTN', villain: 'BB', street: 'turn', ok: (hs) => hs >= 0.62 && hs < 0.88, prompt: 'You get check-raised on the turn.',
      script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:check', 'TURN', 'BB:check', 'BTN:bet:0.5', 'BB:raise:3', 'BTN:?'] },
  ],
  value: [
    { hero: 'BTN', villain: 'BB', street: 'river', ok: (hs) => hs >= 0.8, prompt: 'Checked to you on the river. How do you get value?',
      script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:bet:0.33', 'BB:call', 'TURN', 'BB:check', 'BTN:check', 'RIVER', 'BB:check', 'BTN:?'] },
    { hero: 'CO', villain: 'BB', street: 'turn', ok: (hs) => hs >= 0.86, prompt: 'Checked to you on the turn.',
      script: ['CO:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'CO:bet:0.5', 'BB:call', 'TURN', 'BB:check', 'CO:?'] },
    { hero: 'BB', villain: 'BTN', street: 'flop', ok: (hs) => hs >= 0.93, prompt: 'You flop big and the button c-bets.',
      script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:bet:0.33', 'BB:?'] },
  ],
  bluff: [
    { hero: 'BTN', villain: 'BB', street: 'river', ok: (hs) => hs < 0.5, prompt: 'Checked to you on the river with a missed hand.',
      script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:bet:0.33', 'BB:call', 'TURN', 'BB:check', 'BTN:check', 'RIVER', 'BB:check', 'BTN:?'] },
    { hero: 'CO', villain: 'BTN', street: 'flop', ok: (hs) => hs < 0.6, prompt: 'You opened, got called, and missed the flop.',
      script: ['CO:raise:2.5', 'BTN:call', 'FLOP', 'CO:?'] },
    { hero: 'BB', villain: 'BTN', street: 'river', ok: (hs) => hs < 0.45, prompt: 'Villain checks back turn. You missed — bet the river?',
      script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:bet:0.33', 'BB:call', 'TURN', 'BB:check', 'BTN:check', 'RIVER', 'BB:?'] },
  ],
  draws: [
    { hero: 'BB', villain: 'BTN', street: 'flop', ok: (hs, d) => (d & (DRAW_FD | DRAW_OESD)) !== 0 && hs < 0.8, prompt: 'You flop a draw and face a c-bet.',
      script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:bet:0.5', 'BB:?'] },
    { hero: 'BTN', villain: 'BB', street: 'flop', ok: (hs, d) => (d & (DRAW_FD | DRAW_OESD)) !== 0 && hs < 0.8, prompt: 'Checked to you with a draw.',
      script: ['BTN:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'BTN:?'] },
    { hero: 'CO', villain: 'BB', street: 'turn', ok: (hs, d) => (d & (DRAW_FD | DRAW_OESD)) !== 0 && hs < 0.8, prompt: 'The big blind leads the turn. You have a draw.',
      script: ['CO:raise:2.5', 'BB:call', 'FLOP', 'BB:check', 'CO:bet:0.33', 'BB:call', 'TURN', 'BB:bet:0.66', 'CO:?'] },
  ],
};

function genPostflop(drill: DrillType, r: () => number): Question | null {
  const ts = TEMPLATES[drill];
  if (!ts) return null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const t = pick(ts, r);
    // Hero's preflop hand must be consistent with the line.
    const heroCls = handClass(...COMBOS[Math.floor(r() * 1326)]);
    const pre = t.hero === 'BB' ? vsOpenChart('BB', t.villain, 0) : rfiChart(t.hero, 6);
    const f = freqOf(pre, heroCls);
    if ((t.hero === 'BB' ? f.call + f.raise * 0.3 : f.raise) < 0.5) continue;
    const heroCards = dealCombo(heroCls, r);
    const board = randomBoard(heroCards, r);
    const visible = board.slice(0, t.street === 'flop' ? 3 : t.street === 'turn' ? 4 : 5);
    const bs = boardStrength(visible);
    const ci = comboIndex(heroCards[0], heroCards[1]);
    if (!t.ok(bs.hs[ci], bs.draws[ci])) continue;
    const spec: SynthSpec = { hero: t.hero, villain: t.villain, heroCards, board, script: t.script, stackBB: t.stackBB };
    const q = fromSynthetic(drill, spec, t.prompt, r);
    if (q) return q;
  }
  return null;
}

function fromSynthetic(drill: DrillType, spec: SynthSpec, prompt: string, r: () => number): Question | null {
  const id = `g-${drill}-${Math.floor(r() * 1e9)}`;
  const { hand, decisionIndex } = buildSyntheticHand(spec, id);
  const analysis = analyzeHand(hand, { iterations: 1500 });
  const d = analysis.decisions.find((x) => x.actionIndex === decisionIndex);
  if (!d) return null;
  return questionFromDecision(hand, d, { drill, source: 'generated', prompt });
}

export function questionFromDecision(
  hand: Hand,
  d: Decision,
  o: { drill: DrillType; source: 'generated' | 'own'; prompt?: string },
): Question {
  const hero = hand.players.find((p) => p.isHero)!;
  const lastAgg = [...hand.actions.slice(0, d.actionIndex)].reverse().find((a) => a.type === 'bet' || a.type === 'raise');
  const villainPos = lastAgg && lastAgg.player !== hand.hero ? hand.players.find((p) => p.name === lastAgg.player)?.position : undefined;
  let options: QOption[];
  let correct: string[];
  if (d.options.some((x) => x.ev !== undefined)) {
    options = d.options.map((x) => ({ key: x.key, label: x.label, ev: x.ev }));
    const bestEv = Math.max(...d.options.map((x) => x.ev ?? -1e9));
    correct = d.options
      .filter((x) => {
        const c = classifyPostflop(bestEv - (x.ev ?? 0), d.potBB);
        return c === 'best' || c === 'excellent' || c === 'good';
      })
      .map((x) => x.key);
    // Show options in a natural order (passive first, then sizes ascending)
    const rank = (k: string) => (k === 'fold' ? 0 : k === 'check' ? 1 : k === 'call' ? 2 : 3);
    options.sort((a, b) => rank(a.key) - rank(b.key) || parseFloat(a.key.split(':')[1] ?? '0') - parseFloat(b.key.split(':')[1] ?? '0'));
  } else {
    options = d.options.map((x) => ({ key: x.key, label: x.label, freq: x.freq }));
    const max = Math.max(...d.options.map((x) => x.freq ?? 0));
    correct = d.options.filter((x) => (x.freq ?? 0) >= 0.3 || (x.freq ?? 0) === max).map((x) => x.key);
  }
  const history = describeActions(hand, d.actionIndex).map((x) => x.text);
  const toCall = d.toCallBB;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const defaultPrompt =
    d.street === 'preflop'
      ? `${d.spot}. What's your play?`
      : toCall > 0
        ? lastAgg?.type === 'raise'
          ? `${villainPos ?? 'Villain'} raises to ${r2(lastAgg.toAmount / hand.bb)}bb. ${r2(toCall)}bb to call.`
          : `${villainPos ?? 'Villain'} bets ${r2(toCall)}bb into ${r2(d.potBB - toCall)}bb.`
        : 'Action is on you.';
  return {
    id: o.source === 'own' ? `own-${hand.id}-${d.actionIndex}` : hand.id,
    drill: o.drill,
    source: o.source,
    prompt: o.prompt ?? defaultPrompt,
    heroCards: hand.heroCards,
    board: d.board,
    position: hero.position,
    villainPos,
    potBB: d.potBB,
    toCallBB: d.toCallBB,
    stackBB: d.stackBB,
    history,
    options,
    correct,
    bestKey: d.bestKey,
    explanation: o.source === 'own' ? d.explanation.filter((e) => !e.startsWith('You chose') && !e.startsWith('Your play')) : d.explanation.filter((e) => !e.startsWith('You chose') && !e.startsWith('Your play')),
    handLabel: d.handLabel,
    handId: o.source === 'own' ? hand.id : undefined,
    actionIndex: o.source === 'own' ? d.actionIndex : undefined,
    leak: d.leak,
    kind: 'action',
  };
}

function genPotOdds(r: () => number): Question {
  const pot = pick([4, 6, 8, 10, 12, 15, 20, 24, 30, 40], r);
  const frac = pick([0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.5, 2], r);
  const bet = Math.round(pot * frac * 10) / 10;
  const need = bet / (pot + 2 * bet);
  const choices = new Set<number>([Math.round(need * 100)]);
  const distract = [bet / pot, bet / (pot + bet), (bet * 2) / (pot + 2 * bet), need + 0.08, need - 0.06].map((x) => Math.round(Math.min(0.9, Math.max(0.05, x)) * 100));
  for (const d of distract) if (choices.size < 4) choices.add(d);
  while (choices.size < 4) choices.add(Math.round((need + (r() - 0.5) * 0.3) * 100));
  const opts = [...choices].sort((a, b) => a - b).map((x) => ({ key: String(x), label: `${x}%` }));
  return {
    id: `g-potodds-${seedCounter++}`,
    drill: 'pot_odds',
    source: 'generated',
    prompt: `The pot is ${pot}bb and villain bets ${bet}bb. What equity do you need to call?`,
    heroCards: [0, 0],
    board: [],
    position: 'BB',
    potBB: pot + bet,
    toCallBB: bet,
    stackBB: 100,
    history: [],
    options: opts,
    correct: [String(Math.round(need * 100))],
    bestKey: String(Math.round(need * 100)),
    explanation: [
      `You call ${bet}bb to win a final pot of ${Math.round((pot + 2 * bet) * 10) / 10}bb: ${bet} ÷ ${Math.round((pot + 2 * bet) * 10) / 10} = ${Math.round(need * 100)}%.`,
      'Shortcut: bet ÷ (pot + 2 × bet). Half-pot → 25%, two-thirds pot → 28%, pot-sized → 33%, 2× pot → 40%.',
    ],
    handLabel: '',
    kind: 'math',
  };
}

function genAllIn(r: () => number): Question | null {
  for (let k = 0; k < 50; k++) {
    const jammer = pick(['CO', 'BTN', 'SB'] as Position[], r);
    const stack = pick([10, 12, 15, 18, 20], r);
    const cls = CLASS_ORDER[Math.floor(Math.pow(r(), 1.4) * 110)];
    const heroCards = dealCombo(cls, r);
    const board = randomBoard(heroCards, r);
    const spec: SynthSpec = { hero: 'BB', villain: jammer, heroCards, board, stackBB: stack, script: [`${jammer}:raise:all-in`, 'BB:?'] };
    const q = fromSynthetic('allin', spec, `${jammer} shoves ${stack}bb. You're in the big blind with ${stack}bb.`, r);
    if (q) return q;
  }
  return null;
}

export function generateQuestion(drill: DrillType): Question | null {
  const r = R();
  switch (drill) {
    case 'rfi':
    case 'vs_open':
    case 'bb_defense':
    case 'vs_3bet':
    case 'vs_limp':
      return genPreflop(drill, r);
    case 'pot_odds':
      return genPotOdds(r);
    case 'allin':
      return genAllIn(r);
    default:
      return genPostflop(drill, r);
  }
}

export function gradeAnswer(q: Question, key: string): { correct: boolean; best: QOption; chosen: QOption; lossBB?: number } {
  const chosen = q.options.find((o) => o.key === key)!;
  const best = q.options.find((o) => o.key === q.bestKey) ?? q.options[0];
  const lossBB = chosen.ev !== undefined && best.ev !== undefined ? Math.max(0, best.ev - chosen.ev) : undefined;
  return { correct: q.correct.includes(key), best, chosen, lossBB };
}
