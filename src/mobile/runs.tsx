import { CircleCheck, CircleX, Flame, Share } from 'lucide-react';
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
import type { Puzzle, Theme } from '../puzzles/types.ts';
import { useUnits } from '../settings.ts';
import { useStore } from '../store.ts';
import { Player } from './Player.tsx';
import { puzzleOutcome, puzzleView, questionOutcome, questionView } from './spot.ts';
import { DrillTile, THEME_META } from './meta.tsx';
import { Bar, Button, Confetti, Countdown, Group } from './ui.tsx';

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
      <div className="h-7 w-7 animate-spin rounded-full border-[2.5px]" style={{ borderColor: 'var(--fill-2)', borderTopColor: 'var(--label-2)' }} />
    </div>
  );
}

function RatingChip({ value }: { value: number }) {
  return (
    <div className="t-rounded t-num rounded-full px-2.5 py-1 text-[15px] font-semibold" style={{ background: 'var(--fill)' }}>
      {value.toLocaleString()}
    </div>
  );
}

/* ------------------------------------------------------------------ rated */
export function RatedRun() {
  const [params] = useSearchParams();
  const theme = (params.get('theme') as Theme | null) ?? undefined;
  // A different theme in the URL starts a fresh run.
  return <RatedRunInner key={theme ?? 'all'} theme={theme} />;
}

