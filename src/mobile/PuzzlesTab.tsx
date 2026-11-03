import { CircleCheck, CircleX } from 'lucide-react';
import { ratingSeries } from '../puzzles/engine.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { THEME_META, THEME_ORDER, ThemeTile } from './meta.tsx';
import { Button, Group, RatingChart, Row, Screen, Section } from './ui.tsx';

function ago(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
}

export default function PuzzlesTab() {
  const profile = usePuzzles((s) => s.profile);
  const series = ratingSeries(profile);
  const recent = [...profile.history].reverse().slice(0, 15);
  const acc = profile.games ? Math.round((profile.solved / profile.games) * 100) : null;
  return (
    <Screen title="Puzzles">
      <div className="m-card m-in p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="t-sub c-2">Your Rating</div>
            <div className="t-rounded t-num text-[48px] leading-[1.05] font-bold">{profile.rating.toLocaleString()}</div>
          </div>
          <div className="t-sub c-2 text-right leading-snug">
            <div>
              Best <span className="t-num font-semibold" style={{ color: 'var(--label)' }}>{profile.peak.toLocaleString()}</span>
            </div>
            <div>
              Solved <span className="t-num font-semibold" style={{ color: 'var(--label)' }}>{acc === null ? '—' : `${acc}%`}</span>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <RatingChart data={series.slice(-80)} h={120} />
        </div>
        <Button to="/play" className="mt-4">
          Play Rated Puzzles
        </Button>
        <p className="t-foot c-2 mt-2.5 text-center">Solve a puzzle and your rating goes up. Miss one and it goes down. Puzzles get harder as you improve.</p>
      </div>

      <Section title="Themes">
        <Group inset={58}>
          {THEME_ORDER.map((t) => {
            const st = profile.themes[t];
            const pct = st && st.n ? Math.round((st.ok / st.n) * 100) : null;
            return <Row key={t} icon={<ThemeTile theme={t} />} title={THEME_META[t].name} sub={THEME_META[t].blurb} value={pct === null ? undefined : `${pct}%`} to={`/play?theme=${t}`} />;
          })}
        </Group>
      </Section>

      <Section title="Recent">
        {recent.length === 0 ? (
          <div className="m-group t-sub c-2 px-4 py-6 text-center">Puzzles you play will appear here.</div>
        ) : (
          <Group inset={58}>
            {recent.map((a, i) => {
              const Icon = a.ok ? CircleCheck : CircleX;
              return (
                <Row
                  key={`${a.id}-${a.t}-${i}`}
                  icon={<Icon size={30} strokeWidth={1.8} fill="currentColor" stroke="var(--bg-2)" style={{ color: a.ok ? 'var(--green)' : 'var(--red)' }} className="shrink-0" />}
                  title={THEME_META[a.th].name}
                  sub={`${a.mode === 'daily' ? 'Daily Hand · ' : ''}Rating ${a.pr} · ${ago(a.t)}`}
                  value={
                    a.d !== undefined ? (
                      <span style={{ color: a.d >= 0 ? 'var(--green-text)' : 'var(--red-text)' }}>
                        {a.d >= 0 ? '+' : '−'}
                        {Math.abs(a.d)}
                      </span>
                    ) : undefined
                  }
                  to={`/review/${a.id}`}
                />
              );
            })}
          </Group>
        )}
      </Section>
    </Screen>
  );
}

