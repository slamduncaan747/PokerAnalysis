import { Check, ChevronRight, X } from 'lucide-react';
import { LEAKS } from '../lib/engine/leaks.ts';
import { dueCards } from '../lib/training/progress.ts';
import { DAILY_TIERS, dayNumber, liveStreak } from '../puzzles/engine.ts';
import { tierOf } from '../puzzles/ranks.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { useUnits } from '../settings.ts';
import { useStore } from '../store.ts';
import { THEME_META, THEME_ORDER, ThemeChip } from './meta.tsx';
import { Badge, Bar, Btn, Countdown, MCard, RatingPill, Section, StreakPill, Tile, TierChip } from './ui.tsx';

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'Late night session' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Three cards: face down until played, then flipped to a tick or a cross. */
function DailyCards({ results }: { results: boolean[] }) {
  return (
    <div className="flex justify-center gap-4">
      {DAILY_TIERS.map((t, i) => {
        const r = results[i];
        const next = r === undefined && i === results.length;
        return (
          <div key={t.label} className="flex flex-col items-center gap-2">
            <div className={next ? 'm-bob' : ''} style={{ transform: `rotate(${(i - 1) * 5}deg)` }}>
              {r === undefined ? (
                <MCard hidden w={62} style={next ? { boxShadow: 'inset 0 0 0 4px #fff, 0 0 0 3px var(--gold), 0 10px 22px rgba(0,0,0,.4)' } : undefined} />
              ) : (
                <div className="m-flip grid h-[87px] w-[62px] place-items-center rounded-[8px] bg-white" style={{ boxShadow: '0 6px 14px rgba(0,0,0,.35)' }}>
                  <div className="grid h-10 w-10 place-items-center rounded-full" style={{ background: r ? 'var(--go)' : 'var(--bad)', color: r ? 'var(--go-ink)' : '#fff' }}>
                    {r ? <Check size={24} strokeWidth={3.6} /> : <X size={24} strokeWidth={3.6} />}
                  </div>
                </div>
              )}
            </div>
            <span className="f-tiny text-white/75">{t.label}</span>
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
  const score = results.filter(Boolean).length;
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="m-fade px-5 pb-10">
      <div className="m-safe-top" />
      <div className="flex items-center justify-between pt-3">
        <RatingPill rating={profile.rating} />
        <StreakPill n={streak} />
      </div>
      <div className="mt-6">
        <div className="f-tiny t2">{date}</div>
        <h1 className="f-display mt-1">{greeting()}</h1>
      </div>

      <div className="mt-6 flex flex-col gap-7">
        {/* The daily ritual: the one big thing to do today. */}
        <div className="m-felt m-in relative overflow-hidden rounded-[26px] px-5 pt-5 pb-5 text-white" style={{ boxShadow: '0 4px 0 #0a3a23, 0 18px 40px -12px rgba(0,0,0,.6)' }}>
          <div className="flex items-center justify-between">
            <span className="f-tiny text-white/80">Daily Hand · #{day}</span>
            <span className="f-tiny text-white/80">{done ? <>Next in <Countdown /></> : `${3 - results.length} to play`}</span>
          </div>
          <div className="mt-5 mb-5">
            <DailyCards results={results} />
          </div>
          <div className="f-head text-center">{done ? (score === 3 ? 'Perfect day. See you tomorrow.' : `${score} of 3 today. Back tomorrow.`) : results.length ? 'Keep going — finish today’s hands.' : 'Three spots. One shot each.'}</div>
          <div className="f-small mt-1 text-center text-white/70">Same hands for everyone, every day.</div>
          <div className="mt-5">
            {done ? (
              <Btn to="/daily" tone="outline" className="!bg-black/25 !text-white" style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.25), 0 4px 0 rgba(0,0,0,.3)' }}>
                See results
              </Btn>
            ) : (
              <Btn to="/daily" tone="gold" className="uppercase tracking-wide">
                {results.length ? 'Continue' : 'Play'}
              </Btn>
            )}
          </div>
        </div>

        {/* Your rank: rating as a chip, progress to the next one. */}
        <Tile to="/play" className="m-in p-5" style={{ ['--i' as string]: 1 }}>
          <div className="flex items-center gap-4">
            <TierChip rating={profile.rating} size={64} />
            <div className="min-w-0 flex-1">
              <div className="f-tiny t2">Your rank</div>
              <div className="f-title font-extrabold">{tier.name}</div>
              <div className="f-small t2">{tier.blurb}</div>
            </div>
            <div className="text-right">
              <div className="f-display f-num">{profile.rating.toLocaleString()}</div>
              <div className="f-tiny t3">Rating</div>
            </div>
          </div>
          {next && (
            <div className="mt-4">
              <Bar value={progress} color="var(--gold)" h={12} />
              <div className="f-small t2 mt-2 flex justify-between">
                <span>
                  <span className="f-num font-bold" style={{ color: 'var(--text)' }}>{toNext}</span> to {next.name}
                </span>
                <span className="c-gold flex items-center font-bold">
                  Play rated <ChevronRight size={16} strokeWidth={2.8} />
                </span>
              </div>
            </div>
          )}
        </Tile>

        <Section title="Pick a theme">
          <div className="m-hscroll -mx-5 flex gap-3 px-5 pt-1 pb-2">
            {THEME_ORDER.map((t, i) => (
              <Tile key={t} to={`/play?theme=${t}`} className="m-in flex w-[136px] shrink-0 flex-col items-start gap-3 p-4" style={{ ['--i' as string]: i + 2 }}>
                <ThemeChip theme={t} size={46} />
                <div>
                  <div className="f-ui leading-tight font-bold">{THEME_META[t].name}</div>
                  <div className="f-small t2 mt-0.5 font-normal">{THEME_META[t].blurb}</div>
                </div>
              </Tile>
            ))}
          </div>
        </Section>

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
      <Tile to="/game" className="flex items-center gap-4 p-5">
        <div className="flex shrink-0">
          <MCard card={51} w={34} style={{ transform: 'rotate(-8deg)' }} />
          <MCard card={46} w={34} style={{ marginLeft: -12, transform: 'rotate(8deg)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="f-ui font-bold">Train on your own hands</div>
          <div className="f-small t2 font-normal">Play online? Send your hand histories over and drill your real leaks.</div>
        </div>
        <ChevronRight size={20} className="t3 shrink-0" />
      </Tile>
    );
  }
  const due = dueCards(progress).length;
  const top = summary.leaks[0];
  return (
    <Section title="Your game">
      <div className="flex flex-col gap-3">
        {top && (
          <Tile to={`/practice?leak=${top.id}&n=8`} className="p-4">
            <div className="f-tiny c-bad">Leak of the day</div>
            <div className="mt-1 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="f-ui truncate font-bold">{LEAKS[top.id].title}</div>
                <div className="f-small t2 font-normal">{tx(`Costs you ${Math.round(top.per100 * 10) / 10}bb per 100 hands`)}</div>
              </div>
              <ChevronRight size={20} className="t3" />
            </div>
          </Tile>
        )}
        <Tile to="/practice?own=1&n=10" className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="f-ui font-bold">Review your mistakes</div>
            <div className="f-small t2 font-normal">Spots from your own hands, spaced out so they stick</div>
          </div>
          <Badge n={due} />
          <ChevronRight size={20} className="t3" />
        </Tile>
      </div>
    </Section>
  );
}

