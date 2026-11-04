import { Check, ChevronRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { haptic } from '../feedback.ts';
import { LEAKS } from '../lib/engine/leaks.ts';
import { dueCards } from '../lib/training/progress.ts';
import { DAILY_TIERS, dayNumber, liveStreak, ratingSeries } from '../puzzles/engine.ts';
import { tierOf } from '../puzzles/ranks.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { useUnits } from '../settings.ts';
import { useStore } from '../store.ts';
import { Badge, Bar, Btn, Countdown, MCard, Sparkline, StreakPill, TierChip } from './ui.tsx';

/** The wordmark, set in the serif. */
export function Wordmark() {
  return <span className="f-serif text-[27px] leading-none font-semibold">Leakfinder</span>;
}

/** A gold seal (tick) or a muted red one (cross), as on a result card. */
export function Seal({ ok, size = 42 }: { ok: boolean; size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-full"
      style={
        ok
          ? { width: size, height: size, background: 'radial-gradient(circle at 40% 35%,#ecd598,#c7a253 60%,#9c7c3c)', color: '#2a1f0a', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.25)' }
          : { width: size, height: size, background: '#ece4d4', color: '#b3261e', boxShadow: 'inset 0 0 0 1.5px #b3261e' }
      }
    >
      {ok ? <Check size={size * 0.48} strokeWidth={3} /> : <X size={size * 0.4} strokeWidth={3} />}
    </div>
  );
}

/** Today's three hands: face down until played, then turned over to a seal. */
function DailyCards({ results }: { results: boolean[] }) {
  return (
    <div className="flex justify-center gap-4">
      {DAILY_TIERS.map((t, i) => {
        const r = results[i];
        const next = r === undefined && i === results.length;
        const tilt = `rotate(${(i - 1) * 6}deg) translateY(${i === 1 ? -6 : 0}px)`;
        return (
          <div key={t.label} className={next ? 'm-bob' : ''}>
            {r === undefined ? (
              <MCard hidden w={62} style={{ transform: tilt }} />
            ) : (
              <div className="m-flip grid h-[88px] w-[62px] place-items-center rounded-[7px]" style={{ ['--i' as string]: i, transform: tilt, background: '#fbf8f1', boxShadow: '0 8px 18px rgba(0,0,0,.45)' }}>
                <Seal ok={r} size={36} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Today() {
  const profile = usePuzzles((s) => s.profile);
  const day = dayNumber();
  const results = profile.daily[day] ?? [];
  const done = results.length >= 3;
  const streak = liveStreak(profile, day);
  const { tier, next, progress, toNext } = tierOf(profile.rating);
  const series = ratingSeries(profile).slice(-40);
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayDelta = profile.history.filter((a) => a.t >= todayStart && a.d !== undefined).reduce((s, a) => s + (a.d ?? 0), 0);
  const score = results.filter(Boolean).length;

  return (
    <div className="m-fade px-6 pb-10">
      <div className="m-safe-top" />
      <div className="flex h-14 items-center justify-between">
        <Wordmark />
        {streak > 0 && <StreakPill n={streak} />}
      </div>

      {/* The number that matters, big — like a balance. */}
      <Link to="/puzzles" onClick={() => haptic.tap()} className="m-press mt-5 block">
        <div className="f-caps">Puzzle rating</div>
        <div className="mt-2 flex items-end justify-between">
          <div className="f-hero f-num" style={{ fontSize: 80 }}>
            {profile.rating.toLocaleString()}
          </div>
          <div className="pb-2 text-right">
            {todayDelta !== 0 && (
              <div className="f-ui f-num font-semibold" style={{ color: todayDelta > 0 ? 'var(--go)' : 'var(--bad)' }}>
                {todayDelta > 0 ? '+' : '−'}
                {Math.abs(todayDelta)} today
              </div>
            )}
            <div className="f-ui t2">{tier.name}</div>
          </div>
        </div>
        {series.length >= 5 && (
          <div className="mt-3">
            <Sparkline data={series} w={342} h={56} fill={false} />
          </div>
        )}
      </Link>

      {/* The daily ritual. */}
      <div className="m-felt m-in relative mt-7 overflow-hidden rounded-[24px] px-5 pt-5 pb-5" style={{ boxShadow: '0 0 0 1px var(--hair), 0 20px 40px rgba(0,0,0,.45)' }}>
        <div className="flex items-baseline justify-between">
          <span className="f-title" style={{ fontSize: 28 }}>
            The Daily Hand
          </span>
          <span className="f-caps" style={{ color: 'rgba(242,236,224,.7)' }}>
            No. {day}
          </span>
        </div>
        <div className="my-6">
          <DailyCards results={results} />
        </div>
        {done ? (
          <Btn to="/daily" tone="outline" style={{ ['--ring' as string]: 'rgba(242,236,224,.35)' }}>
            {score === 3 ? 'Perfect day — see your result' : `${score} of 3 — see your result`}
          </Btn>
        ) : (
          <Btn to="/daily">{results.length ? 'Continue today’s hands' : 'Play today’s three hands'}</Btn>
        )}
        <div className="f-small mt-3 text-center" style={{ color: 'rgba(242,236,224,.65)' }}>
          {done ? (
            <>
              Next hands in <Countdown />
            </>
          ) : (
            'Same hands for everyone · one try each'
          )}
        </div>
      </div>

      <div className="m-tile-flat m-list mt-4 overflow-hidden">
        <Link to="/play" onClick={() => haptic.tap()} className="m-row-press flex items-center gap-4 px-5 py-4">
          <TierChip rating={profile.rating} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between">
              <span className="f-head">{tier.name}</span>
              <span className="f-small c-gold font-semibold">Play rated</span>
            </div>
            {next && (
              <>
                <div className="mt-2">
                  <Bar value={progress} />
                </div>
                <div className="f-small t2 mt-1.5 font-normal">
                  {toNext} points to {next.name}
                </div>
              </>
            )}
          </div>
        </Link>
        <YourGame />
      </div>
    </div>
  );
}

function YourGame() {
  const summary = useStore((s) => s.summary);
  const progress = useStore((s) => s.progress);
  const handsN = useStore((s) => s.hands.size);
  const { tx } = useUnits();
  const icon = (
    <div className="flex w-11 shrink-0 justify-center">
      <MCard card={51} w={24} style={{ transform: 'rotate(-8deg)' }} />
      <MCard card={46} w={24} style={{ marginLeft: -12, transform: 'rotate(8deg)' }} />
    </div>
  );
  if (!handsN || !summary) {
    return (
      <Link to="/game" onClick={() => haptic.tap()} className="m-row-press flex items-center gap-4 px-5 py-4">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="f-ui font-semibold">Train on your own hands</div>
          <div className="f-small t2 font-normal">Bring your hand histories and drill your real leaks</div>
        </div>
        <ChevronRight size={18} className="t3" />
      </Link>
    );
  }
  const due = dueCards(progress).length;
  const top = summary.leaks[0];
  return (
    <>
      {top && (
        <Link to={`/practice?leak=${top.id}&n=8`} onClick={() => haptic.tap()} className="m-row-press flex items-center gap-4 px-5 py-4">
          {icon}
          <div className="min-w-0 flex-1">
            <div className="f-ui font-semibold">Your biggest leak</div>
            <div className="f-small t2 truncate font-normal">
              {LEAKS[top.id].title} · {tx(`${Math.round(top.per100 * 10) / 10}bb`)}/100
            </div>
          </div>
          <ChevronRight size={18} className="t3" />
        </Link>
      )}
      <Link to="/practice?own=1&n=10" onClick={() => haptic.tap()} className="m-row-press flex items-center gap-4 px-5 py-4">
        <div className="f-serif grid w-11 shrink-0 place-items-center text-[26px] font-semibold c-gold">↺</div>
        <div className="min-w-0 flex-1">
          <div className="f-ui font-semibold">Review your mistakes</div>
          <div className="f-small t2 font-normal">Spaced out so they stick</div>
        </div>
        <Badge n={due} />
        <ChevronRight size={18} className="t3" />
      </Link>
    </>
  );
}
