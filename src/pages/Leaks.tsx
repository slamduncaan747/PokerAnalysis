import { AlertTriangle, ArrowRight, GraduationCap } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CardText, ClassBadge, ProgressBar, SectionTitle } from '../components/ui.tsx';
import { DRILL_INFO } from '../lib/engine/leaks.ts';
import { useStore } from '../store.ts';

export default function Leaks() {
  const summary = useStore((s) => s.summary);
  const analyses = useStore((s) => s.analyses);
  const location = useLocation();
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, summary]);
  if (!summary)
    return (
      <div className="text-mute">
        No hands yet. <Link to="/import" className="text-accent">Import hands →</Link>
      </div>
    );
  const maxLoss = Math.max(1, ...summary.leaks.map((l) => l.lossBB));
  const statIssues = summary.stats.filter((s) => s.status === 'low' || s.status === 'high');
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Leaks</h1>
        <p className="text-sm text-mute">
          Every mistake the engine found, grouped by type and ranked by how many big blinds it costs you. Fix the top of this list first.
        </p>
      </div>

      {statIssues.length > 0 && (
        <div className="panel p-5">
          <SectionTitle>Stat warnings</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {statIssues.map((s) => (
              <div key={s.key} className="flex gap-3 rounded-xl border border-line bg-panel-2 p-3 text-sm">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-mistake" />
                <div>
                  <div className="font-semibold">
                    {s.label}: {s.unit === '%' ? `${Math.round((s.value ?? 0) * 100)}%` : (s.value ?? 0).toFixed(1)}{' '}
                    <span className="font-normal text-mute">
                      (typical {s.unit === '%' ? `${Math.round(s.lo * 100)}–${Math.round(s.hi * 100)}%` : `${s.lo}–${s.hi}`})
                    </span>
                  </div>
                  <div className="text-mute">{s.status === 'low' ? s.tipLow : s.tipHigh}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.leaks.length === 0 && <div className="panel p-6 text-mute">No leaks detected yet — import more hands.</div>}

      {summary.leaks.map((l, i) => (
        <div key={l.id} id={l.id} className="panel scroll-mt-20 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-loss/15 text-sm font-bold text-loss">{i + 1}</span>
              <div>
                <h2 className="text-lg font-bold">{l.info.title}</h2>
                <div className="text-sm text-mute">
                  {l.info.group} · {l.count} mistake{l.count === 1 ? '' : 's'} · <span className="text-loss">−{l.lossBB} bb</span> · {l.per100} bb/100
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to={`/hands?leak=${l.id}&sort=loss`} className="btn btn-ghost">
                See hands
              </Link>
              <Link to={`/train/session?leak=${l.id}`} className="btn btn-primary">
                <GraduationCap size={16} /> Train: {DRILL_INFO[l.info.drill].title}
              </Link>
            </div>
          </div>
          <ProgressBar className="mt-4" value={(l.lossBB / maxLoss) * 100} color="var(--color-loss)" />
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div>
              <p className="text-sm text-ink/90">{l.info.description}</p>
              <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-mute">How to fix it</div>
              <ul className="mt-1.5 flex flex-col gap-1.5 text-sm text-ink/90">
                {l.info.fix.map((f, k) => (
                  <li key={k} className="flex gap-2">
                    <ArrowRight size={14} className="mt-1 shrink-0 text-accent" /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-mute">Costliest examples</div>
              <div className="mt-1.5 flex flex-col divide-y divide-line/60">
                {l.examples.slice(0, 5).map((ex) => {
                  const a = analyses.get(ex.handId);
                  const d = a?.decisions.find((x) => x.actionIndex === ex.actionIndex);
                  if (!a || !d) return null;
                  return (
                    <Link key={`${ex.handId}-${ex.actionIndex}`} to={`/hand/${encodeURIComponent(ex.handId)}?leak=${l.id}&sort=loss`} className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-panel-2">
                      <ClassBadge c={d.classification} size={18} />
                      <CardText cards={a.heroCards} />
                      <span className="min-w-0 flex-1 truncate text-mute">
                        {d.street} · {d.heroLabel} · {d.handLabel}
                      </span>
                      <span className="tabular-nums text-loss">−{ex.loss}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
