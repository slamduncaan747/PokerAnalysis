import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CardText, CLASS_META, ClassBadge } from '../components/ui.tsx';
import { isError, type HandAnalysis } from '../lib/engine/types.ts';
import { useStore } from '../store.ts';

const PAGE = 50;
const POS_ORDER = ['UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

export function useFilteredHands() {
  const ordered = useStore((s) => s.ordered);
  const [params] = useSearchParams();
  const pos = params.get('pos') ?? '';
  const res = params.get('res') ?? '';
  const cls = params.get('cls') ?? '';
  const sort = params.get('sort') ?? 'date';
  const street = params.get('street') ?? '';
  const leak = params.get('leak') ?? '';
  return useMemo(() => {
    let xs: HandAnalysis[] = ordered;
    if (pos) xs = xs.filter((a) => a.heroPosition === pos);
    if (res === 'won') xs = xs.filter((a) => a.netBB > 0);
    if (res === 'lost') xs = xs.filter((a) => a.netBB < 0);
    if (res === 'played') xs = xs.filter((a) => a.stats.vpip || a.decisions.some((d) => d.street !== 'preflop'));
    if (res === 'showdown') xs = xs.filter((a) => a.wentToShowdown);
    if (cls === 'errors') xs = xs.filter((a) => a.decisions.some((d) => isError(d.classification)));
    else if (cls) xs = xs.filter((a) => a.decisions.some((d) => d.classification === cls));
    if (street) xs = xs.filter((a) => a.decisions.some((d) => d.street === street && !d.trivial));
    if (leak) xs = xs.filter((a) => a.decisions.some((d) => d.leak === leak));
    if (sort === 'loss') xs = [...xs].sort((a, b) => b.evLossBB - a.evLossBB);
    else if (sort === 'pot') xs = [...xs].sort((a, b) => Math.abs(b.netBB) - Math.abs(a.netBB));
    else if (sort === 'won') xs = [...xs].sort((a, b) => b.netBB - a.netBB);
    else if (sort === 'lost') xs = [...xs].sort((a, b) => a.netBB - b.netBB);
    else xs = [...xs].reverse();
    return xs;
  }, [ordered, pos, res, cls, sort, street, leak]);
}

function Select({ label, k, options }: { label: string; k: string; options: [string, string][] }) {
  const [params, setParams] = useSearchParams();
  return (
    <label className="flex flex-col gap-1 text-xs text-mute">
      {label}
      <select
        value={params.get(k) ?? ''}
        onChange={(e) => {
          const p = new URLSearchParams(params);
          if (e.target.value) p.set(k, e.target.value);
          else p.delete(k);
          p.delete('page');
          setParams(p);
        }}
        className="rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Hands() {
  const hands = useStore((s) => s.hands);
  const ordered = useStore((s) => s.ordered);
  const xs = useFilteredHands();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(xs.length / PAGE));
  const cur = Math.min(page, pageCount - 1);
  const rows = xs.slice(cur * PAGE, cur * PAGE + PAGE);
  const query = params.toString();
  const positions = useMemo(() => POS_ORDER.filter((p) => ordered.some((a) => a.heroPosition === p)), [ordered]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hands</h1>
          <p className="text-sm text-mute">{xs.length.toLocaleString()} hands match</p>
        </div>
        {params.toString() && (
          <button className="text-xs text-accent hover:underline" onClick={() => setParams(new URLSearchParams())}>
            Clear filters
          </button>
        )}
      </div>
      <div className="panel grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-6">
        <Select label="Sort" k="sort" options={[['date', 'Newest first'], ['loss', 'Biggest mistakes'], ['pot', 'Biggest pots'], ['won', 'Biggest wins'], ['lost', 'Biggest losses']]} />
        <Select label="Position" k="pos" options={[['', 'All'], ...positions.map((p) => [p, p] as [string, string])]} />
        <Select label="Result" k="res" options={[['', 'All hands'], ['played', 'Played (VPIP / saw flop)'], ['won', 'Won'], ['lost', 'Lost'], ['showdown', 'Went to showdown']]} />
        <Select
          label="Contains"
          k="cls"
          options={[['', 'Anything'], ['errors', 'Any error'], ...(['blunder', 'mistake', 'miss', 'inaccuracy', 'brilliant', 'great'] as const).map((c) => [c, CLASS_META[c].label] as [string, string])]}
        />
        <Select label="Street" k="street" options={[['', 'Any'], ['preflop', 'Preflop'], ['flop', 'Flop'], ['turn', 'Turn'], ['river', 'River']]} />
      </div>
      <div className="panel overflow-x-auto scroll-thin">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-dim">
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-2 py-2.5 font-medium">Pos</th>
              <th className="px-2 py-2.5 font-medium">Hand</th>
              <th className="px-2 py-2.5 font-medium">Board</th>
              <th className="px-2 py-2.5 font-medium">Review</th>
              <th className="px-2 py-2.5 text-right font-medium">Accuracy</th>
              <th className="px-2 py-2.5 text-right font-medium">EV lost</th>
              <th className="px-4 py-2.5 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const h = hands.get(a.handId);
              const shown = a.decisions.filter((d) => !d.trivial);
              return (
                <tr key={a.handId} className="border-b border-line/50 hover:bg-panel-2/70">
                  <td className="px-4 py-2 text-xs text-mute whitespace-nowrap">
                    <Link to={`/hand/${encodeURIComponent(a.handId)}?${query}`} className="hover:text-ink">
                      {a.date ? a.date.replace('T', ' ').slice(0, 16) : a.handId}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-xs font-semibold text-mute">{a.heroPosition}</td>
                  <td className="px-2 py-2">
                    <Link to={`/hand/${encodeURIComponent(a.handId)}?${query}`}>
                      <CardText cards={a.heroCards} />
                    </Link>
                  </td>
                  <td className="px-2 py-2">{h && h.board.length ? <CardText cards={h.board} /> : <span className="text-dim">—</span>}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      {shown.slice(0, 7).map((d, i) => (
                        <ClassBadge key={i} c={d.classification} size={16} />
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-mute">{a.accuracy === null ? '—' : a.accuracy.toFixed(0)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${a.evLossBB > 0.05 ? 'text-loss' : 'text-dim'}`}>{a.evLossBB > 0.05 ? `−${a.evLossBB}` : '0'}</td>
                  <td className={`px-4 py-2 text-right font-semibold tabular-nums ${a.netBB > 0 ? 'text-win' : a.netBB < 0 ? 'text-loss' : 'text-dim'}`}>
                    {a.netBB > 0 ? '+' : ''}
                    {a.netBB}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <div className="p-8 text-center text-mute">No hands. <Link to="/import" className="text-accent">Import some →</Link></div>}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className="btn btn-ghost !p-2" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
            <ChevronLeft size={16} />
          </button>
          <span className="text-mute">
            Page {cur + 1} / {pageCount}
          </span>
          <button className="btn btn-ghost !p-2" disabled={cur >= pageCount - 1} onClick={() => setPage(cur + 1)}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
