import { Check, ChevronDown, ChevronUp, Lightbulb, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { haptic, sound } from '../feedback.ts';
import { useUnits } from '../settings.ts';
import type { Outcome, SpotView, ViewOption } from './spot.ts';
import { Confetti, CountUp, MCard, PrimaryButton } from './ui.tsx';

function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 390 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return Math.min(w, 520);
}

const STREET_LABEL: Record<string, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' };

/** The felt: villain on top, board and pot in the middle, your cards big at the bottom. */
export function Table({ v, shake, celebrate }: { v: SpotView; shake?: boolean; celebrate?: boolean }) {
  const { fmt } = useUnits(v.real);
  const vw = useViewportWidth();
  const boardW = Math.max(40, Math.min(58, Math.floor((vw - 32 - 28 - 4 * 6) / 5)));
  const heroW = Math.min(80, Math.round(boardW * 1.36));
  if (v.kind === 'math') {
    return (
      <div className={`m-felt relative flex flex-col items-center justify-center gap-3 rounded-[36px] px-5 py-10 text-white ${shake ? 'm-shake' : ''}`}>
        {celebrate && <Confetti />}
        <div className="m-label text-white/70">Pot</div>
        <div className="m-num text-[44px] font-extrabold tracking-tight">{fmt(v.centerPotBB)}</div>
        <div className="m-pop rounded-full bg-[#f3c23a] px-4 py-1.5 text-[16px] font-bold text-[#1d1403]">Villain bets {fmt(v.toCallBB)}</div>
      </div>
    );
  }
  const slots = [0, 1, 2, 3, 4];
  return (
    <div className="relative">
      <div className={`m-felt relative rounded-[40px] px-3.5 pt-4 text-white ${shake ? 'm-shake' : ''}`} style={{ paddingBottom: Math.round(heroW * 0.95) }}>
        {celebrate && <Confetti />}
        <div className="flex flex-col items-center gap-1.5">
          {v.villainPos ? (
            <>
              <div className="flex">
                <MCard hidden w={24} style={{ transform: 'rotate(-7deg)' }} />
                <MCard hidden w={24} style={{ marginLeft: -12, transform: 'rotate(7deg)' }} />
              </div>
              <div className="m-chip px-3 py-0.5 text-[13px] font-bold tracking-wide">{v.villainPos}</div>
              {v.villainAction ? (
                <div className={`m-pop rounded-full px-3 py-0.5 text-[13px] font-bold ${/^check/i.test(v.villainAction) ? 'bg-white/90 text-[#0b0d11]' : 'bg-[#f3c23a] text-[#1d1403]'}`}>{v.villainAction}</div>
              ) : (
                <div className="h-[22px]" />
              )}
            </>
          ) : (
            <div className="m-chip px-3 py-1 text-[12px] font-semibold text-white/80">{STREET_LABEL[v.street]}</div>
          )}
        </div>
        <div className="mt-3 flex justify-center gap-1.5">
          {slots.map((i) =>
            v.board[i] !== undefined ? (
              <MCard key={`${v.id}-${i}`} card={v.board[i]} w={boardW} className="m-deal" style={{ ['--i' as string]: i }} />
            ) : (
              <div key={i} className={`shrink-0 rounded-[8px] border border-dashed ${v.board.length ? 'border-white/15' : 'border-white/[.08]'}`} style={{ width: boardW, height: Math.round(boardW * 1.4) }} />
            ),
          )}
        </div>
        <div className="mt-3 flex justify-center">
          <div className="m-chip m-num px-3.5 py-1 text-[14px] font-semibold">
            Pot <b>{fmt(v.centerPotBB)}</b>
          </div>
        </div>
        <div className="absolute left-1/2 flex -translate-x-1/2" style={{ bottom: -Math.round(heroW * 0.42) }}>
          <MCard card={v.heroCards[0]} w={heroW} className="m-deal" style={{ transform: 'rotate(-6deg) translateY(3px)', ['--i' as string]: 5 }} />
          <MCard card={v.heroCards[1]} w={heroW} className="m-deal" style={{ marginLeft: -Math.round(heroW * 0.18), transform: 'rotate(6deg) translateY(3px)', ['--i' as string]: 6 }} />
        </div>
      </div>
      <div className="flex flex-col items-center" style={{ marginTop: Math.round(heroW * 0.42) + 8 }}>
        <div className="text-[13px] text-mute">
          <b className="text-ink">You · {v.heroPos}</b> · stack {fmt(v.stackBB)}
        </div>
      </div>
    </div>
  );
}

