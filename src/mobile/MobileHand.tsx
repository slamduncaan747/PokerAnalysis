import { Target } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { CLASS_META } from '../components/ui.tsx';
import { useUnits } from '../settings.ts';
import { useStore } from '../store.ts';
import { MCard, MiniCards, PrimaryButton, Screen } from './ui.tsx';

const STREET = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' } as const;

/** A hand from your history, read like a chess game review: each of your decisions with its grade. */
export default function MobileHand() {
  const { id = '' } = useParams();
  const hand = useStore((s) => s.hands.get(id));
  const a = useStore((s) => s.analyses.get(id));
  const real = hand ? { bb: hand.bb, currency: hand.currency, tournament: hand.gameType === 'tournament' } : undefined;
  const { fmt, tx } = useUnits(real);
  if (!hand || !a) return <Screen title="Hand" back>{<div className="m-card p-6 text-center text-[var(--mute)]">This hand isn’t on this device.</div>}</Screen>;
  const decisions = a.decisions.filter((d) => !d.trivial);
  const firstLeak = decisions.find((d) => d.leak);
  return (
    <Screen title={`${a.heroPosition} · ${a.netBB >= 0 ? '+' : '−'}${fmt(Math.abs(a.netBB))}`} eyebrow={new Date(hand.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} back>
      <div className="m-card m-in flex items-center gap-4 p-4">
        <div className="flex">
          <MCard card={a.heroCards[0]} w={52} style={{ transform: 'rotate(-5deg)' }} />
          <MCard card={a.heroCards[1]} w={52} style={{ marginLeft: -10, transform: 'rotate(5deg)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-[var(--mute)]">Board</div>
          {hand.board.length ? <MiniCards cards={hand.board} w={26} /> : <div className="text-[14px] text-[var(--dim)]">No flop</div>}
          <div className="mt-1.5 text-[13px] text-[var(--mute)]">
            Mistakes cost <b className="text-[var(--text)]">{fmt(a.evLossBB)}</b>
            {a.accuracy !== null && <> · accuracy <b className="text-[var(--text)]">{Math.round(a.accuracy)}</b></>}
          </div>
        </div>
      </div>
      {decisions.map((d, i) => {
        const m = CLASS_META[d.classification];
        const best = d.options.find((o) => o.key === d.bestKey);
        const mine = d.options.find((o) => o.key === d.heroKey);
        return (
          <div key={d.actionIndex} className="m-card m-in p-4" style={{ ['--i' as string]: i + 1 }}>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px] font-black text-white" style={{ background: m.color }}>
                {m.symbol}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold" style={{ color: m.color }}>
                  {m.label}
                </div>
                <div className="truncate text-[12.5px] text-[var(--dim)]">
                  {STREET[d.street]} · {tx(d.spot)}
                </div>
              </div>
              {d.evLoss > 0.05 && <span className="m-num text-[13px] font-semibold text-[var(--signal)]">−{fmt(d.evLoss)}</span>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[14px]">
              <div className="m-card-2 px-3 py-2">
                <div className="m-label !text-[9.5px]">You</div>
                <div className="font-semibold">{tx(mine?.label ?? d.heroLabel)}</div>
              </div>
              <div className="m-card-2 px-3 py-2">
                <div className="m-label !text-[9.5px]">Best</div>
                <div className="font-semibold text-[var(--win)]">{tx(best?.label ?? d.bestKey)}</div>
              </div>
            </div>
            {d.explanation.length > 0 && <p className="mt-2.5 text-[14px] leading-snug text-[var(--mute)]">{tx(d.explanation[0])}</p>}
          </div>
        );
      })}
      {firstLeak && (
        <PrimaryButton to={`/practice?hand=${encodeURIComponent(id)}&idx=${firstLeak.actionIndex}&n=6`}>
          <Target size={18} /> Practice this spot
        </PrimaryButton>
      )}
    </Screen>
  );
}
