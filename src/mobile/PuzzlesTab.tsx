import { Check, Lock, X } from 'lucide-react';
import { liveStreak, ratingSeries } from '../puzzles/engine.ts';
import { TIERS, tierOf } from '../puzzles/ranks.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { THEME_META, THEME_ORDER, ThemeChip } from './meta.tsx';
import { Bar, Btn, Chip, List, RatingChart, Row, Section, StreakPill, TabScreen, Tile, TierChip } from './ui.tsx';

function ago(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

/** All six ranks as chips; yours is lifted, the ones above are locked. */
function RankLadder({ rating }: { rating: number }) {
  const { tier } = tierOf(rating);
  const idx = TIERS.indexOf(tier);
  return (
    <div className="m-hscroll -mx-5 flex gap-2 px-5 pb-1">
      {TIERS.map((t, i) => {
        const here = i === idx;
        const locked = i > idx;
        return (
          <div key={t.name} className={`flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-[16px] py-3 ${here ? 'm-tile' : ''}`} style={here ? { boxShadow: 'inset 0 0 0 2px var(--gold), 0 3px 0 #070912' } : undefined}>
            <div className={`relative ${locked ? 'opacity-35 grayscale' : ''}`}>
              <Chip color={t.color} size={here ? 48 : 40}>
                <span style={{ fontSize: t.denom.length > 2 ? 10 : 13 }}>{t.denom}</span>
              </Chip>
              {locked && <Lock size={14} className="absolute -right-1 -bottom-1 text-white" />}
            </div>
            <span className={`f-small font-bold ${here ? '' : 't2'}`}>{t.name}</span>
            <span className="f-small f-num t3 -mt-1 font-normal">{t.min ? `${t.min}+` : 'Start'}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function PuzzlesTab() {
  const profile = usePuzzles((s) => s.profile);
  const series = ratingSeries(profile);
  const recent = [...profile.history].reverse().slice(0, 12);
  const acc = profile.games ? Math.round((profile.solved / profile.games) * 100) : null;
  const { tier, next, toNext } = tierOf(profile.rating);
  return (
    <TabScreen title="Puzzles" right={<StreakPill n={liveStreak(profile)} />}>
      <div className="m-tile m-in p-5">
        <div className="flex items-center gap-4">
          <TierChip rating={profile.rating} size={60} />
          <div className="min-w-0 flex-1">
            <div className="f-tiny t2">{tier.name}{next ? ` · ${toNext} to ${next.name}` : ''}</div>
            <div className="f-hero f-num">{profile.rating.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="f-head f-num">{acc === null ? '—' : `${acc}%`}</div>
            <div className="f-tiny t3">Solved</div>
          </div>
        </div>
        <div className="mt-4">
          <RatingChart data={series.slice(-80)} h={110} />
        </div>
        <Btn to="/play" className="mt-5 uppercase tracking-wide">
          Play rated
        </Btn>
      </div>

      <Section title="Ranks">
        <RankLadder rating={profile.rating} />
      </Section>

      <Section title="Themes">
        <div className="grid grid-cols-2 gap-3">
          {THEME_ORDER.map((t, i) => {
            const st = profile.themes[t];
            const pct = st && st.n ? st.ok / st.n : null;
            return (
              <Tile key={t} to={`/play?theme=${t}`} className="m-in flex flex-col gap-3 p-4" style={{ ['--i' as string]: i }}>
                <div className="flex items-start justify-between">
                  <ThemeChip theme={t} size={42} />
                  {pct !== null && <span className="f-small f-num font-bold">{Math.round(pct * 100)}%</span>}
                </div>
                <div>
                  <div className="f-ui leading-tight font-bold">{THEME_META[t].name}</div>
                  <div className="f-small t2 font-normal">{THEME_META[t].blurb}</div>
                </div>
                <Bar value={pct ?? 0} h={6} color={pct === null ? 'transparent' : pct >= 0.7 ? 'var(--go)' : pct >= 0.5 ? 'var(--gold)' : 'var(--bad)'} />
              </Tile>
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
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: a.ok ? 'var(--go)' : 'var(--bad)', color: a.ok ? 'var(--go-ink)' : '#fff' }}>
                    {a.ok ? <Check size={17} strokeWidth={3.4} /> : <X size={17} strokeWidth={3.4} />}
                  </span>
                }
                title={THEME_META[a.th].name}
                sub={`${a.mode === 'daily' ? 'Daily · ' : ''}${a.pr} · ${ago(a.t)}`}
                value={
                  a.d !== undefined ? (
                    <span className="font-bold" style={{ color: a.d >= 0 ? 'var(--gold)' : 'var(--text-3)' }}>
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
