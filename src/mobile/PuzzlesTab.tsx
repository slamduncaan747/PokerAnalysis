import { Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { haptic } from '../feedback.ts';
import { ratingSeries } from '../puzzles/engine.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { THEMES, type Theme } from '../puzzles/types.ts';
import { Bar, PrimaryButton, RatingChart, Screen, Section } from './ui.tsx';

const THEME_ORDER: Theme[] = ['value', 'bluff', 'bluffcatch', 'fold', 'check', 'raise', 'preflop', 'potodds'];

function ago(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function PuzzlesTab() {
  const profile = usePuzzles((s) => s.profile);
  const series = ratingSeries(profile);
  const recent = [...profile.history].reverse().slice(0, 20);
  const acc = profile.games ? Math.round((profile.solved / profile.games) * 100) : null;
  return (
    <Screen title="Puzzles" subtitle="Rated · adapts to you">
      <div className="m-card m-in p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="m-label">Your rating</div>
            <div className="m-num text-[44px] leading-none font-black tracking-tight">{profile.rating.toLocaleString()}</div>
          </div>
          <div className="text-right text-[13px] leading-relaxed text-mute">
            <div>
              Best <b className="m-num text-ink">{profile.peak}</b>
            </div>
            <div>
              Solved <b className="m-num text-ink">{acc === null ? '—' : `${acc}%`}</b>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <RatingChart data={series.slice(-80)} h={110} />
        </div>
        <PrimaryButton to="/play" className="mt-4 w-full">
          <Play size={18} fill="currentColor" /> Play rated puzzles
        </PrimaryButton>
        <p className="mt-2.5 text-center text-[12.5px] text-dim">Solve one and your rating goes up; miss and it drops. Puzzles get harder as you improve.</p>
      </div>

      <Section title="Themes">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {THEME_ORDER.map((t, i) => {
            const st = profile.themes[t];
            const pct = st && st.n ? st.ok / st.n : null;
            return (
              <Link key={t} to={`/play?theme=${t}`} onClick={() => haptic.tap()} className="m-tap m-card m-in flex flex-col gap-1.5 p-3.5" style={{ ['--i' as string]: i }}>
                <div className="flex items-center justify-between">
                  <span className="text-[26px]">{THEMES[t].emoji}</span>
                  {pct !== null && <span className="m-num text-[13px] font-bold" style={{ color: pct >= 0.7 ? 'var(--color-accent)' : pct >= 0.5 ? '#f3c23a' : 'var(--color-loss)' }}>{Math.round(pct * 100)}%</span>}
                </div>
                <div className="text-[15.5px] font-bold">{THEMES[t].label}</div>
                <div className="text-[12.5px] leading-tight text-mute">{THEMES[t].blurb}</div>
                <div className="mt-1">
                  <Bar value={pct ?? 0} h={4} color={pct === null ? 'transparent' : undefined} />
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section title="Recent">
        {recent.length === 0 ? (
          <div className="m-card px-4 py-8 text-center text-[15px] text-mute">Your solved and missed puzzles show up here.</div>
        ) : (
          <div className="m-card divide-y divide-white/[.06] overflow-hidden">
            {recent.map((a, i) => (
              <Link key={`${a.id}-${a.t}-${i}`} to={`/review/${a.id}`} onClick={() => haptic.tap()} className="m-tap flex items-center gap-3 px-4 py-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[16px] font-black" style={{ background: a.ok ? 'rgba(62,207,142,.16)' : 'rgba(240,93,93,.16)', color: a.ok ? 'var(--color-accent)' : 'var(--color-loss)' }}>
                  {a.ok ? '✓' : '✗'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">
                    {THEMES[a.th].emoji} {THEMES[a.th].label}
                    {a.mode === 'daily' && <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-mute">DAILY</span>}
                  </div>
                  <div className="m-num text-[12.5px] text-dim">
                    Puzzle {a.pr} · {ago(a.t)}
                  </div>
                </div>
                {a.d !== undefined && (
                  <span className="m-num text-[15px] font-bold" style={{ color: a.d >= 0 ? 'var(--color-accent)' : 'var(--color-loss)' }}>
                    {a.d >= 0 ? '+' : '−'}
                    {Math.abs(a.d)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </Section>
    </Screen>
  );
}
