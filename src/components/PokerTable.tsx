import { useEffect, useState } from 'react';
import type { Hand } from '../lib/types.ts';
import type { TableState } from '../lib/replay.ts';
import { PlayingCard } from './ui.tsx';

const bbStr = (chips: number, bb: number) => {
  const v = chips / bb;
  return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10}`;
};

function useNarrow(q = '(max-width: 640px)') {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

export default function PokerTable({ hand, state, highlight }: { hand: Hand; state: TableState; highlight?: string }) {
  const narrow = useNarrow();
  // Portrait layout on phones: taller oval, smaller cards.
  const geo = narrow ? { rx: 38, ry: 43, bx: 22, by: 28, aspect: 'aspect-[4/5]', felt: 'inset-[10%_9%]', board: 'xs' as const, hole: 'xs' as const }
    : { rx: 43, ry: 41, bx: 27, by: 25, aspect: 'aspect-[16/10]', felt: 'inset-[9%_7%]', board: 'md' as const, hole: 'sm' as const };
  const seats = [...state.seats].sort((a, b) => a.seat - b.seat);
  const heroIdx = Math.max(0, seats.findIndex((s) => s.isHero));
  const rotated = [...seats.slice(heroIdx), ...seats.slice(0, heroIdx)];
  const n = rotated.length;
  const bb = hand.bb;
  return (
    <div className={`relative mx-auto ${geo.aspect} w-full max-w-[760px] select-none`}>
      <div className={`felt absolute ${geo.felt} rounded-[999px]`} />
      {/* Center: pot + board */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
        <div className="rounded-full bg-black/35 px-3 py-0.5 text-xs font-semibold text-white/90">
          Pot {bbStr(state.totalPot, bb)} bb
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) =>
            state.board[i] !== undefined ? (
              <div key={i} className="pop">
                <PlayingCard card={state.board[i]} size={geo.board} />
              </div>
            ) : (
              <div key={i} className={`${narrow ? 'h-[30px] w-[22px]' : 'h-[58px] w-[42px]'} rounded-[6px] border border-white/10 bg-black/10`} />
            ),
          )}
        </div>
      </div>
      {rotated.map((s, j) => {
        const th = Math.PI / 2 + (j * 2 * Math.PI) / n;
        const x = 50 + geo.rx * Math.cos(th);
        const y = 50 + geo.ry * Math.sin(th);
        const bx = 50 + geo.bx * Math.cos(th);
        const by = 50 + geo.by * Math.sin(th);
        const active = highlight === s.name;
        const showCards = s.cards && !s.folded;
        return (
          <div key={s.name}>
            <div
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${x}%`, top: `${y}%`, opacity: s.folded ? 0.45 : 1 }}
            >
              <div className="mb-[-10px] flex gap-0.5">
                {showCards ? (
                  <>
                    <PlayingCard card={s.cards![0]} size={geo.hole} />
                    <PlayingCard card={s.cards![1]} size={geo.hole} />
                  </>
                ) : !s.folded ? (
                  <>
                    <PlayingCard hidden size={geo.hole} />
                    <PlayingCard hidden size={geo.hole} />
                  </>
                ) : null}
              </div>
              <div
                className={`relative z-10 ${narrow ? 'min-w-[64px] px-1.5 py-0.5' : 'min-w-[92px] px-2.5 py-1'} rounded-xl border text-center shadow-lg ${active ? 'border-accent bg-panel-3' : 'border-line bg-panel'} ${s.isHero ? 'ring-1 ring-accent/50' : ''}`}
              >
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold">
                  <span className="rounded bg-panel-3 px-1 text-[9px] text-mute">{s.position}</span>
                  <span className={`${narrow ? 'max-w-[52px] text-[10px]' : 'max-w-[80px]'} truncate`}>{s.isHero ? 'You' : s.name}</span>
                </div>
                <div className="text-[11px] tabular-nums text-mute">{s.allIn && !state.final ? 'ALL-IN' : `${bbStr(s.stack, bb)} bb`}</div>
              </div>
              {s.lastAction && (
                <div className={`mt-1 rounded-md px-1.5 py-[1px] text-[10px] font-semibold ${s.lastAction.startsWith('Wins') ? 'bg-accent text-black' : s.lastAction === 'Fold' ? 'bg-black/40 text-white/60' : 'bg-white/90 text-black'}`}>
                  {s.lastAction}
                </div>
              )}
            </div>
            {s.bet > 0 && (
              <div className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1" style={{ left: `${bx}%`, top: `${by}%` }}>
                <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-dashed border-white/70 bg-[#d64545]" />
                <span className="rounded bg-black/40 px-1 text-[11px] font-semibold tabular-nums text-white">{bbStr(s.bet, bb)}</span>
              </div>
            )}
            {s.position === 'BTN' && (
              <div
                className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[9px] font-black text-black shadow"
                style={{ left: `${50 + (geo.rx - 10) * Math.cos(th + (narrow ? 0.45 : 0.32))}%`, top: `${50 + (geo.ry - 10) * Math.sin(th + (narrow ? 0.45 : 0.32))}%` }}
              >
                D
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
