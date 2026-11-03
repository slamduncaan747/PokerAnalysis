import { ArrowRight, Brain, Crosshair, GraduationCap, LineChart as LineIcon, Sparkles, Target, TrendingUp, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AccuracyRing, CardText, CLASS_META, ClassBadge, fmtBB, Pill, ProgressBar, SectionTitle, StatTile } from '../components/ui.tsx';
import { DRILL_INFO } from '../lib/engine/leaks.ts';
import type { StatLine } from '../lib/engine/summary.ts';
import type { Classification } from '../lib/engine/types.ts';
import { useStore } from '../store.ts';
import { DropZone, ImportResult } from './Import.tsx';

const REVIEW_ORDER: Classification[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'miss', 'mistake', 'blunder'];

function Landing() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <section className="grid items-center gap-8 pt-4 md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-5">
          <span className="self-start">
            <Pill tone="good">Free · private · runs in your browser</Pill>
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Game review for your <span className="text-accent">poker hands</span>.
          </h1>
          <p className="text-lg text-mute">
            Upload your hand histories and get a move-by-move review like a chess engine: every decision graded from <b className="text-best">Best</b> to{' '}
            <b className="text-blunder">Blunder</b>, your biggest leaks ranked by how much they cost, and drills built from your own mistakes.
          </p>
          <div className="flex flex-wrap gap-2 text-sm text-mute">
            {(['brilliant', 'great', 'best', 'excellent', 'book', 'inaccuracy', 'mistake', 'blunder'] as Classification[]).map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-panel px-2.5 py-1">
                <ClassBadge c={c} size={16} /> {CLASS_META[c].label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <DropZone />
          <ImportResult />
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: Brain, title: 'Engine review', text: 'Preflop decisions are checked against solver-style range charts. Postflop, Monte-Carlo equity vs. modeled ranges estimates the EV of every option.' },
          { icon: Crosshair, title: 'Leak finder', text: 'Mistakes are grouped into leaks — calling too light, missing value, over-folding the big blind — and ranked by bb lost per 100 hands.' },
          { icon: GraduationCap, title: 'Train what you miss', text: 'Spaced-repetition quizzes built from your own mistakes, plus unlimited drills for each leak until you get it right.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="panel p-5">
            <Icon className="mb-3 text-accent" />
            <div className="mb-1 font-semibold">{title}</div>
            <p className="text-sm text-mute">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function StatGauge({ s }: { s: StatLine }) {
  const isPct = s.unit === '%';
  const max = isPct ? Math.max(1, s.hi * 1.8, (s.value ?? 0) * 1.15) : Math.max(6, s.hi * 1.6, (s.value ?? 0) * 1.15);
  const pos = (x: number) => `${Math.max(0, Math.min(100, (x / max) * 100))}%`;
  const fmt = (x: number | null) => (x === null ? '—' : isPct ? `${Math.round(x * 100)}%` : x.toFixed(1));
  const color = s.status === 'ok' ? 'var(--color-accent)' : s.status === 'na' ? 'var(--color-dim)' : 'var(--color-mistake)';
  const tip = s.status === 'low' ? s.tipLow : s.status === 'high' ? s.tipHigh : '';
  return (
    <div className="flex flex-col gap-1.5 py-2" title={tip}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-mute">{s.label}</span>
        <span className="font-semibold tabular-nums" style={{ color }}>
          {fmt(s.value)}
          <span className="ml-1 text-[10px] font-normal text-dim">n={s.n}</span>
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-panel-3">
        <div className="absolute h-full rounded-full bg-accent/25" style={{ left: pos(s.lo), width: `calc(${pos(s.hi)} - ${pos(s.lo)})` }} />
        {s.value !== null && <div className="absolute -top-[3px] h-3 w-1 rounded-full" style={{ left: pos(s.value), background: color }} />}
      </div>
      {tip && <div className="text-[11px] leading-snug text-mistake/90">{tip}</div>}
    </div>
  );
}

export default function Dashboard() {
  const ready = useStore((s) => s.ready);
  const summary = useStore((s) => s.summary);
  if (!ready) return <div className="text-mute">Loading…</div>;
  if (!summary) return <Landing />;
  const s = summary;
  const topLeaks = s.leaks.slice(0, 5);
  const maxLeak = Math.max(1, ...topLeaks.map((l) => l.lossBB));
  const statIssues = s.stats.filter((x) => x.status === 'low' || x.status === 'high');
  const totalReviewed = REVIEW_ORDER.reduce((a, c) => a + s.classCounts[c], 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Your game review</h1>
          <p className="text-sm text-mute">
            {s.hands.toLocaleString()} hands · {s.decisionsReviewed.toLocaleString()} meaningful decisions reviewed
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/import" className="btn btn-ghost">
            Import more
          </Link>
          <Link to="/train" className="btn btn-primary">
            <GraduationCap size={16} /> Start training
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Hands" value={s.hands.toLocaleString()} icon={<Target size={14} />} sub={`${s.sessions.length} session${s.sessions.length === 1 ? '' : 's'}`} />
        <StatTile label="Win rate" value={`${s.bb100 > 0 ? '+' : ''}${s.bb100} bb/100`} tone={s.bb100 >= 0 ? 'win' : 'loss'} icon={<TrendingUp size={14} />} sub={`${fmtBB(s.netBB, true)} total`} />
        <StatTile label="All-in EV" value={`${s.evBb100 > 0 ? '+' : ''}${s.evBb100} bb/100`} tone={s.evBb100 >= 0 ? 'win' : 'loss'} icon={<LineIcon size={14} />} sub={`luck: ${fmtBB(s.netBB - s.evNetBB, true)}`} />
        <StatTile label="EV lost to mistakes" value={`${s.evLossPer100} bb/100`} tone="loss" icon={<Crosshair size={14} />} sub={`${fmtBB(s.evLossBB)} total`} />
        <StatTile label="Accuracy" value={s.accuracy === null ? '—' : `${s.accuracy}%`} icon={<Trophy size={14} />} sub="EV-weighted, like a chess engine" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="panel flex flex-col gap-4 p-5">
          <SectionTitle>Game review</SectionTitle>
          <div className="flex justify-center">
            <AccuracyRing value={s.accuracy} size={140} />
          </div>
          <div className="flex flex-col gap-1.5">
            {REVIEW_ORDER.map((c) => (
              <div key={c} className="flex items-center gap-3 text-sm">
                <ClassBadge c={c} size={20} />
                <span className="flex-1" style={{ color: CLASS_META[c].color }}>
                  {CLASS_META[c].label}
                </span>
                <span className="w-10 text-right font-semibold tabular-nums">{s.classCounts[c]}</span>
                <div className="w-16">
                  <ProgressBar value={totalReviewed ? (s.classCounts[c] / totalReviewed) * 100 * 2.5 : 0} color={CLASS_META[c].color} />
                </div>
              </div>
            ))}
          </div>
          <Link to="/hands?sort=loss" className="btn btn-ghost mt-1">
            Review your worst hands <ArrowRight size={16} />
          </Link>
        </div>

        <div className="panel flex min-w-0 flex-col p-5">
          <SectionTitle
            right={
              <div className="flex gap-3 text-[11px] text-mute">
                <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-3 bg-accent" /> Net</span>
                <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-3 bg-[#f3c23a]" /> All-in EV</span>
                <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-3 bg-[#5c8fdb]" /> Showdown</span>
                <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-3 bg-[#f05d5d]" /> Non-showdown</span>
              </div>
            }
          >
            Results (bb)
          </SectionTitle>
          <div className="h-72 min-h-[18rem]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={s.graph} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#272e3a" vertical={false} />
                <XAxis dataKey="i" stroke="#697386" fontSize={11} tickLine={false} />
                <YAxis stroke="#697386" fontSize={11} tickLine={false} />
                <ReferenceLine y={0} stroke="#3a4250" />
                <Tooltip contentStyle={{ background: '#151920', border: '1px solid #272e3a', borderRadius: 10, fontSize: 12 }} labelFormatter={(l) => `Hand ${l}`} />
                <Line type="monotone" dataKey="net" name="Net" stroke="#3ecf8e" strokeWidth={2.2} dot={false} />
                <Line type="monotone" dataKey="ev" name="All-in EV" stroke="#f3c23a" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="sd" name="Showdown" stroke="#5c8fdb" strokeWidth={1.2} dot={false} />
                <Line type="monotone" dataKey="nsd" name="Non-showdown" stroke="#f05d5d" strokeWidth={1.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel p-5">
          <SectionTitle right={<Link to="/leaks" className="text-xs text-accent hover:underline">All leaks →</Link>}>Biggest leaks</SectionTitle>
          {topLeaks.length === 0 && <p className="text-sm text-mute">No significant leaks found yet. Import more hands for a fuller picture.</p>}
          <div className="flex flex-col gap-3">
            {topLeaks.map((l, i) => (
              <div key={l.id} className="rounded-xl border border-line bg-panel-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-panel-3 text-xs font-bold text-mute">{i + 1}</span>
                    <div>
                      <div className="font-semibold">{l.info.title}</div>
                      <div className="text-xs text-mute">
                        {l.info.group} · {l.count} spot{l.count === 1 ? '' : 's'} · <span className="text-loss">−{l.lossBB} bb</span> ({l.per100} bb/100)
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/leaks#${l.id}`} className="btn btn-ghost !px-3 !py-1.5 text-xs">
                      Details
                    </Link>
                    <Link to={`/train/session?leak=${l.id}`} className="btn btn-primary !px-3 !py-1.5 text-xs">
                      Train
                    </Link>
                  </div>
                </div>
                <ProgressBar className="mt-3" value={(l.lossBB / maxLeak) * 100} color="var(--color-loss)" />
                <p className="mt-2 text-xs text-mute">{l.info.fix[0]}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="panel p-5">
            <SectionTitle>Stats vs. winning range</SectionTitle>
            <div className="flex flex-col divide-y divide-line/60">
              {s.stats.map((x) => (
                <StatGauge key={x.key} s={x} />
              ))}
            </div>
            {statIssues.length > 0 && <p className="mt-2 text-[11px] text-dim">Green band = typical range for winning 6-max regulars.</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <SectionTitle>Win rate by position (bb/100)</SectionTitle>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.positions} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid stroke="#272e3a" vertical={false} />
                <XAxis dataKey="pos" stroke="#697386" fontSize={11} tickLine={false} />
                <YAxis stroke="#697386" fontSize={11} tickLine={false} />
                <ReferenceLine y={0} stroke="#3a4250" />
                <Tooltip
                  cursor={{ fill: '#ffffff08' }}
                  contentStyle={{ background: '#151920', border: '1px solid #272e3a', borderRadius: 10, fontSize: 12 }}
                  formatter={(v, _n, p) => [`${v} bb/100 (${(p.payload as { hands: number }).hands} hands)`, 'Win rate']}
                />
                <Bar dataKey="bb100" radius={[4, 4, 0, 0]}>
                  {s.positions.map((p) => (
                    <Cell key={p.pos} fill={p.bb100 >= 0 ? '#3ecf8e' : '#f05d5d'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel p-5">
          <SectionTitle>By street</SectionTitle>
          <div className="flex flex-col gap-4">
            {s.streets.map((x) => {
              const maxLoss = Math.max(1, ...s.streets.map((y) => y.lossBB));
              return (
                <Link key={x.street} to={`/hands?street=${x.street}&sort=loss`} className="group grid grid-cols-[70px_1fr_1fr] items-center gap-3 text-sm">
                  <span className="font-semibold capitalize group-hover:text-accent">{x.street}</span>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-mute">
                      <span>Accuracy</span>
                      <span className="tabular-nums text-ink">{x.accuracy === null ? '—' : `${x.accuracy}%`}</span>
                    </div>
                    <ProgressBar value={x.accuracy ?? 0} color="var(--color-great)" />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-mute">
                      <span>EV lost · {x.decisions} spots</span>
                      <span className="tabular-nums text-loss">−{x.lossBB} bb</span>
                    </div>
                    <ProgressBar value={(x.lossBB / maxLoss) * 100} color="var(--color-loss)" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel p-5">
          <SectionTitle right={<Link to="/hands?sort=loss" className="text-xs text-accent hover:underline">All hands →</Link>}>Costliest hands</SectionTitle>
          <WorstHands />
        </div>
        <div className="panel flex flex-col gap-3 p-5">
          <SectionTitle>Your training plan</SectionTitle>
          {s.leaks.slice(0, 3).map((l) => (
            <Link key={l.id} to={`/train/session?leak=${l.id}`} className="flex items-center justify-between rounded-xl border border-line bg-panel-2 px-4 py-3 hover:border-accent/50">
              <div>
                <div className="text-sm font-semibold">{DRILL_INFO[l.info.drill].title}</div>
                <div className="text-xs text-mute">Fixes: {l.info.title.toLowerCase()}</div>
              </div>
              <ArrowRight size={16} className="text-accent" />
            </Link>
          ))}
          <Link to="/train/session?own=1" className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles size={14} /> Replay your mistakes
              </div>
              <div className="text-xs text-mute">Spaced-repetition quiz from your own hands</div>
            </div>
            <ArrowRight size={16} className="text-accent" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function WorstHands() {
  const summary = useStore((s) => s.summary)!;
  const analyses = useStore((s) => s.analyses);
  return (
    <div className="flex flex-col divide-y divide-line/60">
      {summary.worstHands.slice(0, 8).map((w) => {
        const a = analyses.get(w.handId);
        if (!a) return null;
        const worstD = [...a.decisions].sort((x, y) => y.evLoss - x.evLoss)[0];
        return (
          <Link key={w.handId} to={`/hand/${encodeURIComponent(w.handId)}`} className="flex items-center gap-3 py-2.5 hover:bg-panel-2/60 -mx-2 px-2 rounded-lg">
            {a.worst && <ClassBadge c={a.worst} size={22} />}
            <CardText cards={a.heroCards} />
            <span className="w-10 text-xs text-mute">{a.heroPosition}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-mute">
              {worstD ? `${worstD.street}: ${worstD.heroLabel} — ${worstD.handLabel}` : ''}
            </span>
            <span className="text-sm font-semibold tabular-nums text-loss">−{w.loss} bb</span>
          </Link>
        );
      })}
    </div>
  );
}
