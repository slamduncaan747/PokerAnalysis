import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { haptic } from '../feedback.ts';
import { ratingSeries } from '../puzzles/engine.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { THEME_LINE, THEME_ORDER, ThemeBullet } from './lines.tsx';
import { Bar, PrimaryButton, RatingChart, Screen, Section } from './ui.tsx';

function ago(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function PuzzlesTab() {
  const profile = usePuzzles((s) => s.profile);
  const series = ratingSeries(profile);
  const recent = [...profile.history].reverse().slice(0, 20);
  const acc = profile.games ? Math.round((profile.solved / profile.games) * 100) : null;
  return (
    <Screen eyebrow="Rated · adapts to you" title="Puzzles">
      <div className="m-card m-in p-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="m-label">Your rating</div>
            <div className="m-num mt-1 text-[64px] leading-[.85] font-medium tracking-[-.05em]">{profile.rating.toLocaleString()}</div>
          </div>
          <div className="m-mono text-right text-[12px] leading-[1.7] text-[var(--mute)] uppercase">
            <div>
              Best <span className="text-[var(--text)]">{profile.peak}</span>
            </div>
            <div>
              Hit rate <span className="text-[var(--text)]">{acc === null ? '—' : `${acc}%`}</span>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <RatingChart data={series.slice(-80)} h={120} />
        </div>
        <PrimaryButton to="/play" tone="signal" className="mt-5 w-full">
          Play rated puzzles <ArrowRight size={18} />
        </PrimaryButton>
        <p className="m-mono mt-3 text-center text-[10.5px] leading-relaxed tracking-wide text-[var(--dim)] uppercase">Solve → rating up · miss → rating down · gets harder as you do</p>
      </div>

      <Section kicker="Pick a line" title="Themes">
        <div className="m-card m-divide overflow-hidden">
          {THEME_ORDER.map((t, i) => {
            const st = profile.themes[t];
            const pct = st && st.n ? st.ok / st.n : null;
            return (
              <Link key={t} to={`/play?theme=${t}`} onClick={() => haptic.tap()} className="m-tap m-in flex items-center gap-3.5 px-4 py-3.5" style={{ ['--i' as string]: i }}>
                <ThemeBullet theme={t} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-semibold">{THEME_LINE[t].name}</div>
                  <div className="text-[13px] text-[var(--mute)]">{THEME_LINE[t].blurb}</div>
                </div>
                <div className="w-14 text-right">
                  {pct !== null ? (
                    <>
                      <div className="m-num text-[13px] font-semibold">{Math.round(pct * 100)}%</div>
                      <div className="mt-1">
                        <Bar value={pct} h={3} color={pct >= 0.7 ? 'var(--win)' : pct >= 0.5 ? 'var(--gold)' : 'var(--loss)'} />
                      </div>
                    </>
                  ) : (
                    <span className="m-mono text-[11px] text-[var(--dim)]">NEW</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section kicker="Your last 20" title="Recent">
        {recent.length === 0 ? (
          <div className="m-card px-4 py-8 text-center text-[14px] text-[var(--mute)]">Solved and missed puzzles show up here.</div>
        ) : (
          <div className="m-card m-divide overflow-hidden">
            {recent.map((a, i) => (
              <Link key={`${a.id}-${a.t}-${i}`} to={`/review/${a.id}`} onClick={() => haptic.tap()} className="m-tap flex items-center gap-3 px-4 py-3">
                <span className={`m-mono w-4 text-[15px] font-bold ${a.ok ? 'm-win' : 'm-loss'}`}>{a.ok ? '✓' : '✗'}</span>
                <ThemeBullet theme={a.th} size={22} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">
                    {THEME_LINE[a.th].name}
                    {a.mode === 'daily' && <span className="m-chip ml-2 !px-1.5 !py-0 !text-[9.5px]">Daily</span>}
                  </div>
                  <div className="m-mono text-[11.5px] text-[var(--dim)]">
                    {a.pr} · {ago(a.t)}
                  </div>
                </div>
                {a.d !== undefined && (
                  <span className={`m-num text-[14px] font-semibold ${a.d >= 0 ? 'm-win' : 'm-loss'}`}>
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
