import { ArrowRight, CheckCircle2, ExternalLink, Flame, RotateCcw, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClassBadge, PlayingCard, ProgressBar } from '../components/ui.tsx';
import { DRILL_INFO, LEAKS, type DrillType } from '../lib/engine/leaks.ts';
import type { LeakId } from '../lib/engine/types.ts';
import { generateQuestion, gradeAnswer, questionFromDecision, type Question } from '../lib/training/drills.ts';
import { mastery, recordAttempt } from '../lib/training/progress.ts';
import { buildQueue, type QueueItem } from '../lib/training/queue.ts';
import { useStore } from '../store.ts';
import { formatAmount, realStakeOf, rewriteAmounts, useSettings, useUnits, type RealStake } from '../settings.ts';
import { useOwnMistakes } from './Train.tsx';

function Spot({ q, real }: { q: Question; real?: RealStake }) {
  const { fmt } = useUnits(real);
  if (q.kind === 'math') {
    return (
      <div className="felt flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-[40px] p-6 text-white">
        <div className="text-sm text-white/80">Pot</div>
        <div className="text-3xl font-extrabold">{fmt(q.potBB - q.toCallBB)}</div>
        <div className="rounded-full bg-black/35 px-3 py-1 text-sm">Villain bets {fmt(q.toCallBB)}</div>
      </div>
    );
  }
  return (
    <div className="felt flex flex-col items-center gap-4 rounded-[40px] px-4 py-6 text-white sm:px-6">
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="rounded-full bg-black/35 px-2.5 py-1">
          You: <b>{q.position}</b>
        </span>
        {q.villainPos && (
          <span className="rounded-full bg-black/35 px-2.5 py-1">
            Villain: <b>{q.villainPos}</b>
          </span>
        )}
        <span className="rounded-full bg-black/35 px-2.5 py-1">
          Pot <b>{fmt(q.potBB)}</b>
        </span>
        {q.toCallBB > 0 && (
          <span className="rounded-full bg-black/35 px-2.5 py-1">
            To call <b>{fmt(q.toCallBB)}</b>
          </span>
        )}
        <span className="rounded-full bg-black/35 px-2.5 py-1">Stack {fmt(q.stackBB)}</span>
      </div>
      <div className="flex min-h-[58px] gap-1.5">
        {q.board.length ? q.board.map((c, i) => <PlayingCard key={i} card={c} size="md" />) : <span className="self-center text-sm text-white/60">Preflop</span>}
      </div>
      <div className="flex gap-1.5">
        <PlayingCard card={q.heroCards[0]} size="lg" />
        <PlayingCard card={q.heroCards[1]} size="lg" />
      </div>
      {q.handLabel && <div className="text-xs text-white/75">{q.handLabel}</div>}
    </div>
  );
}

