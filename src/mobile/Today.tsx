import { ChevronRight, Flame, RotateCcw, Target, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { haptic } from '../feedback.ts';
import { LEAKS } from '../lib/engine/leaks.ts';
import { dueCards } from '../lib/training/progress.ts';
import { DAILY_TIERS, dayNumber, liveStreak, ratingSeries } from '../puzzles/engine.ts';
import { tierOf } from '../puzzles/ranks.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { useUnits } from '../settings.ts';
import { useStore } from '../store.ts';
import { Badge, Bar, Btn, Countdown, IconBadge, List, MCard, Row, Seal, Section, Sparkline, TierChip } from './ui.tsx';

/** Today's three hands: face down until played, then turned over to a tick or a cross. */
function DailyCards({ results }: { results: boolean[] }) {
  const w = 66;
  return (
    <div className="flex justify-center">
      {DAILY_TIERS.map((t, i) => {
        const r = results[i];
        const next = r === undefined && i === results.length;
        const tilt = `rotate(${(i - 1) * 9}deg) translateY(${i === 1 ? -8 : 0}px)`;
        return (
          <div key={t.label} className={next ? 'm-bob' : ''} style={{ marginLeft: i ? -8 : 0, zIndex: i === 1 ? 2 : 1 }}>
            {r === undefined ? (
              <MCard hidden w={w} style={{ transform: tilt }} />
            ) : (
              <div className="m-flip grid place-items-center" style={{ ['--i' as string]: i, width: w, height: Math.round(w * 1.4), borderRadius: 9, transform: tilt, background: '#fff', boxShadow: '0 10px 20px rgba(0,0,0,.35)' }}>
                <Seal ok={r} size={38} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** The last seven days: a dot for each Daily Hand you finished. */
function Week({ day, daily }: { day: number; daily: Record<number, boolean[]> }) {
  const dow = new Date().getDay();
  return (
    <div className="flex justify-between">
      {[6, 5, 4, 3, 2, 1, 0].map((back) => {
        const done = (daily[day - back]?.length ?? 0) >= 3;
        const today = back === 0;
        return (
          <div key={back} className="flex flex-col items-center gap-1.5">
            <div className="h-[18px] w-[18px] rounded-full" style={{ background: done ? 'var(--gold)' : 'var(--s3)', boxShadow: today && !done ? 'inset 0 0 0 2px var(--gold)' : undefined }} />
            <span className="text-[11px] leading-none font-semibold" style={{ color: today ? 'var(--text)' : 'var(--text-3)' }}>
              {DAY_LETTER[(dow - back + 7) % 7]}
            </span>
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
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="m-fade px-5 pb-10">
      <div className="m-safe-top" />
      <div className="pt-3 pb-4">
        <div className="f-caps">{date}</div>
        <h1 className="f-display mt-1">Today</h1>
      </div>

      {/* The daily ritual, on the table. */}
      <div className="m-rail m-in" style={{ borderRadius: 36 }}>
        <div className="m-felt relative px-5 pt-5 pb-5 text-white" style={{ borderRadius: 28 }}>
          <div className="flex items-center justify-between">
            <span className="f-title">Daily Hand</span>
            <span className="f-num grid h-7 place-items-center rounded-full px-3 text-[13px] font-bold" style={{ background: 'rgba(0,0,0,.3)' }}>
              No. {day}
            </span>
          </div>
          <div className="mt-1 text-[15px] font-medium text-white/75">{done ? (score === 3 ? 'Perfect. Three for three.' : `You got ${score} of 3 today.`) : 'Three hands. One try each.'}</div>
          <div className="mt-7 mb-7">
            <DailyCards results={results} />
          </div>
          {done ? (
            <Btn to="/daily" style={{ background: 'rgba(0,0,0,.32)', color: '#fff' }}>
              See your result
            </Btn>
          ) : (
            <Btn to="/daily">{results.length ? 'Continue' : 'Play today’s hands'}</Btn>
          )}
          {done && (
            <div className="mt-3 text-center text-[13px] font-medium text-white/70">
              Next hands in <Countdown />
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link to="/puzzles" onClick={() => haptic.tap()} className="m-tile m-press flex min-h-[156px] flex-col p-4">
          <div className="flex items-center justify-between">
            <span className="f-caps">Rating</span>
            <TierChip rating={profile.rating} size={26} />
          </div>
          <div className="f-display f-num mt-2" style={{ fontSize: 38 }}>
            {profile.rating.toLocaleString()}
          </div>
          <div className="f-small mt-1" style={{ color: todayDelta > 0 ? 'var(--go)' : todayDelta < 0 ? 'var(--bad)' : 'var(--text-2)' }}>
            {todayDelta !== 0 ? `${todayDelta > 0 ? '+' : '−'}${Math.abs(todayDelta)} today` : tier.name}
          </div>
          <div className="mt-auto pt-2">{series.length >= 5 ? <Sparkline data={series} w={138} h={30} color={series[series.length - 1] >= series[0] ? 'var(--go)' : 'var(--bad)'} /> : <span className="f-small t3 font-normal">Play to set your rating</span>}</div>
        </Link>
        <div className="m-tile flex min-h-[156px] flex-col p-4">
          <div className="flex items-center justify-between">
            <span className="f-caps">Streak</span>
            <Flame size={22} strokeWidth={2.4} fill={streak ? 'currentColor' : 'none'} style={{ color: streak ? 'var(--gold)' : 'var(--text-3)' }} />
          </div>
          <div className="f-display f-num mt-2" style={{ fontSize: 38 }}>
            {streak}
          </div>
          <div className="f-small t2 mt-1">{streak === 1 ? 'day' : 'days'}</div>
          <div className="mt-auto pt-2">
            <Week day={day} daily={profile.daily} />
          </div>
        </div>
      </div>

      <Link to="/play" onClick={() => haptic.tap()} className="m-tile m-press mt-3 flex items-center gap-4 p-4">
        <TierChip rating={profile.rating} size={52} />
        <div className="min-w-0 flex-1">
          <div className="f-head">Rated puzzles</div>
          {next ? (
            <>
              <div className="mt-2">
                <Bar value={progress} color="var(--gold)" h={8} />
              </div>
              <div className="f-small t2 mt-1.5 font-normal">
                <span className="f-num font-bold" style={{ color: 'var(--text)' }}>{toNext}</span> to {next.name}
              </div>
            </>
          ) : (
            <div className="f-small t2 mt-0.5 font-normal">Top rank. Defend it.</div>
          )}
        </div>
        <ChevronRight size={20} strokeWidth={2.4} className="t3 shrink-0" />
      </Link>

      <div className="mt-8">
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
  if (!handsN || !summary) {
    return (
      <Section title="Your game">
        <List>
          <Row icon={<IconBadge color="blue"><Upload size={21} strokeWidth={2.5} /></IconBadge>} title="Train on your own hands" sub="Import your hand histories" to="/game" />
        </List>
      </Section>
    );
  }
  const due = dueCards(progress).length;
  const top = summary.leaks[0];
  return (
    <Section title="Your game">
      <List>
        {top && <Row icon={<IconBadge color="red"><Target size={21} strokeWidth={2.5} /></IconBadge>} title="Fix your biggest leak" sub={`${LEAKS[top.id].title} · ${tx(`${Math.round(top.per100 * 10) / 10}bb`)}/100`} to={`/practice?leak=${top.id}&n=8`} />}
        <Row icon={<IconBadge color="gold"><RotateCcw size={21} strokeWidth={2.5} /></IconBadge>} title="Review your mistakes" sub="Spaced out so they stick" right={<Badge n={due} />} to="/practice?own=1&n=10" />
      </List>
    </Section>
  );
}
