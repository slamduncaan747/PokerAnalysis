import { Flame, GraduationCap, History, Repeat, Sparkles, Target } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { ProgressBar, SectionTitle, StatTile } from '../components/ui.tsx';
import { DRILL_INFO, type DrillType } from '../lib/engine/leaks.ts';
import { dailyActivity, dueCards, mastery, syncCards } from '../lib/training/progress.ts';
import { useOwnMistakesOf } from '../lib/training/queue.ts';
import { useStore } from '../store.ts';

export function useOwnMistakes() {
  const ordered = useStore((s) => s.ordered);
  return useOwnMistakesOf(ordered);
}

const ALL_DRILLS: DrillType[] = ['rfi', 'vs_open', 'bb_defense', 'vs_3bet', 'vs_limp', 'allin', 'pot_odds', 'bluffcatch', 'value', 'bluff', 'draws'];

export default function Train() {
  const progress = useStore((s) => s.progress);
  const setProgress = useStore((s) => s.setProgress);
  const summary = useStore((s) => s.summary);
  const mistakes = useOwnMistakes();
  useEffect(() => {
    const next = syncCards(progress, mistakes);
    if (next !== progress) setProgress(next);
  }, [mistakes]); // eslint-disable-line react-hooks/exhaustive-deps

  const due = dueCards(progress).filter((c) => mistakes.some((m) => m.qid === `own-${c.handId}-${c.actionIndex}`));
  const mastered = Object.values(progress.cards).filter((c) => c.box >= 4).length;
  const last7 = progress.attempts.filter((a) => a.t > Date.now() - 7 * 864e5);
  const acc7 = last7.length ? Math.round((last7.filter((a) => a.correct).length / last7.length) * 100) : null;
  const activity = dailyActivity(progress);
  const recommended = (summary?.leaks ?? []).slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Training</h1>
        <p className="text-sm text-mute">Turn your leaks into strengths. Quizzes use the same engine that reviewed your hands, so every answer comes with the EV math.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Current streak" value={progress.streak} icon={<Flame size={14} />} sub={`best ${progress.bestStreak}`} />
        <StatTile label="Answered" value={progress.attempts.length.toLocaleString()} icon={<Target size={14} />} sub="all time" />
        <StatTile label="7-day accuracy" value={acc7 === null ? '—' : `${acc7}%`} icon={<GraduationCap size={14} />} sub={`${last7.length} questions`} />
        <StatTile label="Mistakes mastered" value={`${mastered}/${mistakes.length}`} icon={<Repeat size={14} />} sub="answered right repeatedly" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel flex flex-col gap-4 p-5">
          <SectionTitle>Review your mistakes</SectionTitle>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent/40 bg-accent/10 p-4">
            <div>
              <div className="flex items-center gap-2 text-lg font-bold">
                <History size={18} /> {due.length} spot{due.length === 1 ? '' : 's'} due
              </div>
              <p className="text-sm text-mute">
                Real decisions from your hands where you lost EV. Get one right and it comes back in a few days; miss it and you'll see it again soon.
              </p>
            </div>
            <Link to="/train/session?own=1" className={`btn btn-primary ${mistakes.length ? '' : 'pointer-events-none opacity-50'}`}>
              Start review
            </Link>
          </div>
          {!mistakes.length && <p className="text-sm text-mute">Import hands to build your personal mistake deck — or practice the drills below.</p>}
          {recommended.length > 0 && (
            <>
              <div className="text-xs font-semibold uppercase tracking-wide text-mute">Recommended for your leaks</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {recommended.map((l) => {
                  const m = mastery(progress, l.info.drill);
                  return (
                    <Link key={l.id} to={`/train/session?leak=${l.id}`} className="rounded-xl border border-line bg-panel-2 p-3 hover:border-accent/50">
                      <div className="text-sm font-semibold">{l.info.title}</div>
                      <div className="mb-2 text-xs text-mute">
                        −{l.lossBB} bb · drill: {DRILL_INFO[l.info.drill].title}
                      </div>
                      <ProgressBar value={m.score} />
                      <div className="mt-1 text-[11px] text-dim">Mastery {m.score}%</div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="panel flex flex-col p-5">
          <SectionTitle>Last 14 days</SectionTitle>
          <div className="relative h-48 flex-1">
            {!activity.some((a) => a.n) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center text-center text-sm text-dim">
                Answer a few questions and your daily practice shows up here.
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="day" stroke="#697386" fontSize={10} tickLine={false} interval={1} />
                <Tooltip cursor={{ fill: '#ffffff08' }} contentStyle={{ background: '#151920', border: '1px solid #272e3a', borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="correct" stackId="a" name="Correct" fill="#3ecf8e" />
                <Bar dataKey="n" stackId="b" name="Answered" fill="#5c8fdb55" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <SectionTitle right={<span className="text-xs text-dim">Unlimited, freshly generated spots</span>}>All drills</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_DRILLS.map((d) => {
            const m = mastery(progress, d);
            return (
              <Link key={d} to={`/train/session?drill=${d}`} className="group flex flex-col gap-2 rounded-xl border border-line bg-panel-2 p-4 hover:border-accent/50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{DRILL_INFO[d].title}</span>
                  <Sparkles size={14} className="text-dim group-hover:text-accent" />
                </div>
                <span className="text-xs text-mute">{DRILL_INFO[d].blurb}</span>
                <ProgressBar value={m.score} />
                <span className="text-[11px] text-dim">
                  Mastery {m.score}% · {m.attempts} answered
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
