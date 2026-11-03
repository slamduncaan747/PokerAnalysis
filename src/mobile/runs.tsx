import { Share2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { haptic, sound } from '../feedback.ts';
import { DRILL_INFO, LEAKS, type DrillType } from '../lib/engine/leaks.ts';
import type { LeakId } from '../lib/engine/types.ts';
import { generateQuestion, gradeAnswer, questionFromDecision, type Question } from '../lib/training/drills.ts';
import { mastery, recordAttempt as recordTraining } from '../lib/training/progress.ts';
import { buildQueue, useOwnMistakesOf, type QueueItem } from '../lib/training/queue.ts';
import { DAILY_TIERS, dailySet, dayNumber, liveStreak, pickPuzzle, recentIds, shareText } from '../puzzles/engine.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { THEMES, type Puzzle, type Theme } from '../puzzles/types.ts';
import { useUnits } from '../settings.ts';
import { useStore } from '../store.ts';
import { Player } from './Player.tsx';
import { puzzleOutcome, puzzleView, questionOutcome, questionView } from './spot.ts';
import { Bar, Confetti, Countdown, Flame, PrimaryButton } from './ui.tsx';

export function useBank() {
  const bank = usePuzzles((s) => s.bank);
  const ensure = usePuzzles((s) => s.ensureBank);
  useEffect(() => {
    if (!bank) void ensure();
  }, [bank, ensure]);
  return bank;
}

function Loading() {
  return (
    <div className="m-app fixed inset-0 grid place-items-center">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/15 border-t-accent" />
    </div>
  );
}

function RatingChip({ value }: { value: number }) {
  return <div className="m-num rounded-full bg-white/[.08] px-3 py-1.5 text-[14px] font-bold">{value.toLocaleString()}</div>;
}

/* ------------------------------------------------------------------ rated */
export function RatedRun() {
  const [params] = useSearchParams();
  const theme = (params.get('theme') as Theme | null) ?? undefined;
  const nav = useNavigate();
  const bank = useBank();
  const record = usePuzzles((s) => s.record);
  const rating = usePuzzles((s) => s.profile.rating);
  const run = usePuzzles((s) => s.profile.run);
  const { fmt, tx } = useUnits();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const shownRating = useRef(rating);

  const next = useCallback(() => {
    if (!bank) return;
    const p = usePuzzles.getState().profile;
    shownRating.current = p.rating;
    setPuzzle(pickPuzzle(bank, p.rating, recentIds(p), { theme }));
  }, [bank, theme]);
  useEffect(() => {
    if (bank && !puzzle) next();
  }, [bank, puzzle, next]);

  if (!bank || !puzzle) return <Loading />;
  const view = puzzleView(puzzle, fmt);
  return (
    <Player
      key={puzzle.id}
      view={view}
      title={
        <div className="flex flex-col leading-tight">
          <span>{theme ? `${THEMES[theme].emoji} ${THEMES[theme].label}` : 'Rated puzzle'}</span>
          <span className="m-num text-[12px] font-semibold text-dim">Puzzle rating {puzzle.rating}</span>
        </div>
      }
      right={
        <div className="flex items-center gap-1.5">
          {run >= 2 && <Flame n={run} size={14} />}
          <RatingChip value={rating} />
        </div>
      }
      onClose={() => nav(-1)}
      onAnswer={(key) => {
        const ok = puzzle.correct.includes(key);
        const before = shownRating.current;
        const delta = record(puzzle, ok, theme ? 'theme' : 'rated', key);
        return puzzleOutcome(puzzle, key, fmt, tx, { delta, ratingBefore: before });
      }}
      onNext={next}
      nextLabel="Next puzzle"
    />
  );
}

/* ------------------------------------------------------------------ daily */
export function DailyRun() {
  const nav = useNavigate();
  const bank = useBank();
  const profile = usePuzzles((s) => s.profile);
  const record = usePuzzles((s) => s.record);
  const { fmt, tx } = useUnits();
  const day = useMemo(() => dayNumber(), []);
  const set = useMemo(() => (bank ? dailySet(bank, day) : []), [bank, day]);
  const results = profile.daily[day] ?? [];
  const [slot, setSlot] = useState(() => results.length);
  const [finished, setFinished] = useState(results.length >= 3);

  if (!bank) return <Loading />;
  if (finished || slot >= set.length) return <DailyDone day={day} results={results} />;
  const puzzle = set[slot];
  return (
    <Player
      key={puzzle.id}
      view={puzzleView(puzzle, fmt)}
      title={
        <div className="flex flex-col leading-tight">
          <span>Daily Hand #{day}</span>
          <span className="text-[12px] font-semibold text-dim">
            {slot + 1}/3 · {DAILY_TIERS[slot].label}
          </span>
        </div>
      }
      progress={{ i: slot, n: 3, results }}
      onClose={() => nav(-1)}
      onAnswer={(key) => {
        const ok = puzzle.correct.includes(key);
        record(puzzle, ok, 'daily', key);
        return puzzleOutcome(puzzle, key, fmt, tx);
      }}
      onNext={() => {
        if (slot + 1 >= 3) setFinished(true);
        setSlot((s) => s + 1);
      }}
      nextLabel={slot + 1 >= 3 ? 'See results' : 'Next hand'}
    />
  );
}

async function share(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ text });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

