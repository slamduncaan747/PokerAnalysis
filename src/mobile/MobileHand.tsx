import { useParams } from 'react-router-dom';
import { CLASS_META } from '../components/ui.tsx';
import { realStakeOf, useUnits } from '../settings.ts';
import { useStore } from '../store.ts';
import { Button, MCard, MiniCards, Screen } from './ui.tsx';

const STREET = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' } as const;

/** A hand from your history, read like a chess game review: each of your decisions with its grade. */
export default function MobileHand() {
  const { id = '' } = useParams();
  const hand = useStore((s) => s.hands.get(id));
  const a = useStore((s) => s.analyses.get(id));
  const { fmt, tx } = useUnits(hand ? realStakeOf(hand) : undefined);
  if (!hand || !a)
    return (
      <Screen title="Hand" back>
        <div className="m-group t-sub c-2 px-4 py-6 text-center">This hand isn’t on this device.</div>
      </Screen>
    );
  const decisions = a.decisions.filter((d) => !d.trivial);
  const firstLeak = decisions.find((d) => d.leak);
  const date = new Date(hand.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <Screen title="Hand Review" eyebrow={date} back>
      <div className="m-card m-in flex items-center gap-4 p-4">
        <div className="flex">
          <MCard card={a.heroCards[0]} w={48} style={{ transform: 'rotate(-4deg)' }} />
          <MCard card={a.heroCards[1]} w={48} style={{ marginLeft: -8, transform: 'rotate(4deg)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="t-headline">
            {a.heroPosition} ·{' '}
            <span style={{ color: a.netBB >= 0 ? 'var(--green-text)' : 'var(--red-text)' }}>
              {a.netBB >= 0 ? '+' : '−'}
              {fmt(Math.abs(a.netBB))}
            </span>
          </div>
          <div className="mt-1.5">{hand.board.length ? <MiniCards cards={hand.board} w={24} /> : <span className="t-foot c-2">No flop</span>}</div>
          <div className="t-foot c-2 mt-1.5">
            Mistakes cost {fmt(a.evLossBB)}
            {a.accuracy !== null && ` · Accuracy ${Math.round(a.accuracy)}`}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {decisions.map((d) => {
          const m = CLASS_META[d.classification];
          const best = d.options.find((o) => o.key === d.bestKey);
          const mine = d.options.find((o) => o.key === d.heroKey);
          const same = d.bestKey === d.heroKey;
          return (
            <div key={d.actionIndex} className="m-group">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white" style={{ background: m.color }}>
                  {m.symbol}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="t-headline">{m.label}</div>
                  <div className="t-foot c-2 truncate">
                    {STREET[d.street]} · {tx(d.spot)}
                  </div>
                </div>
                {d.evLoss > 0.05 && <span className="t-sub t-num c-red">−{fmt(d.evLoss)}</span>}
              </div>
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <span className="t-body c-2">You</span>
                <span className="t-body text-right">{tx(mine?.label ?? d.heroLabel)}</span>
              </div>
              {!same && (
                <div className="flex justify-between gap-4 px-4 py-2.5">
                  <span className="t-body c-2">Best</span>
                  <span className="t-body c-green text-right">{tx(best?.label ?? d.bestKey)}</span>
                </div>
              )}
              {d.explanation.length > 0 && <p className="t-sub c-2 px-4 py-3">{tx(d.explanation[0])}</p>}
            </div>
          );
        })}
      </div>
      {firstLeak && <Button to={`/practice?hand=${encodeURIComponent(id)}&idx=${firstLeak.actionIndex}&n=6`}>Practice This Spot</Button>}
    </Screen>
  );
}
