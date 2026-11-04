import { Check, ChevronRight, X } from 'lucide-react';
import { LEAKS } from '../lib/engine/leaks.ts';
import { dueCards } from '../lib/training/progress.ts';
import { DAILY_TIERS, dayNumber, liveStreak } from '../puzzles/engine.ts';
import { tierOf } from '../puzzles/ranks.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { useUnits } from '../settings.ts';
import { useStore } from '../store.ts';
import { Badge, Bar, Btn, Chip, Countdown, MCard, StreakPill, Tile, TierChip } from './ui.tsx';

/** The wordmark: a green chip with a spade. */
export function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <Chip color="green" size={30}>
        <span style={{ fontSize: 15 }}>♠</span>
      </Chip>
      <span className="text-[20px] font-extrabold tracking-tight">Leakfinder</span>
    </div>
  );
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
                <MCard hidden w={64} style={next ? { boxShadow: 'inset 0 0 0 4px #fff, 0 0 0 3px rgba(255,255,255,.55), 0 10px 22px rgba(0,0,0,.4)' } : undefined} />
              ) : (
                <div className="m-flip grid h-[90px] w-[64px] place-items-center rounded-[8px] bg-white" style={{ boxShadow: '0 6px 14px rgba(0,0,0,.35)' }}>
                  <div className="grid h-10 w-10 place-items-center rounded-full" style={{ background: r ? 'var(--go)' : 'var(--bad)', color: r ? 'var(--go-ink)' : '#fff' }}>
                    {r ? <Check size={24} strokeWidth={3.6} /> : <X size={24} strokeWidth={3.6} />}
                  </div>
                </div>
              )}
            </div>
            <span className="f-small font-semibold text-white/75">{t.label}</span>
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

  return (
    <div className="m-fade px-5 pb-10">
      <div className="m-safe-top" />
      <div className="flex h-14 items-center justify-between">
        <Wordmark />
        <StreakPill n={streak} />
      </div>

      <div className="mt-3 flex flex-col gap-5">
        {/* The daily ritual: the one big thing to do today. */}
        <div className="m-felt m-in relative overflow-hidden rounded-[28px] px-5 pt-5 pb-5 text-white" style={{ boxShadow: '0 4px 0 #0a3a23, 0 18px 40px -12px rgba(0,0,0,.6)' }}>
          <div className="flex items-center justify-between">
            <span className="f-head">Daily Hand</span>
            <span className="f-ui font-semibold text-white/75">{done ? <>Next in <Countdown /></> : `#${day}`}</span>
          </div>
          <div className="mt-5 mb-5">
            <DailyCards results={results} />
          </div>
          <div className="f-ui text-center text-white/85">{done ? (score === 3 ? 'Perfect day. See you tomorrow.' : `${score} of 3 today. New hands tomorrow.`) : results.length ? 'Finish today’s hands.' : 'Three spots, one shot each. Same hands for everyone.'}</div>
          <div className="mt-5">
            {done ? (
              <Btn to="/daily" tone="outline" className="!bg-black/25 !text-white" style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.25), 0 4px 0 rgba(0,0,0,.3)' }}>
                See today’s result
              </Btn>
            ) : (
              <Btn to="/daily">{results.length ? 'Continue' : 'Play today’s hands'}</Btn>
            )}
          </div>
        </div>

        {/* Your rank: the whole card is the way into rated puzzles. */}
        <Tile to="/play" className="m-in p-5" style={{ ['--i' as string]: 1 }}>
          <div className="flex items-center gap-4">
            <TierChip rating={profile.rating} size={60} />
            <div className="min-w-0 flex-1">
              <div className="f-title font-extrabold">{tier.name}</div>
              <div className="f-ui f-num t2">Rating {profile.rating.toLocaleString()}</div>
            </div>
            <span className="f-ui c-go flex items-center font-bold">
              Play <ChevronRight size={20} strokeWidth={2.8} className="-mr-1" />
            </span>
          </div>
          {next && (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1">
                <Bar value={progress} color="var(--gold)" h={12} />
              </div>
              <Chip color={next.color} size={26}>
                <span style={{ fontSize: next.denom.length > 2 ? 7 : 9 }}>{next.denom}</span>
              </Chip>
            </div>
          )}
          {next && (
            <div className="f-small t2 mt-1.5">
              <span className="f-num font-bold" style={{ color: 'var(--text)' }}>{toNext}</span> points to {next.name}
            </div>
          )}
        </Tile>

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
      <Tile to="/game" className="m-in flex items-center gap-4 p-5" style={{ ['--i' as string]: 2 }}>
        <div className="flex shrink-0">
          <MCard card={51} w={34} style={{ transform: 'rotate(-8deg)' }} />
          <MCard card={46} w={34} style={{ marginLeft: -12, transform: 'rotate(8deg)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="f-ui font-bold">Train on your own hands</div>
          <div className="f-small t2 font-normal">Play online? Bring your hand histories and drill your real leaks.</div>
        </div>
        <ChevronRight size={20} className="t3 shrink-0" />
      </Tile>
    );
  }
  const due = dueCards(progress).length;
  const top = summary.leaks[0];
  return (
    <div className="m-tile-flat m-list overflow-hidden">
      {top && (
        <Tile to={`/practice?leak=${top.id}&n=8`} className="!rounded-none !shadow-none flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="f-small c-bad font-semibold">Your biggest leak</div>
            <div className="f-ui truncate font-bold">{LEAKS[top.id].title}</div>
            <div className="f-small t2 font-normal">{tx(`Costs you ${Math.round(top.per100 * 10) / 10}bb per 100 hands`)}</div>
          </div>
          <ChevronRight size={20} className="t3" />
        </Tile>
      )}
      <Tile to="/practice?own=1&n=10" className="!rounded-none !shadow-none flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="f-ui font-bold">Review your mistakes</div>
          <div className="f-small t2 font-normal">Spots from your own hands, spaced out so they stick</div>
        </div>
        <Badge n={due} />
        <ChevronRight size={20} className="t3" />
      </Tile>
    </div>
  );
}