function DailyDone({ day, results }: { day: number; results: boolean[] }) {
  const nav = useNavigate();
  const profile = usePuzzles((s) => s.profile);
  const streak = liveStreak(profile, day);
  const score = results.filter(Boolean).length;
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (score === 3) {
      haptic.celebrate();
      sound.fanfare();
    } else haptic.success();
  }, [score]);
  const headline = score === 3 ? 'Perfect day!' : score === 2 ? 'Nice work' : score === 1 ? 'Tough set' : 'Rough one';
  return (
    <div className="m-app fixed inset-0 z-30 flex flex-col items-center overflow-y-auto px-6 text-center">
      <div className="m-safe-top" />
      <div className="relative mt-16 flex flex-col items-center">
        {score === 3 && <Confetti n={48} />}
        <div className="m-label">Daily Hand #{day}</div>
        <div className="m-pop mt-3 flex gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid h-16 w-16 place-items-center rounded-[18px] text-[28px] font-black" style={{ background: results[i] ? 'var(--color-accent)' : results[i] === false ? 'var(--color-loss)' : 'rgba(255,255,255,.08)', color: '#06120c', animationDelay: `${i * 120}ms` }}>
              {results[i] ? '✓' : results[i] === false ? '✗' : ''}
            </div>
          ))}
        </div>
        <h1 className="m-title mt-6">{headline}</h1>
        <p className="m-sub mt-1">
          {score}/3 correct · {DAILY_TIERS.map((t) => t.label).join(' → ')}
        </p>
      </div>
      <div className="m-card mt-8 flex w-full max-w-sm items-center justify-between px-5 py-4">
        <div className="text-left">
          <div className="m-label">Streak</div>
          <div className="text-[28px] font-extrabold">
            <Flame n={streak} size={28} />
          </div>
        </div>
        <div className="text-right">
          <div className="m-label">Next daily in</div>
          <div className="text-[22px] font-bold">
            <Countdown />
          </div>
        </div>
      </div>
      <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
        <PrimaryButton
          tone="light"
          onClick={async () => {
            const r = await share(shareText(day, results, streak));
            setMsg(r === 'copied' ? 'Copied — paste it anywhere' : r === 'failed' ? 'Couldn’t share' : null);
          }}
        >
          <Share2 size={19} /> Share result
        </PrimaryButton>
        {msg && <div className="text-[14px] text-mute">{msg}</div>}
        <PrimaryButton onClick={() => nav('/play', { replace: true })}>Keep going: rated puzzles</PrimaryButton>
        <button className="m-tap py-3 text-[16px] font-semibold text-mute" onClick={() => nav('/', { replace: true })}>
          Done
        </button>
      </div>
      <div className="m-safe-bottom h-6" />
    </div>
  );
}

/* --------------------------------------------------------------- practice */
export function PracticeRun() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const drill = params.get('drill') as DrillType | null;
  const leak = params.get('leak') as LeakId | null;
  const own = params.get('own') === '1';
  const hand = params.get('hand');
  const idx = params.get('idx');
  const n = parseInt(params.get('n') ?? '10');
  const hands = useStore((s) => s.hands);
  const analyses = useStore((s) => s.analyses);
  const ordered = useStore((s) => s.ordered);
  const setProgress = useStore((s) => s.setProgress);
  const mistakes = useOwnMistakesOf(ordered);
  const queue = useMemo<QueueItem[]>(
    () => buildQueue({ drill, leak, own, hand, idx: idx ? parseInt(idx) : null, n }, mistakes, useStore.getState().progress, analyses),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drill, leak, own, hand, idx, n, analyses.size],
  );
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const question = useMemo<{ q: Question; real?: { bb: number; currency?: string; tournament?: boolean } } | null>(() => {
    const item = queue[i];
    if (!item) return null;
    if ('gen' in item) {
      const q = generateQuestion(item.gen);
      return q ? { q } : null;
    }
    const h = hands.get(item.own.handId);
    const d = analyses.get(item.own.handId)?.decisions.find((x) => x.actionIndex === item.own.actionIndex);
    if (!h || !d) return null;
    return { q: questionFromDecision(h, d, { drill: item.own.drill, source: 'own' }), real: { bb: h.bb, currency: h.currency, tournament: h.gameType === 'tournament' } };
  }, [queue, i, hands, analyses]);
  const { tx } = useUnits(question?.real);
  const title = leak ? LEAKS[leak].title : drill ? DRILL_INFO[drill].title : 'Your mistakes';

  if (!queue.length)
    return (
      <div className="m-app fixed inset-0 z-30 flex flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-[44px]">🎯</div>
        <h1 className="m-h2">Nothing due right now</h1>
        <p className="m-sub">You’ve reviewed every mistake that’s due. Try a drill, or import more hands.</p>
        <PrimaryButton onClick={() => nav(-1)} className="w-full max-w-xs">
          Back
        </PrimaryButton>
      </div>
    );

  if (i >= queue.length || !question) return <PracticeDone title={title} results={results} drills={[...new Set(queue.map((q) => ('gen' in q ? q.gen : q.own.drill)))]} onAgain={() => { setI(0); setResults([]); }} />;

  const { q, real } = question;
  return (
    <Player
      key={`${q.id}-${i}`}
      view={questionView(q, tx, real)}
      title={
        <div className="flex flex-col leading-tight">
          <span className="truncate">{title}</span>
          <span className="text-[12px] font-semibold text-dim">{q.source === 'own' ? 'From your hands' : 'Practice spot'}</span>
        </div>
      }
      right={<span className="m-num text-[14px] font-bold text-mute">{i + 1}/{queue.length}</span>}
      progress={{ i, n: queue.length, results }}
      onClose={() => nav(-1)}
      onAnswer={(key) => {
        const g = gradeAnswer(q, key);
        setResults((r) => [...r, g.correct]);
        setProgress(
          recordTraining(useStore.getState().progress, {
            drill: q.drill,
            correct: g.correct,
            qid: q.id,
            own: q.source === 'own' && q.handId !== undefined ? { handId: q.handId, actionIndex: q.actionIndex! } : undefined,
          }),
        );
        return questionOutcome(q, key, g.correct, tx);
      }}
      onNext={() => setI((x) => x + 1)}
      nextLabel={i + 1 >= queue.length ? 'Finish' : 'Next spot'}
    />
  );
}

