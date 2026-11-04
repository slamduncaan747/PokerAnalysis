import { useParams } from 'react-router-dom';
import { CLASS_META } from '../components/ui.tsx';
import { realStakeOf, useUnits } from '../settings.ts';
import { useStore } from '../store.ts';
import { Btn, MCard, PushScreen } from './ui.tsx';

const STREET = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' } as const;

/** A hand from your history, read like a chess game review: each of your decisions with its grade. */
export default function MobileHand() {
  const { id = '' } = useParams();
  const hand = useStore((s) => s.hands.get(id));
  const a = useStore((s) => s.analyses.get(id));
  const { fmt, tx } = useUnits(hand ? realStakeOf(hand) : undefined);
  if (!hand || !a)
    return (
      <PushScreen title="Hand">
        <div className="m-tile-flat f-ui t2 px-4 py-6 text-center">This hand isn’t on this device.</div>
      </PushScreen>
    );
  const decisions = a.decisions.filter((d) => !d.trivial);
  const firstLeak = decisions.find((d) => d.leak);
  return (
    <PushScreen title="Hand review">
      <div className="m-felt m-rail relative overflow-hidden rounded-[24px] px-4 pt-5 pb-7 text-white">
        <div className="flex items-center justify-between">
          <span className="f-tiny text-white/75">{new Date(hand.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {a.heroPosition}</span>
          <span className="f-head f-num" style={{ color: a.netBB >= 0 ? '#7dffb6' : '#ffb3b5' }}>
            {a.netBB >= 0 ? '+' : '−'}
            {fmt(Math.abs(a.netBB))}
          </span>
        </div>
        <div className="mt-4 flex justify-center gap-1.5">
          {hand.board.length ? hand.board.map((c, i) => <MCard key={i} card={c} w={44} />) : <span className="f-small text-white/70">Folded preflop</span>}
        </div>
        <div className="mt-4 flex items-center justify-center gap-4">
          <div className="flex">
            <MCard card={a.heroCards[0]} w={56} style={{ transform: 'rotate(-6deg)' }} />
            <MCard card={a.heroCards[1]} w={56} style={{ marginLeft: -10, transform: 'rotate(6deg)' }} />
          </div>
          <div>
            <div className="f-tiny text-white/70">Mistakes cost</div>
            <div className="f-head f-num">{fmt(a.evLossBB)}</div>
            {a.accuracy !== null && <div className="f-small text-white/70">Accuracy {Math.round(a.accuracy)}</div>}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {decisions.map((d, i) => {
          const m = CLASS_META[d.classification];
          const best = d.options.find((o) => o.key === d.bestKey);
          const mine = d.options.find((o) => o.key === d.heroKey);
          const same = d.bestKey === d.heroKey;
          return (
            <div key={d.actionIndex} className="m-tile-flat m-in p-4" style={{ ['--i' as string]: i }}>
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px] font-extrabold text-white" style={{ background: m.color }}>
                  {m.symbol}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="f-ui font-bold" style={{ color: m.color }}>
                    {m.label}
                  </div>
                  <div className="f-small t2 truncate font-normal">
                    {STREET[d.street]} · {tx(d.spot)}
                  </div>
                </div>
                {d.evLoss > 0.05 && <span className="f-small f-num c-bad font-bold">−{fmt(d.evLoss)}</span>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[12px] bg-black/20 px-3 py-2">
                  <div className="f-tiny t3">You</div>
                  <div className="f-ui font-semibold">{tx(mine?.label ?? d.heroLabel)}</div>
                </div>
                <div className="rounded-[12px] bg-black/20 px-3 py-2">
                  <div className="f-tiny t3">Best</div>
                  <div className="f-ui font-semibold" style={{ color: same ? 'var(--text)' : 'var(--go)' }}>
                    {tx(best?.label ?? d.bestKey)}
                  </div>
                </div>
              </div>
              {d.explanation.length > 0 && <p className="f-small t2 mt-3 font-normal">{tx(d.explanation[0])}</p>}
            </div>
          );
        })}
      </div>
      {firstLeak && <Btn to={`/practice?hand=${encodeURIComponent(id)}&idx=${firstLeak.actionIndex}&n=6`}>Practice this spot</Btn>}
    </PushScreen>
  );
}
