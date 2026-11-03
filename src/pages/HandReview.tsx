import { ArrowLeft, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, GraduationCap, Lightbulb } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PokerTable from '../components/PokerTable.tsx';
import { AccuracyRing, CardText, CLASS_META, ClassBadge, EvalBar, Pill } from '../components/ui.tsx';
import { handClass } from '../lib/cards.ts';
import { CLASS_EQUITY_VS_RANDOM } from '../lib/engine/preflopEquity.ts';
import { isError, type Classification, type Decision } from '../lib/engine/types.ts';
import { buildSteps, tableAt } from '../lib/replay.ts';
import type { Hand, Street } from '../lib/types.ts';
import { useStore } from '../store.ts';
import { useFilteredHands } from './Hands.tsx';
import { useMediaQuery } from '../lib/useMediaQuery.ts';

const GtoPanel = lazy(() => import('../components/GtoPanel.tsx'));

const fmt = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 100) / 100}`;

function moneyStr(hand: Hand, chips: number) {
  if (!hand.currency) return `${Math.round(chips).toLocaleString()} chips`;
  const sym = hand.currency === 'EUR' ? '€' : hand.currency === 'GBP' ? '£' : hand.currency === 'USDT' ? '₮' : '$';
  return `${chips < 0 ? '−' : ''}${sym}${Math.abs(chips).toFixed(2)}`;
}

function CoachPanel({ d, hand }: { d: Decision; hand: Hand }) {
  const [showBest, setShowBest] = useState(true);
  const meta = CLASS_META[d.classification];
  const best = d.options.find((o) => o.key === d.bestKey);
  const hasEV = d.options.some((o) => o.ev !== undefined);
  const sorted = hasEV ? [...d.options].sort((a, b) => (b.ev ?? 0) - (a.ev ?? 0)) : d.options;
  const bestEv = Math.max(...d.options.map((o) => o.ev ?? -1e9));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}>
        <ClassBadge c={d.classification} size={34} />
        <div className="min-w-0">
          <div className="font-bold leading-tight">
            {d.heroLabel} <span style={{ color: meta.color }}>{meta.text}</span>
          </div>
          <div className="text-xs text-mute">
            {d.evLoss > 0.005 ? `Costs about ${d.evLoss} bb` : d.classification === 'book' ? 'Matches the baseline chart' : 'No EV lost'} · {d.spot}
          </div>
        </div>
      </div>
      {d.classification !== 'best' && d.classification !== 'book' && best && best.key !== d.heroKey && (
        <button className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-left text-sm" onClick={() => setShowBest((x) => !x)}>
          <Lightbulb size={16} className="text-inaccuracy" />
          {showBest ? (
            <span>
              Best: <b className="text-best">{best.label}</b>
              {best.ev !== undefined && <span className="text-mute"> ({fmt(best.ev)} bb)</span>}
            </span>
          ) : (
            <span className="text-mute">Show best move</span>
          )}
        </button>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        <Pill>{d.handLabel}</Pill>
        {d.equity !== undefined && <Pill tone="good">Equity {Math.round(d.equity * 100)}%</Pill>}
        {d.potOdds !== undefined && <Pill tone="warn">Need {Math.round(d.potOdds * 100)}%</Pill>}
        <Pill>Pot {d.potBB} bb</Pill>
        {d.toCallBB > 0 && <Pill>To call {d.toCallBB} bb</Pill>}
      </div>
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-[11px] uppercase tracking-wide text-dim">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Option</th>
              <th className="px-3 py-1.5 text-right font-medium">{hasEV ? 'EV (bb)' : 'Chart'}</th>
              {hasEV && <th className="px-3 py-1.5 text-right font-medium">Folds</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((o) => {
              const isHero = o.key === d.heroKey;
              const isBest = o.key === d.bestKey;
              return (
                <tr key={o.key} className={`border-t border-line/60 ${isHero ? 'bg-panel-3/70' : ''}`}>
                  <td className="px-3 py-1.5">
                    <span className="flex items-center gap-2">
                      {o.label}
                      {isHero && <span className="rounded bg-ink/10 px-1 text-[10px] font-semibold text-mute">YOU</span>}
                      {isBest && <span className="rounded bg-best/20 px-1 text-[10px] font-semibold text-best">BEST</span>}
                    </span>
                  </td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${isBest ? 'font-semibold text-best' : ''}`}>
                    {hasEV ? (
                      <span title={`${fmt((o.ev ?? 0) - bestEv)} vs best`}>{fmt(o.ev ?? 0)}</span>
                    ) : (
                      `${Math.round((o.freq ?? 0) * 100)}%`
                    )}
                  </td>
                  {hasEV && <td className="px-3 py-1.5 text-right tabular-nums text-mute">{o.foldPct !== undefined ? `${Math.round(o.foldPct * 100)}%` : ''}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-2 text-sm leading-relaxed text-ink/90">
        {d.explanation.map((e, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-mute" />
            <span>{e}</span>
          </li>
        ))}
      </ul>
      {d.villainRange && <p className="text-[11px] text-dim">Opponent range modeled from preflop charts and their actions on each street.</p>}
      {isError(d.classification) && (
        <Link to={`/train/session?own=1&hand=${encodeURIComponent(hand.id)}&idx=${d.actionIndex}`} className="btn btn-primary self-start">
          <GraduationCap size={16} /> Practice this spot
        </Link>
      )}
    </div>
  );
}