function PracticeDone({ title, results, drills, onAgain }: { title: string; results: boolean[]; drills: DrillType[]; onAgain: () => void }) {
  const nav = useNavigate();
  const progress = useStore((s) => s.progress);
  const score = results.filter(Boolean).length;
  const ratio = results.length ? score / results.length : 0;
  useEffect(() => {
    if (ratio >= 0.8) haptic.celebrate();
    else haptic.success();
  }, [ratio]);
  return (
    <div className="m-app fixed inset-0 z-30 flex flex-col items-center overflow-y-auto px-6 text-center">
      <div className="m-safe-top" />
      <div className="relative mt-16">
        {ratio >= 0.8 && <Confetti />}
        <div className="m-label">{title}</div>
        <div className="m-pop m-num mt-3 text-[64px] leading-none font-black">
          {score}
          <span className="text-dim">/{results.length}</span>
        </div>
        <p className="m-sub mt-3">{ratio >= 0.8 ? 'Excellent — this spot is sinking in.' : ratio >= 0.6 ? 'Solid. A couple more rounds and it sticks.' : 'This is exactly the leak to work on. Go again!'}</p>
      </div>
      <div className="m-card mt-8 flex w-full max-w-sm flex-col gap-3 p-4 text-left">
        {drills.map((d) => {
          const m = mastery(progress, d);
          return (
            <div key={d}>
              <div className="mb-1.5 flex justify-between text-[14px]">
                <span className="font-semibold">{DRILL_INFO[d].title}</span>
                <span className="m-num text-mute">Mastery {m.score}%</span>
              </div>
              <Bar value={m.score / 100} />
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
        <PrimaryButton onClick={onAgain}>Go again</PrimaryButton>
        <button className="m-tap py-3 text-[16px] font-semibold text-mute" onClick={() => nav(-1)}>
          Done
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- review */
export function PuzzleReview() {
  const { id } = useParams();
  const nav = useNavigate();
  const bank = useBank();
  const { fmt, tx } = useUnits();
  const attempt = usePuzzles((s) => [...s.profile.history].reverse().find((a) => a.id === id));
  const [retry, setRetry] = useState(0);
  const p = bank?.find((x) => x.id === id);
  if (!bank) return <Loading />;
  if (!p) {
    nav('/puzzles', { replace: true });
    return null;
  }
  return (
    <Player
      key={`${p.id}-${retry}`}
      view={puzzleView(p, fmt)}
      title={
        <div className="flex flex-col leading-tight">
          <span>{retry ? 'Try again (unrated)' : 'Review'}</span>
          <span className="m-num text-[12px] font-semibold text-dim">
            {THEMES[p.theme].label} · {p.rating}
          </span>
        </div>
      }
      revealed={retry === 0 && attempt ? puzzleOutcome(p, attempt.k ?? (attempt.ok ? p.best : (p.options.find((o) => !p.correct.includes(o.key))?.key ?? p.best)), fmt, tx, attempt.d !== undefined ? { delta: attempt.d, ratingBefore: (attempt.r ?? 0) - attempt.d } : {}) : undefined}
      onClose={() => nav(-1)}
      onAnswer={(key) => puzzleOutcome(p, key, fmt, tx)}
      onNext={() => (retry ? nav(-1) : setRetry((r) => r + 1))}
      nextLabel={retry ? 'Done' : 'Try it again'}
    />
  );
}