export default function TrainSession() {
  const [params] = useSearchParams();
  const drillParam = params.get('drill') as DrillType | null;
  const leakParam = params.get('leak') as LeakId | null;
  const own = params.get('own') === '1';
  const handParam = params.get('hand');
  const idxParam = params.get('idx');
  const n = parseInt(params.get('n') ?? '10');
  const hands = useStore((s) => s.hands);
  const analyses = useStore((s) => s.analyses);
  const progress = useStore((s) => s.progress);
  const setProgress = useStore((s) => s.setProgress);
  const mistakes = useOwnMistakes();
  const [round, setRound] = useState(0);
  const unitSettings = useSettings();

  const queue = useMemo<QueueItem[]>(
    () => buildQueue({ drill: drillParam, leak: leakParam, own, hand: handParam, idx: idxParam ? parseInt(idxParam) : null, n }, mistakes, progress, analyses),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drillParam, leakParam, own, handParam, idxParam, n, round, analyses.size],
  );

  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  useEffect(() => {
    setI(0);
    setAnswer(null);
    setResults([]);
  }, [queue]);

  const question = useMemo<Question | null>(() => {
    const item = queue[i];
    if (!item) return null;
    if ('gen' in item) return generateQuestion(item.gen);
    const hand = hands.get(item.own.handId);
    const a = analyses.get(item.own.handId);
    const d = a?.decisions.find((x) => x.actionIndex === item.own.actionIndex);
    if (!hand || !d) return null;
    return questionFromDecision(hand, d, { drill: item.own.drill, source: 'own' });
  }, [queue, i, hands, analyses]);

  const choose = useCallback(
    (key: string) => {
      if (!question || answer) return;
      setAnswer(key);
      const g = gradeAnswer(question, key);
      setResults((r) => [...r, g.correct]);
      setProgress(
        recordAttempt(useStore.getState().progress, {
          drill: question.drill,
          correct: g.correct,
          qid: question.id,
          own: question.source === 'own' && question.handId !== undefined ? { handId: question.handId, actionIndex: question.actionIndex! } : undefined,
        }),
      );
    },
    [question, answer, setProgress],
  );
  const next = useCallback(() => {
    setAnswer(null);
    setI((x) => x + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!question) return;
      if (answer && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight')) {
        e.preventDefault();
        next();
      } else if (!answer && /^[1-9]$/.test(e.key)) {
        const o = question.options[parseInt(e.key) - 1];
        if (o) choose(o.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, answer, choose, next]);

  const title = leakParam ? LEAKS[leakParam].title : drillParam ? DRILL_INFO[drillParam].title : 'Your mistakes';

  if (!queue.length) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-mute">Nothing to review right now. Import more hands or try a drill.</p>
        <Link to="/train" className="btn btn-primary self-center">
          Back to training
        </Link>
      </div>
    );
  }

  if (i >= queue.length) {
    const score = results.filter(Boolean).length;
    const drills = [...new Set(queue.map((q) => ('gen' in q ? q.gen : q.own.drill)))];
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
        <ClassBadge c={score / results.length >= 0.8 ? 'great' : score / results.length >= 0.6 ? 'good' : 'mistake'} size={56} />
        <h1 className="text-3xl font-extrabold">
          {score} / {results.length}
        </h1>
        <p className="text-mute">{score / results.length >= 0.8 ? 'Excellent — this spot is sinking in.' : score / results.length >= 0.6 ? 'Solid. A couple more rounds and it sticks.' : 'This is exactly the leak to work on. Go again!'}</p>
        <div className="panel w-full p-4 text-left">
          {drills.map((d) => {
            const m = mastery(progress, d);
            return (
              <div key={d} className="py-1.5">
                <div className="mb-1 flex justify-between text-sm">
                  <span>{DRILL_INFO[d].title}</span>
                  <span className="text-mute">Mastery {m.score}%</span>
                </div>
                <ProgressBar value={m.score} />
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => setRound((r) => r + 1)}>
            <RotateCcw size={16} /> Another round
          </button>
          <Link to="/train" className="btn btn-ghost">
            Back to training
          </Link>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="text-mute">
        Generating spot…{' '}
        <button className="text-accent" onClick={next}>
          skip
        </button>
      </div>
    );
  }

  const graded = answer ? gradeAnswer(question, answer) : null;
  const hasEV = question.options.some((o) => o.ev !== undefined);
  const ownHand = question.handId ? hands.get(question.handId) : undefined;
  const real = ownHand ? realStakeOf(ownHand) : undefined;
  const tx = (t: string) => rewriteAmounts(t, unitSettings, real);
  const fmtU = (x: number) => formatAmount(x, unitSettings, real);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/train" className="text-xs text-mute hover:text-ink">
            ← Training
          </Link>
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-mute">
          <span className="flex items-center gap-1">
            <Flame size={14} className="text-mistake" /> {progress.streak}
          </span>
          <span>
            {i + 1} / {queue.length}
          </span>
        </div>
      </div>
      <ProgressBar value={(i / queue.length) * 100} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Spot q={question} real={real} />
          {question.history.length > 0 && (
            <div className="panel flex flex-col gap-1 p-3 text-sm text-mute">
              {question.history.map((h, k) => (
                <div key={k}>{tx(h)}</div>
              ))}
            </div>
          )}
          {question.source === 'own' && question.handId && (
            <Link to={`/hand/${encodeURIComponent(question.handId)}`} className="flex items-center gap-1 text-xs text-accent hover:underline">
              From your hand history <ExternalLink size={12} />
            </Link>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="panel p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-dim">
              {question.source === 'own' ? 'Your hand' : DRILL_INFO[question.drill].title}
            </div>
            <div className="text-lg font-semibold">{tx(question.prompt)}</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {question.options.map((o, k) => {
                const isChosen = answer === o.key;
                const isCorrect = question.correct.includes(o.key);
                let cls = 'btn-ghost';
                if (answer) {
                  if (isCorrect) cls = 'bg-accent/15 border border-accent text-ink';
                  else if (isChosen) cls = 'bg-loss/15 border border-loss text-ink';
                  else cls = 'btn-ghost opacity-60';
                }
                return (
                  <button key={o.key} disabled={!!answer} onClick={() => choose(o.key)} className={`btn ${cls} !justify-between !py-3 text-left`}>
                    <span>{tx(o.label)}</span>
                    {answer && (hasEV ? <span className="text-xs tabular-nums text-mute">{(o.ev ?? 0) >= 0 ? '+' : '−'}{fmtU(Math.abs(o.ev ?? 0))}</span> : o.freq !== undefined ? <span className="text-xs text-mute">{Math.round(o.freq * 100)}%</span> : null)}
                    {!answer && <span className="kbd">{k + 1}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {graded && (
            <div className={`panel pop flex flex-col gap-3 p-4 ${graded.correct ? 'border-accent/50' : 'border-loss/50'}`}>
              <div className="flex items-center gap-2 text-lg font-bold">
                {graded.correct ? <CheckCircle2 className="text-accent" /> : <XCircle className="text-loss" />}
                {graded.correct ? (answer === question.bestKey ? 'Best move!' : 'Correct — a fine option.') : 'Not quite.'}
              </div>
              {!graded.correct || answer !== question.bestKey ? (
                <div className="text-sm">
                  Best: <b className="text-best">{tx(graded.best.label)}</b>
                  {graded.lossBB !== undefined && graded.lossBB > 0 && <span className="text-mute"> — your choice costs {fmtU(graded.lossBB)}</span>}
                </div>
              ) : null}
              <ul className="flex flex-col gap-1.5 text-sm text-ink/90">
                {question.explanation.map((e, k) => (
                  <li key={k} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-mute" />
                    {tx(e)}
                  </li>
                ))}
              </ul>
              <button className="btn btn-primary self-end" onClick={next}>
                Next <ArrowRight size={16} /> <span className="kbd !border-black/20 !bg-black/10 !text-black/70">Enter</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
