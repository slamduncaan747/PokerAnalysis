import { Lock } from 'lucide-react';
import { liveStreak } from '../puzzles/engine.ts';
import { TIERS, tierOf } from '../puzzles/ranks.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { THEME_META, THEME_ORDER, ThemeChip } from './meta.tsx';
import { Link } from 'react-router-dom';
import { haptic } from '../feedback.ts';
import { Bar, Btn, Chip, List, Row, Seal, Section, StreakPill, TabScreen, TierChip } from './ui.tsx';

function ago(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** All six ranks as chips; yours is highlighted, the ones above are locked. */
function RankLadder({ rating }: { rating: number }) {
  const { tier } = tierOf(rating);
  const idx = TIERS.indexOf(tier);
  return (
    <div className="m-tile-flat grid grid-cols-6 px-2 py-4">
      {TIERS.map((t, i) => {
        const here = i === idx;
        const locked = i > idx;
        return (
          <div key={t.name} className="flex flex-col items-center gap-2">
            <div className="relative grid h-[46px] place-items-center">
              <div style={locked ? { opacity: 0.5, filter: 'grayscale(1)' } : undefined}>
                <Chip color={t.color} size={here ? 46 : 36} lip={here}>
                  <span style={{ fontSize: (here ? 46 : 36) * (t.denom.length > 2 ? 0.24 : 0.32) }}>{t.denom}</span>
                </Chip>
              </div>
              {locked && <Lock size={13} strokeWidth={2.6} className="t3 absolute -right-0.5 -bottom-0.5" />}
            </div>
            <span className="text-[12px] leading-none font-bold" style={{ color: here ? 'var(--text)' : 'var(--text-3)' }}>{t.name}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function PuzzlesTab() {
  const profile = usePuzzles((s) => s.profile);
  const recent = [...profile.history].reverse().slice(0, 12);
  const acc = profile.history.length ? Math.round((profile.history.filter((a) => a.ok).length / profile.history.length) * 100) : null;
  const { tier, next, toNext, progress } = tierOf(profile.rating);
  return (
    <TabScreen title="Puzzles" right={liveStreak(profile) > 0 ? <StreakPill n={liveStreak(profile)} /> : undefined}>
      <div className="m-tile m-in p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="f-caps">Puzzle rating</div>
            <div className="f-hero f-num mt-2">{profile.rating.toLocaleString()}</div>
          </div>
          <TierChip rating={profile.rating} size={60} />
        </div>
        <div className="f-ui t2 mt-2">
          <span style={{ color: 'var(--text)' }} className="font-bold">{tier.name}</span>
          {acc !== null && ` · ${acc}% solved`}
        </div>
        {next && (
          <div className="mt-4">
            <Bar value={progress} color="var(--gold)" h={10} />
            <div className="f-small t2 mt-2 font-normal">
              <span className="f-num font-bold" style={{ color: 'var(--text)' }}>{toNext}</span> points to {next.name}
            </div>
          </div>
        )}
        <Btn to="/play" className="mt-5">
          Play rated
        </Btn>
      </div>

      <Section title="Ranks">
        <RankLadder rating={profile.rating} />
      </Section>

      <Section title="Practice a theme">
        <div className="grid grid-cols-2 gap-3">
          {THEME_ORDER.map((t) => {
            const st = profile.themes[t];
            return (
              <Link key={t} to={`/play?theme=${t}`} onClick={() => haptic.tap()} className="m-tile m-press flex flex-col p-4">
                <div className="flex items-start justify-between">
                  <ThemeChip theme={t} size={44} />
                  <span className="f-small f-num" style={{ color: st && st.n > 0 ? 'var(--text-2)' : 'var(--text-3)' }}>{st && st.n > 0 ? `${Math.round((st.ok / st.n) * 100)}%` : 'New'}</span>
                </div>
                <div className="mt-3 text-[16px] leading-tight font-bold">{THEME_META[t].name}</div>
                <div className="f-small t2 mt-1 font-normal">{THEME_META[t].blurb}</div>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section title="Recent">
        {recent.length === 0 ? (
          <div className="m-tile-flat f-ui t2 px-4 py-6 text-center">Puzzles you play show up here.</div>
        ) : (
          <List>
            {recent.map((a, i) => (
              <Row
                key={`${a.id}-${a.t}-${i}`}
                icon={
                  <Seal ok={a.ok} size={28} />
                }
                title={THEME_META[a.th].name}
                sub={`${a.mode === 'daily' ? 'Daily Hand' : `Puzzle ${a.pr.toLocaleString()}`} · ${ago(a.t)}`}
                value={
                  a.d !== undefined ? (
                    <span className="font-bold" style={{ color: a.d >= 0 ? 'var(--go)' : 'var(--text-3)' }}>
                      {a.d >= 0 ? '+' : '−'}
                      {Math.abs(a.d)}
                    </span>
                  ) : undefined
                }
                to={`/review/${a.id}`}
              />
            ))}
          </List>
        )}
      </Section>
    </TabScreen>
  );
}