function History({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div className="m-card-2 flex flex-col gap-1 px-3.5 py-2.5">
      {lines.map((l, i) => {
        const m = /^(Preflop|Flop|Turn|River):\s*(.*)$/.exec(l);
        return (
          <div key={i} className="flex gap-2 text-[13px] leading-snug">
            {m && <span className="w-[52px] shrink-0 font-semibold text-dim">{m[1]}</span>}
            <span className="text-mute">{m ? m[2] : l}</span>
          </div>
        );
      })}
    </div>
  );
}

const TONE: Record<ViewOption['tone'], string> = {
  fold: 'bg-[#2a1719] text-[#ff7b7b]',
  neutral: 'bg-[#1b2635] text-[#cfe3ff]',
  aggr: 'bg-gradient-to-b from-[#f7bf4b] to-[#e9a020] text-[#1d1403]',
};

function OptionButton({ o, state, onClick, compact }: { o: ViewOption; state: 'idle' | 'chosen-ok' | 'chosen-bad' | 'correct' | 'faded'; onClick: () => void; compact?: boolean }) {
  const ring = state === 'chosen-ok' || state === 'correct' ? 'ring-[3px] ring-accent' : state === 'chosen-bad' ? 'ring-[3px] ring-loss' : '';
  return (
    <button
      onClick={onClick}
      disabled={state !== 'idle'}
      className={`m-tap relative flex flex-1 flex-col items-center justify-center rounded-[18px] px-2 font-bold ${TONE[o.tone]} ${ring} ${state === 'faded' ? 'opacity-35' : ''}`}
      style={{ minHeight: compact ? 54 : 58 }}
    >
      <span className={`${compact ? 'text-[15px]' : 'text-[17px]'} m-num leading-tight`}>{o.label}</span>
      {o.sub && <span className="m-num text-[12px] font-semibold opacity-70">{o.sub}</span>}
      {(state === 'correct' || state === 'chosen-ok') && (
        <span className="m-pop absolute -top-2 -right-1.5 grid h-6 w-6 place-items-center rounded-full bg-accent text-[#03140b] shadow">
          <Check size={15} strokeWidth={3.2} />
        </span>
      )}
      {state === 'chosen-bad' && (
        <span className="m-pop absolute -top-2 -right-1.5 grid h-6 w-6 place-items-center rounded-full bg-loss text-white shadow">
          <X size={15} strokeWidth={3.2} />
        </span>
      )}
    </button>
  );
}

function Dock({ options, chosen, outcome, onChoose }: { options: ViewOption[]; chosen: string | null; outcome: Outcome | null; onChoose: (k: string) => void }) {
  const stateOf = (o: ViewOption) => {
    if (!chosen || !outcome) return 'idle' as const;
    if (o.key === chosen) return outcome.ok ? ('chosen-ok' as const) : ('chosen-bad' as const);
    if (outcome.correctKeys.includes(o.key)) return 'correct' as const;
    return 'faded' as const;
  };
  const passive = options.filter((o) => o.group === 'passive');
  const aggr = options.filter((o) => o.group === 'aggr');
  const choice = options.filter((o) => o.group === 'choice');
  return (
    <div className="flex flex-col gap-2.5">
      {choice.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {choice.map((o) => (
            <OptionButton key={o.key} o={o} state={stateOf(o)} onClick={() => onChoose(o.key)} />
          ))}
        </div>
      )}
      {aggr.length > 0 && (
        <div className="flex gap-2">
          {aggr.map((o) => (
            <OptionButton key={o.key} o={o} compact={aggr.length > 2} state={stateOf(o)} onClick={() => onChoose(o.key)} />
          ))}
        </div>
      )}
      {passive.length > 0 && (
        <div className="flex gap-2.5">
          {passive.map((o) => (
            <OptionButton key={o.key} o={o} state={stateOf(o)} onClick={() => onChoose(o.key)} />
          ))}
        </div>
      )}
    </div>
  );
}

const PRAISE = ['Correct!', 'Nice read!', 'Spot on!', 'Well played!', 'Exactly right!'];