function RatedRunInner({ theme }: { theme?: Theme }) {
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
      title={theme ? THEME_META[theme].name : 'Rated Puzzle'}
      subtitle={`Puzzle rating ${puzzle.rating.toLocaleString()}${run >= 2 ? ` · ${run} in a row` : ''}`}
      right={<RatingChip value={rating} />}
      onClose={() => nav(-1)}
      onAnswer={(key) => {
        const ok = puzzle.correct.includes(key);
        const before = shownRating.current;
        const delta = record(puzzle, ok, theme ? 'theme' : 'rated', key);
        return puzzleOutcome(puzzle, key, fmt, tx, { delta, ratingBefore: before });
      }}
      onNext={next}
      nextLabel="Next Puzzle"
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
      title={`Daily Hand #${day}`}
      subtitle={`${slot + 1} of 3 · ${DAILY_TIERS[slot].label}`}
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
      nextLabel={slot + 1 >= 3 ? 'See Results' : 'Next Hand'}
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
  const headline = score === 3 ? 'Perfect Day' : score === 2 ? 'Nicely Done' : score === 1 ? 'Tough Set' : 'Better Luck Tomorrow';
  return (
    <div className="m-app fixed inset-0 z-30 flex flex-col overflow-y-auto">
      <div className="m-safe-top" />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-5">
        <div className="relative mt-16 flex flex-col items-center text-center">
          {score === 3 && <Confetti n={44} />}
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => {
              const r = results[i];
              const Icon = r ? CircleCheck : CircleX;
              return (
                <div key={i} className="m-pop flex flex-col items-center gap-1.5" style={{ animationDelay: `${i * 120}ms` }}>
                  <Icon size={64} strokeWidth={1.8} fill="currentColor" stroke="var(--bg)" style={{ color: r ? 'var(--green)' : 'var(--red)' }} />
                  <span className="t-cap c-2">{DAILY_TIERS[i].label}</span>
                </div>
              );
            })}
          </div>
          <h1 className="t-title1 mt-6">{headline}</h1>
          <p className="t-body c-2 mt-1">
            You got {score} of 3 in Daily Hand #{day}.
          </p>
        </div>
        <div className="mt-8">
          <Group>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="t-body">Streak</span>
              <span className="t-body inline-flex items-center gap-1 font-semibold" style={{ color: streak ? 'var(--orange)' : 'var(--label-2)' }}>
                <Flame size={17} fill={streak ? 'currentColor' : 'none'} /> {streak} {streak === 1 ? 'day' : 'days'}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="t-body">Next Daily Hand</span>
              <span className="t-body c-2">
                <Countdown />
              </span>
            </div>
          </Group>
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-8 pb-4">
          <Button
            onClick={async () => {
              const r = await share(shareText(day, results, streak));
              setMsg(r === 'copied' ? 'Copied to clipboard' : r === 'failed' ? 'Couldn’t share' : null);
            }}
          >
            <Share size={18} strokeWidth={2.2} /> Share Result
          </Button>
          {msg && <div className="t-foot c-2 text-center">{msg}</div>}
          <Button tone="gray" onClick={() => nav('/play', { replace: true })}>
            Play Rated Puzzles
          </Button>
          <Button tone="plain" onClick={() => nav('/', { replace: true })}>
            Done
          </Button>
        </div>
      </div>
      <div className="m-safe-bottom" />
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
      <div className="m-app fixed inset-0 z-30 flex flex-col items-center justify-center gap-2 px-10 text-center">
        <CircleCheck size={56} strokeWidth={1.6} className="c-2 mb-2" />
        <h1 className="t-title2">All Caught Up</h1>
        <p className="t-body c-2">You’ve reviewed every mistake that’s due. Try a drill, or import more hands.</p>
        <Button tone="gray" onClick={() => nav(-1)} className="mt-4 max-w-[200px]">
          Done
        </Button>
      </div>
    );

  if (i >= queue.length || !question) return <PracticeDone title={title} results={results} drills={[...new Set(queue.map((q) => ('gen' in q ? q.gen : q.own.drill)))]} onAgain={() => { setI(0); setResults([]); }} />;

  const { q, real } = question;
  return (
    <Player
      key={`${q.id}-${i}`}
      view={questionView(q, tx, real)}
      title={title}
      subtitle={q.source === 'own' ? 'From your hands' : 'Practice spot'}
      right={<span className="t-sub c-2 t-num">{i + 1}/{queue.length}</span>}
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
      nextLabel={i + 1 >= queue.length ? 'Finish' : 'Next Spot'}
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
    <div className="m-app fixed inset-0 z-30 flex flex-col overflow-y-auto">
      <div className="m-safe-top" />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-5">
        <div className="relative mt-16 text-center">
          {ratio >= 0.8 && <Confetti />}
          <div className="t-sub c-2">{title}</div>
          <div className="m-pop t-rounded t-num mt-1 text-[72px] leading-none font-bold">
            {score}
            <span className="c-3">/{results.length}</span>
          </div>
          <p className="t-body c-2 mt-3">{ratio >= 0.8 ? 'Great session. This spot is sinking in.' : ratio >= 0.6 ? 'Solid. Another round will lock it in.' : 'This is the leak to work on. Try another round.'}</p>
        </div>
        <div className="mt-8">
          <div className="t-foot c-2 mb-1.5 px-4 uppercase">Mastery</div>
          <Group inset={58}>
            {drills.map((d) => {
              const m = mastery(progress, d);
              return (
                <div key={d} className="flex items-center gap-3 px-4 py-2.5">
                  <DrillTile drill={d} />
                  <div className="flex-1">
                    <div className="mb-1.5 flex justify-between">
                      <span className="t-body">{DRILL_INFO[d].title}</span>
                      <span className="t-body c-2 t-num">{m.score}%</span>
                    </div>
                    <Bar value={m.score / 100} color="var(--green)" />
                  </div>
                </div>
              );
            })}
          </Group>
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-8 pb-4">
          <Button onClick={onAgain}>Practice Again</Button>
          <Button tone="plain" onClick={() => nav(-1)}>
            Done
          </Button>
        </div>
      </div>
      <div className="m-safe-bottom" />
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
      title={retry ? 'Try Again' : 'Review'}
      subtitle={`${THEME_META[p.theme].name} · Puzzle rating ${p.rating}${retry ? ' · Unrated' : ''}`}
      revealed={retry === 0 && attempt ? puzzleOutcome(p, attempt.k ?? (attempt.ok ? p.best : (p.options.find((o) => !p.correct.includes(o.key))?.key ?? p.best)), fmt, tx, attempt.d !== undefined ? { delta: attempt.d, ratingBefore: (attempt.r ?? 0) - attempt.d } : {}) : undefined}
      onClose={() => nav(-1)}
      onAnswer={(key) => puzzleOutcome(p, key, fmt, tx)}
      onNext={() => (retry ? nav(-1) : setRetry((r) => r + 1))}
      nextLabel={retry ? 'Done' : 'Try Again'}
    />
  );
}