/** Remount per hand so step state from the previous hand never leaks into the next one. */
export default function HandReview() {
  const { id } = useParams();
  const [params] = useSearchParams();
  return <HandReviewInner key={`${id}|${params.get('a') ?? ''}`} />;
}

function HandReviewInner() {
  const wide = useMediaQuery('(min-width: 1280px)');
  const { id } = useParams();
  const handId = decodeURIComponent(id ?? '');
  const hand = useStore((s) => s.hands.get(handId));
  const analysis = useStore((s) => s.analyses.get(handId));
  const list = useFilteredHands();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const steps = useMemo(() => (hand ? buildSteps(hand) : []), [hand]);
  const decByAction = useMemo(() => new Map((analysis?.decisions ?? []).map((d) => [d.actionIndex, d])), [analysis]);
  const deepLink = params.get('a');
  const firstInteresting = useMemo(() => {
    if (deepLink !== null) {
      const k = steps.findIndex((s) => s.actionIndex === parseInt(deepLink));
      if (k >= 0) return k;
    }
    if (!analysis) return 0;
    const worst = [...analysis.decisions].filter((d) => !d.trivial).sort((a, b) => b.evLoss - a.evLoss)[0];
    if (worst && worst.evLoss > 0) return steps.findIndex((s) => s.actionIndex === worst.actionIndex);
    return 0;
  }, [analysis, steps, deepLink]);
  const [stepRaw, setStep] = useState(() => Math.max(0, firstInteresting));
  const step = Math.max(0, Math.min(stepRaw, steps.length - 1));

  const idx = list.findIndex((a) => a.handId === handId);
  const prevId = idx > 0 ? list[idx - 1].handId : null;
  const nextId = idx >= 0 && idx < list.length - 1 ? list[idx + 1].handId : null;
  const q = params.toString();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') setStep((s) => Math.min(steps.length - 1, s + 1));
      else if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1));
      else if (e.key === 'Home') setStep(0);
      else if (e.key === 'End') setStep(steps.length - 1);
      else if (e.key === 'ArrowDown' && nextId) navigate(`/hand/${encodeURIComponent(nextId)}?${q}`);
      else if (e.key === 'ArrowUp' && prevId) navigate(`/hand/${encodeURIComponent(prevId)}?${q}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps.length, nextId, prevId, navigate, q]);

  if (!hand || !analysis) {
    return (
      <div className="text-mute">
        Hand not found. <Link to="/hands" className="text-accent">Back to hands</Link>
      </div>
    );
  }

  const cur = steps[step];
  const isFinal = step === steps.length - 1;
  const state = tableAt(hand, isFinal ? 'final' : cur.actionIndex ?? -1);
  const curDecision = cur.actionIndex !== null ? decByAction.get(cur.actionIndex) : undefined;
  const shownDecision = curDecision && !curDecision.trivial ? curDecision : undefined;

  // Eval bar: hero equity at the most recent decision point.
  let evalVal: number | null = CLASS_EQUITY_VS_RANDOM[handClass(hand.heroCards[0], hand.heroCards[1])] ?? null;
  let evalLabel = 'vs random';
  for (const d of analysis.decisions) {
    if (cur.actionIndex !== null && d.actionIndex <= cur.actionIndex && d.equity !== undefined) {
      evalVal = d.equity;
      evalLabel = 'equity vs range';
    }
  }
  if (isFinal) {
    evalVal = analysis.netBB > 0 ? 1 : analysis.netBB < 0 && !state.seats.find((s) => s.isHero)?.folded ? 0 : evalVal;
    evalLabel = 'result';
  }
  const heroFolded = state.seats.find((s) => s.isHero)?.folded;
  if (heroFolded) {
    evalVal = 0;
    evalLabel = 'folded';
  }

  const counts = new Map<Classification, number>();
  for (const d of analysis.decisions) if (!d.trivial) counts.set(d.classification, (counts.get(d.classification) ?? 0) + 1);

  const stakes = hand.currency ? `${moneyStr(hand, hand.sb)}/${moneyStr(hand, hand.bb)}` : `${hand.sb}/${hand.bb}${hand.ante ? ` (${hand.ante})` : ''}`;

  // Move list grouped by street
  const byStreet: { street: Street; items: { stepIdx: number; text: string; d?: Decision; hero: boolean }[] }[] = [];
  steps.forEach((s, si) => {
    if (s.actionIndex === null) return;
    const a = hand.actions[s.actionIndex];
    let g = byStreet.find((x) => x.street === a.street);
    if (!g) {
      g = { street: a.street, items: [] };
      byStreet.push(g);
    }
    const who = a.player === hand.hero ? 'You' : hand.players.find((p) => p.name === a.player)?.position ?? a.player;
    const amt = a.type === 'call' ? ` ${Math.round((a.amount / hand.bb) * 100) / 100}` : a.type === 'bet' || a.type === 'raise' ? ` ${Math.round((a.toAmount / hand.bb) * 100) / 100}` : '';
    g.items.push({ stepIdx: si, text: `${who} ${a.type}${amt}${a.allIn ? ' (all-in)' : ''}`, d: decByAction.get(s.actionIndex), hero: a.player === hand.hero });
  });

  // Phones: coach verdict first, then the solver. Wide screens: solver under the table.
  const gtoSection = (
    <>
        {curDecision && curDecision.street !== 'preflop' ? (
          <Suspense fallback={null}>
            <GtoPanel key={`${hand.id}-${curDecision.actionIndex}`} hand={hand} actionIndex={curDecision.actionIndex} decision={curDecision} />
          </Suspense>
        ) : (
          analysis.decisions.some((d) => d.street !== 'preflop') && (
            <div className="panel p-4 text-sm text-mute">
              Step to one of your flop, turn or river decisions (badges in the move list) to run the <b className="text-ink">GTO solver</b> on it.
            </div>
          )
        )}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/hands?${q}`} className="btn btn-ghost !p-2" title="Back to hands">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-lg font-bold">
              <CardText cards={hand.heroCards} />
              <span>{analysis.heroPosition}</span>
              <span className={analysis.netBB > 0 ? 'text-win' : analysis.netBB < 0 ? 'text-loss' : 'text-mute'}>
                {fmt(analysis.netBB)} bb
              </span>
            </div>
            <div className="text-xs text-mute">
              {hand.site} · {stakes} · {hand.date.replace('T', ' ')} · {hand.table} · #{hand.id.split('-').slice(1).join('-')}
              {hand.splash ? ` · splash pot +${moneyStr(hand, hand.splash)}` : ''}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" disabled={!prevId} onClick={() => prevId && navigate(`/hand/${encodeURIComponent(prevId)}?${q}`)}>
            <ChevronLeft size={16} /> Prev hand
          </button>
          <button className="btn btn-ghost" disabled={!nextId} onClick={() => nextId && navigate(`/hand/${encodeURIComponent(nextId)}?${q}`)}>
            Next hand <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_400px]">
        <div className="flex min-w-0 flex-col gap-4">
        <div className="panel flex flex-col gap-4 p-4">
          <div className="flex items-stretch gap-3">
            <div className="hidden sm:block">
              <EvalBar value={evalVal} height={360} label={evalLabel} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <PokerTable hand={hand} state={state} highlight={state.actor} />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button className="btn btn-ghost !p-2" onClick={() => setStep(0)} title="Start (Home)">
              <ChevronFirst size={18} />
            </button>
            <button className="btn btn-ghost !p-2" onClick={() => setStep((s) => Math.max(0, s - 1))} title="Back (←)">
              <ChevronLeft size={18} />
            </button>
            <div className="w-40 text-center text-xs text-mute">
              Step {step + 1} / {steps.length}
              <div className="text-[10px] text-dim">
                <span className="kbd">←</span> <span className="kbd">→</span> to step · <span className="kbd">↑</span> <span className="kbd">↓</span> hands
              </div>
            </div>
            <button className="btn btn-ghost !p-2" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} title="Forward (→)">
              <ChevronRight size={18} />
            </button>
            <button className="btn btn-ghost !p-2" onClick={() => setStep(steps.length - 1)} title="End">
              <ChevronLast size={18} />
            </button>
          </div>
        </div>
        {wide && gtoSection}
        </div>

        <div className="flex flex-col gap-4">
          <div className="panel p-4">
            {shownDecision ? (
              <CoachPanel d={shownDecision} hand={hand} />
            ) : (
              <div className="flex items-center gap-4">
                <AccuracyRing value={analysis.accuracy} size={96} />
                <div className="flex flex-col gap-1.5 text-sm">
                  <div className="font-semibold">Hand review</div>
                  {[...counts.entries()].map(([c, n]) => (
                    <div key={c} className="flex items-center gap-2">
                      <ClassBadge c={c} size={16} /> <span style={{ color: CLASS_META[c].color }}>{n} {CLASS_META[c].label}</span>
                    </div>
                  ))}
                  {!counts.size && <div className="text-mute">Routine hand — nothing to review.</div>}
                  {analysis.evLossBB > 0 && <div className="text-xs text-loss">EV lost: {analysis.evLossBB} bb</div>}
                  {analysis.evNetBB !== analysis.netBB && (
                    <div className="text-xs text-mute">
                      All-in EV: {fmt(analysis.evNetBB)} bb ({analysis.netBB > analysis.evNetBB ? 'ran good' : 'ran bad'})
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {!wide && gtoSection}

          <div className="panel max-h-[420px] overflow-y-auto p-2 scroll-thin">
            {byStreet.map((g) => (
              <div key={g.street} className="mb-1">
                <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-dim">
                  {g.street}
                  {g.street !== 'preflop' && <CardText cards={hand.board.slice(0, g.street === 'flop' ? 3 : g.street === 'turn' ? 4 : 5)} />}
                </div>
                {g.items.map((it) => (
                  <button
                    key={it.stepIdx}
                    onClick={() => setStep(it.stepIdx)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm ${step === it.stepIdx ? 'bg-panel-3' : 'hover:bg-panel-2'} ${it.hero ? 'font-semibold text-ink' : 'text-mute'}`}
                  >
                    <span className="flex-1 truncate">{it.text}</span>
                    {it.d && !it.d.trivial && <ClassBadge c={it.d.classification} size={18} />}
                  </button>
                ))}
              </div>
            ))}
            <button
              onClick={() => setStep(steps.length - 1)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm ${isFinal ? 'bg-panel-3' : 'hover:bg-panel-2'} text-mute`}
            >
              Result: {fmt(analysis.netBB)} bb {hand.wentToShowdown ? '(showdown)' : ''}
            </button>
          </div>

          <details className="panel p-3 text-xs">
            <summary className="cursor-pointer text-mute">Raw hand history</summary>
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-mute scroll-thin">{hand.raw}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}
