import { Check, Play, TriangleAlert, X, Repeat2, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { haptic } from '../feedback.ts';
import { LEAKS } from '../lib/engine/leaks.ts';
import { dueCards } from '../lib/training/progress.ts';
import { DAILY_TIERS, dayNumber, liveStreak, ratingSeries } from '../puzzles/engine.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { useUnits } from '../settings.ts';
import { useStore } from '../store.ts';
import { IconTile } from './meta.tsx';
import { Badge, Button, Countdown, Group, Row, Screen, Section, Sparkline, StreakLabel } from './ui.tsx';

/** Three circles, like daily goals: filled when solved, red when missed, numbered when still to play. */
function DailyDots({ results }: { results: boolean[] }) {
  return (
    <div className="flex justify-between gap-2">
      {DAILY_TIERS.map((t, i) => {
        const r = results[i];
        const next = r === undefined && i === results.length;
        return (
          <div key={t.label} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className="t-rounded grid h-11 w-11 place-items-center rounded-full text-[17px] font-semibold transition-colors"
              style={{
                background: r ? 'var(--green)' : r === false ? 'var(--red)' : next ? 'var(--tint-soft)' : 'var(--fill)',
                color: r !== undefined ? '#fff' : next ? 'var(--tint)' : 'var(--label-3)',
              }}
            >
              {r ? <Check size={22} strokeWidth={3} /> : r === false ? <X size={22} strokeWidth={3} /> : i + 1}
            </div>
            <span className="t-cap c-2">{t.label}</span>
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
  const series = ratingSeries(profile).slice(-30);
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayDelta = profile.history.filter((a) => a.t >= todayStart && a.d !== undefined).reduce((s, a) => s + (a.d ?? 0), 0);
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const score = results.filter(Boolean).length;

  return (
    <Screen title="Today" eyebrow={date}>
      {/* The one primary action on this screen. */}
      <div className="m-card m-in p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="t-headline">Daily Hand</div>
            <div className="t-sub c-2">{done ? `${score} of 3 correct` : 'Three spots. One try each.'}</div>
          </div>
          {streak > 0 && <StreakLabel n={streak} />}
        </div>
        <div className="mt-5 mb-5">
          <DailyDots results={results} />
        </div>
        {done ? (
          <div className="flex items-center gap-3">
            <Button tone="gray" to="/daily" className="flex-1">
              See Results
            </Button>
            <div className="t-foot c-2 shrink-0 text-right leading-tight">
              Next in
              <br />
              <span className="t-sub font-semibold" style={{ color: 'var(--label)' }}>
                <Countdown />
              </span>
            </div>
          </div>
        ) : (
          <Button to="/daily">
            <Play size={17} fill="currentColor" strokeWidth={0} /> {results.length ? 'Continue' : 'Play'}
          </Button>
        )}
        <p className="t-foot c-2 mt-2.5 text-center">Daily Hand #{day} · Same spots for everyone</p>
      </div>

      <Link to="/play" onClick={() => haptic.press()} className="m-card m-press-card m-in block p-4" style={{ ['--i' as string]: 1 }}>
        <div className="flex items-center justify-between">
          <span className="t-headline">Puzzle Rating</span>
          {todayDelta !== 0 && (
            <span className="t-sub t-num font-semibold" style={{ color: todayDelta > 0 ? 'var(--green-text)' : 'var(--red-text)' }}>
              {todayDelta > 0 ? '+' : '−'}
              {Math.abs(todayDelta)} today
            </span>
          )}
        </div>
        <div className="mt-1 flex items-end justify-between gap-4">
          <span className="t-rounded t-num text-[44px] leading-none font-bold">{profile.rating.toLocaleString()}</span>
          {series.length > 1 && <Sparkline data={series} w={104} h={40} />}
        </div>
        <div className="t-sub c-2 mt-1">{profile.games ? `Best ${profile.peak.toLocaleString()} · ${profile.games} played` : 'Puzzles adapt to your level as you play.'}</div>
        <div className="t-headline c-tint mt-3 flex items-center gap-1">
          Play Rated Puzzles
        </div>
      </Link>

      <YourGame />
    </Screen>
  );
}

function YourGame() {
  const summary = useStore((s) => s.summary);
  const progress = useStore((s) => s.progress);
  const handsN = useStore((s) => s.hands.size);
  const { tx } = useUnits();
  if (!handsN || !summary) {
    return (
      <Section title="Your Game">
        <Group inset={58}>
          <Row icon={<IconTile icon={Target} color="var(--indigo)" />} title="Train on Your Own Hands" sub="Import hand histories from your computer" to="/game" />
        </Group>
      </Section>
    );
  }
  const due = dueCards(progress).length;
  const top = summary.leaks[0];
  return (
    <Section title="Your Game">
      <Group inset={58}>
        {top && <Row icon={<IconTile icon={TriangleAlert} color="var(--orange)" />} title={LEAKS[top.id].title} sub={tx(`Biggest leak · −${Math.round(top.per100 * 10) / 10}bb per 100 hands`)} to={`/practice?leak=${top.id}&n=8`} />}
        <Row icon={<IconTile icon={Repeat2} color="var(--indigo)" />} title="Review Mistakes" sub="Spaced repetition from your hands" right={<Badge n={due} />} to="/practice?own=1&n=10" />
      </Group>
    </Section>
  );
}
