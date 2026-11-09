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
import { DrillChip, THEME_META } from './meta.tsx';
import { Bar, Btn, Confetti, Countdown, MCard, RatingPill, Seal } from './ui.tsx';

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
      <div className="m-bob flex">
        <MCard card={51} w={46} style={{ transform: 'rotate(-8deg)' }} />
        <MCard hidden w={46} style={{ marginLeft: -14, transform: 'rotate(8deg)' }} />
      </div>
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
      title={theme ? 'Practice' : 'Rated'}
      subtitle={`Puzzle ${puzzle.rating.toLocaleString()}${run >= 2 ? ` · ${run} in a row` : ''}`}
      right={<RatingPill rating={rating} />}
      onClose={() => nav(-1)}
      onAnswer={(key) => {
        const ok = puzzle.correct.includes(key);
        const before = shownRating.current;
        const delta = record(puzzle, ok, theme ? 'theme' : 'rated', key);
        return { ...puzzleOutcome(puzzle, key, fmt, tx, { delta, ratingBefore: before }), tag: `${THEME_META[puzzle.theme].name} · puzzle ${puzzle.rating.toLocaleString()}` };
      }}
      onNext={next}
      nextLabel="Continue"
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
      subtitle={DAILY_TIERS[slot].label}
      progress={{ i: slot, n: 3, results }}
      right={<span className="m-pill f-num" style={{ paddingLeft: 13 }}>{slot + 1}/3</span>}
      onClose={() => nav(-1)}
      onAnswer={(key) => {
        const ok = puzzle.correct.includes(key);
        record(puzzle, ok, 'daily', key);
        return { ...puzzleOutcome(puzzle, key, fmt, tx), tag: THEME_META[puzzle.theme].name };
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
  const headline = score === 3 ? 'Perfect day!' : score === 2 ? 'Two for three' : score === 1 ? 'One for three' : 'Not today';
  const fig = (value: React.ReactNode, label: string) => (
    <div className="m-tile flex-1 px-2 py-4 text-center">
      <div className="f-title f-num">{value}</div>
      <div className="f-small t2 mt-1 font-normal">{label}</div>
    </div>
  );
  return (
    <div className="m-app fixed inset-0 z-30 flex flex-col overflow-y-auto">
      <div className="m-safe-top" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5">
        <div className="relative flex h-[56px] items-center justify-center">
          <span className="text-[16px] font-bold">Daily Hand</span>
        </div>
        {/* The thing you share. */}
        <div className="m-rail m-pop" style={{ borderRadius: 40 }}>
          <div className="m-felt relative px-5 pt-9 pb-8 text-center text-white" style={{ borderRadius: 32 }}>
            {score === 3 && <Confetti n={40} />}
            <div className="flex justify-center">
              {[0, 1, 2].map((i) => (
                <div key={i} className="m-flip grid h-[112px] w-[80px] place-items-center rounded-[11px] bg-white" style={{ ['--i' as string]: i, marginLeft: i ? -8 : 0, zIndex: i === 1 ? 2 : 1, transform: `rotate(${(i - 1) * 9}deg) translateY(${i === 1 ? -8 : 0}px)`, boxShadow: '0 10px 22px rgba(0,0,0,.4)' }}>
                  <Seal ok={!!results[i]} size={46} />
                </div>
              ))}
            </div>
            <div className="f-display mt-8" style={{ fontSize: 38 }}>
              {headline}
            </div>
            <div className="mt-2 text-[15px] font-medium text-white/75">Daily Hand No. {day}</div>
          </div>
        </div>

        <div className="mt-3 flex items-stretch gap-3">
          {fig(streak, 'day streak')}
          {fig(profile.rating.toLocaleString(), 'rating')}
          {fig(<Countdown />, 'next hands')}
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-8 pb-5">
          <Btn
            onClick={async () => {
              const r = await share(shareText(day, results, streak));
              setMsg(r === 'copied' ? 'Copied — paste it in the group chat' : r === 'failed' ? 'Couldn’t share' : null);
            }}
          >
            Share result
          </Btn>
          {msg && <div className="f-small t2 text-center">{msg}</div>}
          <Btn tone="outline" onClick={() => nav('/', { replace: true })}>
            Done
          </Btn>
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
        <div className="m-pop mb-3">
          <Seal ok size={72} />
        </div>
        <h1 className="f-display">All caught up</h1>
        <p className="f-body t2">Every mistake that’s due has been reviewed. Try a drill, or import more hands.</p>
        <Btn tone="outline" onClick={() => nav(-1)} className="mt-5 max-w-[220px]">
          Done
        </Btn>
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
      right={<span className="m-pill f-num" style={{ paddingLeft: 13 }}>{i + 1}/{queue.length}</span>}
      progress={queue.length <= 12 ? { i, n: queue.length, results } : undefined}
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
      nextLabel={i + 1 >= queue.length ? 'Finish' : 'Continue'}
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
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5">
        <div className="relative mt-14 text-center">
          {ratio >= 0.8 && <Confetti />}
          <div className="f-caps">{title}</div>
          <div className="m-pop f-hero f-num mt-3" style={{ fontSize: 96, color: ratio >= 0.8 ? 'var(--go)' : 'var(--text)' }}>
            {score}
            <span className="t3">/{results.length}</span>
          </div>
          <p className="f-body t2 mt-3">{ratio >= 0.8 ? 'Great session — this spot is sinking in.' : ratio >= 0.6 ? 'Solid. One more round locks it in.' : 'This is the leak to work on. Run it back.'}</p>
        </div>
        <div className="f-caps mt-9 mb-2.5 px-1">Mastery</div>
        <div className="m-tile-flat flex flex-col gap-4 p-4">
          {drills.map((d) => {
            const m = mastery(progress, d);
            return (
              <div key={d} className="flex items-center gap-3">
                <DrillChip drill={d} size={40} />
                <div className="flex-1">
                  <div className="mb-1.5 flex justify-between">
                    <span className="f-ui font-semibold">{DRILL_INFO[d].title}</span>
                    <span className="f-ui f-num t2">{m.score}%</span>
                  </div>
                  <Bar value={m.score / 100} h={8} color={m.score >= 70 ? 'var(--go)' : 'var(--gold)'} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-auto flex flex-col gap-3 pt-8 pb-5">
          <Btn onClick={onAgain}>Run it back</Btn>
          <Btn tone="ghost" onClick={() => nav(-1)}>
            Done
          </Btn>
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
      title={retry ? 'Try again' : 'Review'}
      subtitle={`${THEME_META[p.theme].name} · Puzzle rating ${p.rating}${retry ? ' · Unrated' : ''}`}
      revealed={retry === 0 && attempt ? puzzleOutcome(p, attempt.k ?? (attempt.ok ? p.best : (p.options.find((o) => !p.correct.includes(o.key))?.key ?? p.best)), fmt, tx, attempt.d !== undefined ? { delta: attempt.d, ratingBefore: (attempt.r ?? 0) - attempt.d } : {}) : undefined}
      onClose={() => nav(-1)}
      onAnswer={(key) => ({ ...puzzleOutcome(p, key, fmt, tx), tag: THEME_META[p.theme].name })}
      onNext={() => (retry ? nav(-1) : setRetry((r) => r + 1))}
      nextLabel={retry ? 'Done' : 'Try again'}
    />
  );
}

