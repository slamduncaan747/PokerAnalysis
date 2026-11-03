import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { haptic } from '../feedback.ts';
import { LEAKS } from '../lib/engine/leaks.ts';
import { dueCards } from '../lib/training/progress.ts';
import { DAILY_TIERS, dayNumber, liveStreak, ratingSeries } from '../puzzles/engine.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { useUnits } from '../settings.ts';
import { useStore } from '../store.ts';
import { THEME_LINE, THEME_ORDER, ThemeBullet } from './lines.tsx';
import { Countdown, Section, Sparkline, Streak } from './ui.tsx';

export function greeting(d = new Date()): [string, string] {
  const h = d.getHours();
  return h < 5 ? ['Still', 'up?'] : h < 12 ? ['Good', 'morning.'] : h < 18 ? ['Good', 'afternoon.'] : ['Good', 'evening.'];
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
  const date = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit' }).replace(',', ' ·');
  const [g1, g2] = greeting();
  const headline = done ? 'That’s tonight’s set.' : results.length === 0 ? 'Three hands. One shot each.' : results.length === 1 ? 'One down, two to go.' : 'Last one. Make it count.';

  return (
    <div className="m-fade px-5 pb-8">
      <div className="m-safe-top" />
      <div className="flex h-12 items-center justify-between">
        <span className="m-label">{date}</span>
        <Streak n={streak} />
      </div>
      <h1 className="m-title mt-3 mb-6">
        {g1} <em className="text-[var(--signal)]">{g2}</em>
      </h1>

      <div className="flex flex-col gap-5">
        {/* Daily Hand: a ticket */}
        <Link to="/daily" onClick={() => haptic.press()} className="m-tap m-in block">
          <div className="m-paper m-ticket rounded-[18px] px-5 pt-5 pb-5">
            <div className="flex items-center justify-between">
              <span className="m-label !text-[#5c574e]">The Daily Hand</span>
              <span className="m-mono text-[12px] font-semibold">No. {String(day).padStart(3, '0')}</span>
            </div>
            <div className="m-serif mt-2 text-[36px] leading-[1]">{headline}</div>
            <div className="mt-5 flex gap-2.5">
              {DAILY_TIERS.map((t, i) => {
                const r = results[i];
                return (
                  <div key={t.label} className="flex flex-1 flex-col items-center gap-1.5">
                    <div
                      className="grid h-12 w-full place-items-center rounded-[10px] border-2"
                      style={{ borderColor: r ? '#16934f' : r === false ? '#d83a2f' : 'rgba(13,13,11,.14)', borderStyle: r === undefined ? 'dashed' : 'solid', color: r ? '#16934f' : '#d83a2f' }}
                    >
                      <span className="m-mono text-[20px] font-bold">{r ? '✓' : r === false ? '✗' : <span className="text-[13px] text-[rgba(13,13,11,.3)]">{i + 1}</span>}</span>
                    </div>
                    <span className="m-mono text-[10px] tracking-wider text-[#7d776b] uppercase">{t.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="m-dash mt-5 text-[var(--ink)]" />
            <div className="mt-4 flex items-center justify-between">
              {done ? (
                <span className="m-mono text-[12px] text-[#5c574e] uppercase">
                  Next hand in <b className="text-[var(--ink)]">
                    <Countdown />
                  </b>
                </span>
              ) : (
                <span className="m-mono text-[11px] text-[#7d776b] uppercase">Same hands for everyone</span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2.5 text-[14px] font-semibold text-[var(--paper)]">
                {done ? 'Result' : results.length ? 'Continue' : 'Deal me in'} <ArrowRight size={15} className="text-[var(--signal)]" />
              </span>
            </div>
          </div>
        </Link>

        {/* Rating */}
        <Link to="/play" onClick={() => haptic.press()} className="m-tap m-card m-in block p-5" style={{ ['--i' as string]: 1 }}>
          <div className="flex items-center justify-between">
            <span className="m-label">Puzzle rating</span>
            {todayDelta !== 0 ? (
              <span className={`m-num text-[12px] font-semibold ${todayDelta > 0 ? 'm-win' : 'm-loss'}`}>
                {todayDelta > 0 ? '▲' : '▼'} {Math.abs(todayDelta)} today
              </span>
            ) : (
              <span className="m-label">{profile.games ? `${profile.games} played` : 'Unrated'}</span>
            )}
          </div>
          <div className="mt-2 flex items-end justify-between gap-4">
            <span className="m-num text-[56px] leading-[.9] font-medium tracking-[-.05em]">{profile.rating.toLocaleString()}</span>
            <Sparkline data={series.length > 1 ? series : [1000, 1000]} w={110} h={44} />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3.5">
            <span className="text-[14px] text-[var(--mute)]">{profile.games ? `Best ${profile.peak} · puzzles adapt as you play` : 'Puzzles adapt to you as you play'}</span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--signal)] text-[#160700]">
              <ArrowUpRight size={18} />
            </span>
          </div>
        </Link>

        <Section kicker="Pick a line" title="Themes">
          <div className="m-hscroll -mx-5 flex gap-2.5 px-5 pb-1">
            {THEME_ORDER.map((t, i) => (
              <Link key={t} to={`/play?theme=${t}`} onClick={() => haptic.tap()} className="m-tap m-card m-in flex w-[138px] shrink-0 flex-col gap-3 p-3.5" style={{ ['--i' as string]: i + 2 }}>
                <ThemeBullet theme={t} size={34} />
                <div>
                  <div className="text-[15px] leading-tight font-semibold">{THEME_LINE[t].name}</div>
                  <div className="mt-1 text-[12.5px] leading-snug text-[var(--mute)]">{THEME_LINE[t].blurb}</div>
                </div>
              </Link>
            ))}
          </div>
        </Section>

        <YourGameCard />
      </div>
    </div>
  );
}

function YourGameCard() {
  const summary = useStore((s) => s.summary);
  const progress = useStore((s) => s.progress);
  const handsN = useStore((s) => s.hands.size);
  const { tx } = useUnits();
  if (!handsN || !summary) {
    return (
      <Link to="/game" onClick={() => haptic.tap()} className="m-tap m-card m-in block p-5" style={{ ['--i' as string]: 4 }}>
        <div className="m-label">My Game</div>
        <div className="m-serif mt-1.5 text-[26px] leading-[1.05]">Play online? Train on your own hands.</div>
        <div className="mt-2 text-[14px] leading-snug text-[var(--mute)]">Send your hand histories from your computer and drill the exact spots you get wrong.</div>
        <div className="m-mono mt-4 flex items-center gap-1.5 text-[12px] tracking-wider text-[var(--signal)] uppercase">
          Set it up <ArrowRight size={14} />
        </div>
      </Link>
    );
  }
  const due = dueCards(progress).length;
  const top = summary.leaks[0];
  return (
    <Section kicker="From your hands" title="Your game">
      <div className="m-card m-divide overflow-hidden">
        {top && (
          <Link to={`/practice?leak=${top.id}&n=8`} onClick={() => haptic.press()} className="m-tap block p-4">
            <div className="m-label !text-[var(--signal)]">Leak of the day</div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[17px] font-semibold">{LEAKS[top.id].title}</div>
                <div className="m-mono mt-0.5 text-[12px] text-[var(--mute)]">{tx(`−${Math.round(top.per100 * 10) / 10}bb`)} / 100 hands</div>
              </div>
              <ArrowRight size={18} className="shrink-0 text-[var(--dim)]" />
            </div>
          </Link>
        )}
        <Link to="/practice?own=1&n=10" onClick={() => haptic.press()} className="m-tap flex items-center justify-between p-4">
          <div>
            <div className="text-[16px] font-semibold">Review your mistakes</div>
            <div className="m-mono mt-0.5 text-[12px] text-[var(--mute)]">{due ? `${due} due today` : 'Spaced repetition'}</div>
          </div>
          <ArrowRight size={18} className="text-[var(--dim)]" />
        </Link>
      </div>
    </Section>
  );
}
