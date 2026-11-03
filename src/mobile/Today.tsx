import { ChevronRight, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { haptic } from '../feedback.ts';
import { LEAKS } from '../lib/engine/leaks.ts';
import { dueCards } from '../lib/training/progress.ts';
import { DAILY_TIERS, dayNumber, liveStreak, ratingSeries } from '../puzzles/engine.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { THEMES, type Theme } from '../puzzles/types.ts';
import { useUnits } from '../settings.ts';
import { useStore } from '../store.ts';
import { Countdown, Flame, PrimaryButton, Screen, Section, Sparkline } from './ui.tsx';

const THEME_ORDER: Theme[] = ['value', 'bluff', 'bluffcatch', 'fold', 'check', 'raise', 'preflop', 'potodds'];

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'Late night grind' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
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

  return (
    <Screen subtitle={date} title={greeting()} right={<div className="m-chip mb-1 px-3 py-1.5"><Flame n={streak} size={16} /></div>}>
      {/* Daily Hand */}
      <Link
        to="/daily"
        onClick={() => haptic.press()}
        className={`m-tap m-in relative block overflow-hidden rounded-[26px] p-5 ${done ? '' : 'm-glow'}`}
        style={{ background: 'radial-gradient(120% 140% at 100% 0%, #1f8f5f 0%, #12553a 38%, #0d1f19 75%)', border: '1px solid rgba(62,207,142,.25)' }}
      >
        <div className="pointer-events-none absolute -top-6 -right-4 flex rotate-12 opacity-90">
          <div className="h-[92px] w-[66px] rounded-[10px] bg-white shadow-xl" style={{ transform: 'rotate(-10deg)' }}>
            <div className="p-1.5 text-[24px] leading-none font-black text-[#151a24]">A<div className="text-[18px]">♠</div></div>
          </div>
          <div className="-ml-7 h-[92px] w-[66px] rounded-[10px] bg-white shadow-xl" style={{ transform: 'rotate(8deg) translateY(6px)' }}>
            <div className="p-1.5 text-[24px] leading-none font-black text-[#d92f3d]">K<div className="text-[18px]">♥</div></div>
          </div>
        </div>
        <div className="m-label text-white/70">Daily Hand #{day}</div>
        <div className="mt-1 max-w-[62%] text-[26px] leading-tight font-extrabold tracking-tight">{done ? 'Done for today' : results.length ? 'Finish today’s hands' : 'Three hands. One shot each.'}</div>
        <div className="mt-4 flex gap-2">
          {DAILY_TIERS.map((t, i) => (
            <div key={t.label} className="flex flex-1 flex-col items-center gap-1 rounded-[14px] bg-black/25 py-2">
              <div className="grid h-7 w-7 place-items-center rounded-[8px] text-[15px] font-black" style={{ background: results[i] ? 'var(--color-accent)' : results[i] === false ? 'var(--color-loss)' : 'rgba(255,255,255,.12)', color: '#06120c' }}>
                {results[i] ? '✓' : results[i] === false ? '✗' : ''}
              </div>
              <div className="text-[12px] font-semibold text-white/75">{t.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          {done ? (
            <span className="text-[14px] text-white/80">
              Next in <b className="text-white"><Countdown /></b>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[15px] font-bold text-[#08140e]">
              <Play size={16} fill="currentColor" /> {results.length ? 'Continue' : 'Play'}
            </span>
          )}
          <span className="text-[14px] font-semibold text-white/80">{done ? 'See result ›' : 'Same hands for everyone'}</span>
        </div>
      </Link>

      {/* Rating */}
      <Link to="/play" onClick={() => haptic.press()} className="m-tap m-card m-in flex items-center gap-4 p-4" style={{ ['--i' as string]: 1 }}>
        <div className="min-w-0 flex-1">
          <div className="m-label">Puzzle rating</div>
          <div className="flex items-baseline gap-2">
            <span className="m-num text-[34px] font-extrabold tracking-tight">{profile.rating.toLocaleString()}</span>
            {todayDelta !== 0 && (
              <span className="m-num text-[15px] font-bold" style={{ color: todayDelta > 0 ? 'var(--color-accent)' : 'var(--color-loss)' }}>
                {todayDelta > 0 ? '▲' : '▼'} {Math.abs(todayDelta)} today
              </span>
            )}
          </div>
          <div className="text-[14px] text-mute">{profile.games ? `${profile.games} played · best ${profile.peak}` : 'Puzzles adapt to you as you play'}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Sparkline data={series.length > 1 ? series : [1000, 1000]} w={86} h={34} />
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[14px] font-bold text-[#03140b]">
            <Play size={14} fill="currentColor" /> Play
          </span>
        </div>
      </Link>

      <Section title="Quick themes">
        <div className="m-hscroll -mx-4 flex gap-2.5 px-4 pb-1">
          {THEME_ORDER.map((t, i) => (
            <Link key={t} to={`/play?theme=${t}`} onClick={() => haptic.tap()} className="m-tap m-card m-in flex w-[128px] shrink-0 flex-col gap-1 p-3.5" style={{ ['--i' as string]: i + 2 }}>
              <span className="text-[26px]">{THEMES[t].emoji}</span>
              <span className="text-[15px] font-bold">{THEMES[t].label}</span>
              <span className="text-[12.5px] leading-tight text-mute">{THEMES[t].blurb}</span>
            </Link>
          ))}
        </div>
      </Section>

      <YourGameCard />
    </Screen>
  );
}

function YourGameCard() {
  const summary = useStore((s) => s.summary);
  const progress = useStore((s) => s.progress);
  const handsN = useStore((s) => s.hands.size);
  const { tx } = useUnits();
  if (!handsN || !summary) {
    return (
      <Link to="/game" onClick={() => haptic.tap()} className="m-tap m-card m-in flex items-center gap-4 p-4" style={{ ['--i' as string]: 4 }}>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-white/[.06] text-[24px]">🎯</div>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold">Train on your own hands</div>
          <div className="text-[14px] leading-snug text-mute">Play online? Send your hand histories from your computer and drill the exact spots you get wrong.</div>
        </div>
        <ChevronRight size={20} className="shrink-0 text-dim" />
      </Link>
    );
  }
  const due = dueCards(progress).length;
  const top = summary.leaks[0];
  return (
    <Section title="Your game">
      <div className="flex flex-col gap-2.5">
        {top && (
          <Link to={`/practice?leak=${top.id}&n=8`} onClick={() => haptic.press()} className="m-tap m-card m-in flex items-center gap-4 p-4" style={{ ['--i' as string]: 4 }}>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-[#3a1d1d] text-[24px]">🩹</div>
            <div className="min-w-0 flex-1">
              <div className="m-label text-[#ff8f8f]">Leak of the day</div>
              <div className="truncate text-[16px] font-bold">{LEAKS[top.id].title}</div>
              <div className="text-[13.5px] text-mute">{tx(`Costs you ${Math.round(top.per100 * 10) / 10}bb per 100 hands`)}</div>
            </div>
            <ChevronRight size={20} className="shrink-0 text-dim" />
          </Link>
        )}
        <PrimaryButton to="/practice?own=1&n=10" tone="ghost" className="m-in">
          {due ? `Review ${due} mistake${due === 1 ? '' : 's'} due today` : 'Review your mistakes'}
        </PrimaryButton>
      </div>
    </Section>
  );
}