function ResultSheet({ o, onNext, nextLabel, real }: { o: Outcome; onNext: () => void; nextLabel: string; real?: SpotView['real'] }) {
  const { fmt } = useUnits(real);
  const [open, setOpen] = useState(!o.ok);
  const title = o.brilliant ? 'Brilliant!' : o.ok ? PRAISE[Math.abs(o.chosenKey.length + o.bestKey.length) % PRAISE.length] : 'Not quite';
  const color = o.brilliant ? 'var(--color-brilliant)' : o.ok ? 'var(--color-accent)' : 'var(--color-loss)';
  const maxEv = Math.max(...o.bars.map((b) => b.ev ?? -Infinity));
  return (
    <div className="m-sheet-in fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[78dvh] max-w-[560px] flex-col rounded-t-[28px] border-t border-white/10 bg-[#13171e] shadow-[0_-20px_50px_rgba(0,0,0,.55)]">
      <button
        className="flex w-full justify-center pt-2 pb-1"
        aria-label={open ? 'Collapse' : 'Expand'}
        onClick={() => {
          haptic.tap();
          setOpen((x) => !x);
        }}
      >
        <span className="h-1.5 w-10 rounded-full bg-white/20" />
      </button>
      <div className="m-noscrollbar overflow-y-auto px-5 pb-2">
        <div className="flex items-center gap-3.5 py-1.5">
          <div className="m-pop grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full text-[#06120c]" style={{ background: color }}>
            {o.brilliant ? <span className="text-[22px] font-black text-white">!!</span> : o.ok ? <Check size={30} strokeWidth={3.2} /> : <X size={30} strokeWidth={3.2} className="text-white" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[22px] font-extrabold tracking-tight" style={{ color }}>
              {title}
            </div>
            <div className="truncate text-[14px] text-mute">{o.ok ? (o.correctKeys.length > 1 ? `${o.bestLabel} — any of the highlighted plays works` : `Best play: ${o.bestLabel}`) : `Best play: ${o.bestLabel}`}</div>
          </div>
          {o.delta !== undefined && o.ratingBefore !== undefined && (
            <div className="m-rise flex flex-col items-end">
              <span className="m-num text-[20px] font-extrabold" style={{ color: o.delta >= 0 ? 'var(--color-accent)' : 'var(--color-loss)' }}>
                {o.delta >= 0 ? '+' : '−'}
                {Math.abs(o.delta)}
              </span>
              <CountUp from={o.ratingBefore} to={o.ratingBefore + o.delta} className="text-[13px] text-mute" />
            </div>
          )}
        </div>

        {o.idea && (
          <div className="mt-2 flex gap-2.5 rounded-[16px] bg-white/[.045] px-3.5 py-3 text-[15px] leading-snug">
            <Lightbulb size={18} className="mt-0.5 shrink-0 text-[#f3c23a]" />
            <span>{o.idea}</span>
          </div>
        )}

        {!open && (o.bars.length > 0 || (o.lines?.length ?? 0) > 0) && (
          <button
            className="m-tap mt-2 flex w-full items-center justify-center gap-1 py-1.5 text-[14px] font-semibold text-accent"
            onClick={() => {
              haptic.tap();
              setOpen(true);
            }}
          >
            {o.barSource === 'solver' ? 'See the solver breakdown' : 'Why?'} <ChevronDown size={16} />
          </button>
        )}

        {open && (
          <div className="m-fade">
            {o.lines && o.lines.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5 text-[14.5px] leading-snug text-ink/90">
                {o.lines.map((l, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            )}
            {o.bars.length > 0 && (
              <div className="mt-4">
                <div className="m-label mb-2">{o.barSource === 'solver' ? 'GTO solver · your exact hand' : o.barSource === 'chart' ? 'Range chart frequency' : 'Engine estimate'}</div>
                <div className="flex flex-col gap-2">
                  {o.bars.map((b) => {
                    const isBest = o.correctKeys.includes(b.key);
                    const isChosen = b.key === o.chosenKey;
                    return (
                      <div key={b.key} className={`rounded-[14px] px-3 py-2 ${isChosen ? 'bg-white/[.07]' : ''}`}>
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-[14px]">
                          <span className="m-num truncate font-semibold">
                            {b.label}
                            {isChosen && <span className="ml-1.5 text-[12px] font-medium text-mute">(you)</span>}
                          </span>
                          <span className="m-num shrink-0 text-mute">
                            {b.freq !== undefined && <b className="text-ink">{Math.round(b.freq * 100)}%</b>}
                            {b.ev !== undefined && <span className={`ml-2 ${b.ev === maxEv ? 'text-accent' : ''}`}>EV {b.ev >= 0 ? '+' : '−'}{fmt(Math.abs(b.ev))}</span>}
                          </span>
                        </div>
                        {b.freq !== undefined && <div className="h-1.5 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full" style={{ width: `${Math.round(b.freq * 100)}%`, background: isBest ? 'var(--color-accent)' : '#6b7486', transition: 'width .7s' }} /></div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {o.facts.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {o.facts.map((f) => (
                  <div key={f.label} className={`rounded-[14px] bg-white/[.045] px-3 py-2.5 ${f.value.length > 22 ? 'col-span-2' : ''}`}>
                    <div className="text-[11.5px] font-semibold uppercase tracking-wider text-dim">{f.label}</div>
                    <div className="m-num mt-0.5 text-[14.5px] font-semibold">{f.value}</div>
                  </div>
                ))}
              </div>
            )}
            <button
              className="m-tap mt-3 flex w-full items-center justify-center gap-1 py-1.5 text-[14px] font-semibold text-mute"
              onClick={() => {
                haptic.tap();
                setOpen(false);
              }}
            >
              Show the table <ChevronUp size={16} />
            </button>
          </div>
        )}
      </div>
      <div className="m-safe-bottom px-4 pt-2">
        <PrimaryButton onClick={onNext} className="mb-3 w-full">
          {nextLabel}
        </PrimaryButton>
      </div>
    </div>
  );
}

/**
 * Full-screen decision player used by puzzles, the daily hand and own-hand practice.
 * The parent grades the answer (`onAnswer` returns the outcome) so each mode can record it its own way.
 */
export function Player({
  view,
  onAnswer,
  onNext,
  onClose,
  title,
  right,
  progress,
  nextLabel = 'Next',
  revealed,
}: {
  view: SpotView;
  onAnswer: (key: string) => Outcome;
  onNext: () => void;
  onClose: () => void;
  title: ReactNode;
  right?: ReactNode;
  progress?: { i: number; n: number; results?: boolean[] };
  nextLabel?: string;
  /** Review mode: start with this outcome already shown. */
  revealed?: Outcome;
}) {
  const [chosen, setChosen] = useState<string | null>(revealed?.chosenKey ?? null);
  const [outcome, setOutcome] = useState<Outcome | null>(revealed ?? null);
  const { tx } = useUnits(view.real);
  useEffect(() => {
    sound.deal();
  }, []);
  const choose = (k: string) => {
    if (chosen) return;
    haptic.press();
    const o = onAnswer(k);
    setChosen(k);
    setOutcome(o);
    if (o.ok) {
      setTimeout(() => (o.brilliant ? haptic.celebrate() : haptic.success()), 60);
      o.brilliant ? sound.fanfare() : sound.correct();
    } else {
      setTimeout(() => haptic.error(), 60);
      sound.wrong();
    }
  };
  return (
    <div className="m-app fixed inset-0 z-30 flex flex-col">
      <div className="m-safe-top" />
      <div className="mx-auto flex h-[52px] w-full max-w-[600px] items-center gap-2 px-3">
        <button
          aria-label="Close"
          className="m-tap grid h-10 w-10 place-items-center rounded-full bg-white/[.07]"
          onClick={() => {
            haptic.tap();
            onClose();
          }}
        >
          <X size={22} />
        </button>
        <div className="min-w-0 flex-1 text-center text-[16px] font-bold">{title}</div>
        <div className="flex min-w-10 justify-end">{right}</div>
      </div>
      {progress && (
        <div className="mx-auto flex w-full max-w-[600px] gap-1.5 px-4 pb-1">
          {Array.from({ length: progress.n }, (_, i) => {
            const r = progress.results?.[i];
            return <div key={i} className="h-1.5 flex-1 rounded-full transition-colors duration-500" style={{ background: r === true ? 'var(--color-accent)' : r === false ? 'var(--color-loss)' : i === progress.i ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.1)' }} />;
          })}
        </div>
      )}
      <div className="m-noscrollbar mx-auto w-full max-w-[600px] flex-1 overflow-y-auto px-4 pt-2 pb-4">
        <Table v={view} shake={!!outcome && !outcome.ok} celebrate={!!outcome?.ok} />
        <div className="mt-3 flex flex-col gap-2.5">
          <div className="px-1 text-center">
            <div className="text-[18px] leading-snug font-bold tracking-tight">{tx(view.prompt)}</div>
            {view.handLabel && view.kind === 'table' && <div className="mt-0.5 text-[14px] text-mute">{view.handLabel}</div>}
          </div>
          <History lines={view.history.map(tx)} />
        </div>
      </div>
      <div className="m-safe-bottom px-4 pt-2 pb-3" style={{ background: 'linear-gradient(to top, #08090c 70%, transparent)' }}>
        <div className="mx-auto max-w-[568px] pb-1">
          <Dock options={view.options} chosen={chosen} outcome={outcome} onChoose={choose} />
        </div>
      </div>
      {outcome && <ResultSheet key={view.id} o={outcome} onNext={onNext} nextLabel={nextLabel} real={view.real} />}
    </div>
  );
}
