import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { haptic, sound } from '../feedback.ts';
import { useUnits } from '../settings.ts';
import { STREET_LINE, StreetBullet } from './lines.tsx';
import type { Outcome, SpotView, ViewOption } from './spot.ts';
import { Confetti, CountUp, MCard, PrimaryButton, Rich } from './ui.tsx';

function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 390 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return Math.min(w, 520);
}

/** The felt: villain on top, board and pot in the middle, your cards big at the bottom. */
export function Table({ v, shake, celebrate }: { v: SpotView; shake?: boolean; celebrate?: boolean }) {
  const { fmt } = useUnits(v.real);
  const vw = useViewportWidth();
  const boardW = Math.max(40, Math.min(58, Math.floor((vw - 40 - 28 - 4 * 6) / 5)));
  const heroW = Math.min(82, Math.round(boardW * 1.4));
  if (v.kind === 'math') {
    return (
      <div className={`m-felt relative flex flex-col items-center justify-center gap-2 rounded-[28px] px-5 py-12 ${shake ? 'm-shake' : ''}`}>
        {celebrate && <Confetti />}
        <div className="m-label !text-[rgba(242,237,227,.6)]">Pot</div>
        <div className="m-num text-[52px] leading-none font-semibold">{fmt(v.centerPotBB)}</div>
        <div className="m-pop m-mono mt-3 rounded-full bg-[var(--gold)] px-4 py-1.5 text-[14px] font-semibold text-[var(--ink)]">Villain bets {fmt(v.toCallBB)}</div>
      </div>
    );
  }
  const isBet = v.villainAction && !/^check/i.test(v.villainAction);
  return (
    <div className="relative">
      <div className={`m-felt relative rounded-[30px] px-3.5 pt-5 ${shake ? 'm-shake' : ''}`} style={{ paddingBottom: Math.round(heroW * 0.95) }}>
        {celebrate && <Confetti />}
        <div className="relative flex flex-col items-center gap-2">
          {v.villainPos ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex">
                  <MCard hidden w={22} style={{ transform: 'rotate(-8deg)' }} />
                  <MCard hidden w={22} style={{ marginLeft: -11, transform: 'rotate(7deg)' }} />
                </div>
                <span className="m-mono rounded-full bg-[rgba(13,13,11,.55)] px-2.5 py-1 text-[12px] font-semibold tracking-wide">{v.villainPos}</span>
              </div>
              {v.villainAction ? (
                <div className={`m-pop m-mono rounded-full px-3 py-1 text-[12.5px] font-semibold ${isBet ? 'bg-[var(--gold)] text-[var(--ink)]' : 'border border-[rgba(242,237,227,.35)] text-[var(--paper)]'}`}>{v.villainAction}</div>
              ) : (
                <div className="h-[26px]" />
              )}
            </>
          ) : (
            <div className="h-[54px]" />
          )}
        </div>
        <div className="relative mt-3 flex justify-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) =>
            v.board[i] !== undefined ? (
              <MCard key={`${v.id}-${i}`} card={v.board[i]} w={boardW} className="m-deal" style={{ ['--i' as string]: i }} />
            ) : (
              <div key={i} className="shrink-0 rounded-[6px] border border-dashed border-[rgba(242,237,227,.14)]" style={{ width: boardW, height: Math.round(boardW * 1.4) }} />
            ),
          )}
        </div>
        <div className="relative mt-3.5 flex justify-center">
          <div className="flex items-baseline gap-2 rounded-full bg-[rgba(13,13,11,.5)] px-3.5 py-1.5">
            <span className="m-label !text-[10px] !text-[rgba(242,237,227,.55)]">Pot</span>
            <span className="m-num text-[15px] font-semibold">{fmt(v.centerPotBB)}</span>
          </div>
        </div>
        <div className="absolute left-1/2 flex -translate-x-1/2" style={{ bottom: -Math.round(heroW * 0.42) }}>
          <MCard card={v.heroCards[0]} w={heroW} className="m-deal" style={{ transform: 'rotate(-6deg) translateY(4px)', ['--i' as string]: 5 }} />
          <MCard card={v.heroCards[1]} w={heroW} className="m-deal" style={{ marginLeft: -Math.round(heroW * 0.2), transform: 'rotate(6deg) translateY(4px)', ['--i' as string]: 6 }} />
        </div>
      </div>
      <div className="m-mono flex justify-center text-[11.5px] tracking-wide text-[var(--mute)] uppercase" style={{ marginTop: Math.round(heroW * 0.42) + 10 }}>
        <span className="text-[var(--text)]">You · {v.heroPos}</span>
        <span className="mx-2 text-[var(--dim)]">/</span>
        <span className="normal-case">stack {fmt(v.stackBB)}</span>
      </div>
    </div>
  );
}

function History({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div className="m-card flex flex-col gap-2 px-3.5 py-3">
      {lines.map((l, i) => {
        const m = /^(Preflop|Flop|Turn|River):\s*(.*)$/.exec(l);
        const parts = (m ? m[2] : l).split(' · ');
        return (
          <div key={i} className="flex items-start gap-2.5 text-[13.5px] leading-snug">
            {m ? <StreetBullet street={m[1]} size={19} /> : <span className="w-[19px]" />}
            <span className="text-[var(--mute)]">
              {parts.map((p, k) => (
                <span key={k}>
                  {k > 0 && <span className="mx-1.5 text-[var(--dim)]">→</span>}
                  <span className={p.startsWith('You ') ? 'text-[var(--text)]' : ''}>{p}</span>
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const TONE: Record<ViewOption['tone'], string> = {
  fold: 'border border-[var(--line-2)] text-[#ff7a72]',
  neutral: 'bg-[var(--ink-3)] text-[var(--paper)]',
  aggr: 'bg-[var(--signal)] text-[#160700]',
};

function OptionButton({ o, state, onClick, compact }: { o: ViewOption; state: 'idle' | 'chosen-ok' | 'chosen-bad' | 'correct' | 'faded'; onClick: () => void; compact?: boolean }) {
  const ring = state === 'chosen-ok' || state === 'correct' ? 'outline outline-2 outline-offset-2 outline-[var(--win)]' : state === 'chosen-bad' ? 'outline outline-2 outline-offset-2 outline-[var(--loss)]' : '';
  return (
    <button
      onClick={onClick}
      disabled={state !== 'idle'}
      className={`m-tap relative flex flex-1 flex-col items-center justify-center rounded-[14px] px-2 ${TONE[o.tone]} ${ring} ${state === 'faded' ? 'opacity-30' : ''}`}
      style={{ minHeight: compact ? 56 : 60 }}
    >
      <span className={`${compact ? 'text-[15px]' : 'text-[16.5px]'} leading-tight font-semibold tracking-tight`}>{o.label}</span>
      {o.sub && <span className="m-mono mt-0.5 text-[11px] uppercase opacity-65">{o.sub}</span>}
      {(state === 'correct' || state === 'chosen-ok') && (
        <span className="m-pop absolute -top-2.5 -right-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--win)] text-[var(--ink)]">
          <Check size={14} strokeWidth={3.4} />
        </span>
      )}
      {state === 'chosen-bad' && (
        <span className="m-pop absolute -top-2.5 -right-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--loss)] text-white">
          <X size={14} strokeWidth={3.4} />
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

const PRAISE = ['Correct.', 'Nice read.', 'Spot on.', 'Well played.', 'Exactly.'];

/** The answer slides up as a paper receipt. */
function ResultSheet({ o, onNext, nextLabel, real }: { o: Outcome; onNext: () => void; nextLabel: string; real?: SpotView['real'] }) {
  const { fmt } = useUnits(real);
  const [open, setOpen] = useState(!o.ok);
  const title = o.brilliant ? 'Brilliant.' : o.ok ? PRAISE[(o.chosenKey.length + o.bestKey.length) % PRAISE.length] : 'Not quite.';
  const color = o.brilliant ? '#0a8fae' : o.ok ? '#16934f' : '#d83a2f';
  const maxEv = Math.max(...o.bars.map((b) => b.ev ?? -Infinity));
  return (
    <div className="m-sheet-in fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[80dvh] max-w-[600px] flex-col">
      <div className="m-perf" />
      <div className="m-paper flex min-h-0 flex-col shadow-[0_-24px_60px_rgba(0,0,0,.6)]">
        <button
          className="flex w-full justify-center pt-2.5 pb-1"
          aria-label={open ? 'Collapse' : 'Expand'}
          onClick={() => {
            haptic.tap();
            setOpen((x) => !x);
          }}
        >
          <span className="h-1 w-9 rounded-full bg-[rgba(13,13,11,.18)]" />
        </button>
        <div className="m-noscrollbar overflow-y-auto px-5 pb-2">
          <div className="flex items-start justify-between gap-3 pt-1">
            <div className="min-w-0">
              <div className="m-label">{o.ok ? (o.brilliant ? 'Above your level' : 'Solved') : 'Missed'}</div>
              <div className="m-serif m-pop mt-1 text-[44px] leading-[.95]" style={{ color }}>
                {title}
              </div>
            </div>
            {o.delta !== undefined && o.ratingBefore !== undefined && (
              <div className="m-rise flex flex-col items-end pt-1">
                <span className="m-num text-[26px] leading-none font-semibold" style={{ color }}>
                  {o.delta >= 0 ? '+' : '−'}
                  {Math.abs(o.delta)}
                </span>
                <span className="m-mono mt-1 text-[11px] text-[#7d776b]">
                  RATING <CountUp from={o.ratingBefore} to={o.ratingBefore + o.delta} />
                </span>
              </div>
            )}
          </div>
          <div className="m-mono mt-3 flex items-center gap-2 text-[12.5px] text-[#4b473f]">
            <span className="text-[#7d776b] uppercase">Best play</span>
            <span className="font-semibold text-[var(--ink)]">{o.bestLabel}</span>
            {o.correctKeys.length > 1 && <span className="text-[#7d776b]">· any size</span>}
          </div>

          {o.idea && (
            <>
              <div className="m-dash my-3.5 text-[var(--ink)]" />
              <p className="m-serif text-[21px] leading-[1.22] text-[var(--ink)]">
                <Rich text={o.idea} />
              </p>
            </>
          )}

          {!open && (o.bars.length > 0 || (o.lines?.length ?? 0) > 0) && (
            <button
              className="m-tap m-mono mt-3 flex w-full items-center justify-center gap-1 py-1.5 text-[12px] font-semibold tracking-wider text-[var(--ink)] uppercase"
              onClick={() => {
                haptic.tap();
                setOpen(true);
              }}
            >
              {o.barSource === 'solver' ? 'Solver breakdown' : 'Why'} <ChevronDown size={14} />
            </button>
          )}

          {open && (
            <div className="m-fade">
              {o.lines && o.lines.length > 0 && (
                <>
                  <div className="m-dash my-3.5 text-[var(--ink)]" />
                  <ul className="flex flex-col gap-2 text-[14.5px] leading-snug text-[#2b2925]">
                    {o.lines.map((l, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="m-mono mt-[1px] text-[11px] text-[#9a9384]">{String(i + 1).padStart(2, '0')}</span>
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {o.bars.length > 0 && (
                <>
                  <div className="m-dash my-3.5 text-[var(--ink)]" />
                  <div className="m-label mb-2.5">{o.barSource === 'solver' ? 'GTO solver · your exact hand' : o.barSource === 'chart' ? 'Range chart' : 'Engine estimate'}</div>
                  <div className="flex flex-col gap-2.5">
                    {o.bars.map((b) => {
                      const isBest = o.correctKeys.includes(b.key);
                      const isChosen = b.key === o.chosenKey;
                      return (
                        <div key={b.key}>
                          <div className="mb-1 flex items-baseline justify-between gap-2 text-[14px]">
                            <span className={`truncate ${isBest ? 'font-semibold' : ''}`}>
                              {b.label}
                              {isChosen && <span className="m-mono ml-1.5 rounded bg-[var(--ink)] px-1 py-px text-[10px] text-[var(--paper)]">YOU</span>}
                            </span>
                            <span className="m-num shrink-0 text-[12.5px] text-[#4b473f]">
                              {b.freq !== undefined && <span className="font-semibold text-[var(--ink)]">{Math.round(b.freq * 100)}%</span>}
                              {b.ev !== undefined && <span className={`ml-2.5 ${b.ev === maxEv ? 'font-semibold text-[#16934f]' : ''}`}>EV {b.ev >= 0 ? '+' : '−'}{fmt(Math.abs(b.ev))}</span>}
                            </span>
                          </div>
                          {b.freq !== undefined && (
                            <div className="h-[5px] overflow-hidden rounded-full bg-[rgba(13,13,11,.08)]">
                              <div className="h-full rounded-full" style={{ width: `${Math.round(b.freq * 100)}%`, background: isBest ? '#16934f' : '#8f887a', transition: 'width .7s' }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {o.facts.length > 0 && (
                <>
                  <div className="m-dash my-3.5 text-[var(--ink)]" />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {o.facts.map((f) => (
                      <div key={f.label} className={f.value.length > 22 ? 'col-span-2' : ''}>
                        <div className="m-label !text-[10px]">{f.label}</div>
                        <div className="mt-0.5 text-[14.5px] font-medium text-[var(--ink)]">{f.value}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <button
                className="m-tap m-mono mt-4 flex w-full items-center justify-center gap-1 py-1.5 text-[11.5px] tracking-wider text-[#7d776b] uppercase"
                onClick={() => {
                  haptic.tap();
                  setOpen(false);
                }}
              >
                Show the table <ChevronUp size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="m-safe-bottom px-4 pt-2">
          <PrimaryButton onClick={onNext} tone="ink" className="mb-3 w-full">
            {nextLabel} <span className="m-mono text-[var(--signal)]">→</span>
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Full-screen decision player used by puzzles, the Daily Hand and own-hand practice.
 * The parent grades the answer (`onAnswer` returns the outcome) so each mode records it its own way.
 */
export function Player({
  view,
  onAnswer,
  onNext,
  onClose,
  title,
  kicker,
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
  kicker?: ReactNode;
  right?: ReactNode;
  progress?: { i: number; n: number; results?: boolean[] };
  nextLabel?: string;
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
      if (o.brilliant) sound.fanfare();
      else sound.correct();
    } else {
      setTimeout(() => haptic.error(), 60);
      sound.wrong();
    }
  };
  const street = STREET_LINE[view.street] ?? STREET_LINE.preflop;
  return (
    <div className="m-app m-grain fixed inset-0 z-30 flex flex-col">
      <div className="m-safe-top" />
      <div className="mx-auto flex h-[54px] w-full max-w-[600px] items-center gap-3 px-4">
        <button
          aria-label="Close"
          className="m-tap grid h-10 w-10 place-items-center rounded-full border border-[var(--line-2)]"
          onClick={() => {
            haptic.tap();
            onClose();
          }}
        >
          <X size={19} />
        </button>
        <div className="min-w-0 flex-1 text-center leading-tight">
          {kicker && <div className="m-label !text-[10px]">{kicker}</div>}
          <div className="truncate text-[15px] font-semibold">{title}</div>
        </div>
        <div className="flex min-w-10 justify-end">{right}</div>
      </div>
      {progress && (
        <div className="mx-auto flex w-full max-w-[600px] gap-1.5 px-5 pb-1.5">
          {Array.from({ length: progress.n }, (_, i) => {
            const r = progress.results?.[i];
            return <div key={i} className="h-[3px] flex-1 rounded-full transition-colors duration-500" style={{ background: r === true ? 'var(--win)' : r === false ? 'var(--loss)' : i === progress.i ? 'var(--paper)' : 'var(--ink-4)' }} />;
          })}
        </div>
      )}
      <div className="m-noscrollbar mx-auto w-full max-w-[600px] flex-1 overflow-y-auto px-5 pt-2 pb-4">
        <Table v={view} shake={!!outcome && !outcome.ok} celebrate={!!outcome?.ok} />
        <div className="mt-4 flex flex-col gap-3">
          <div className="px-1">
            <div className="m-label flex items-center gap-2">
              {view.kind === 'table' && <StreetBullet street={view.street} size={16} />}
              {view.kind === 'math' ? 'Quick maths' : `${street.name} — your move`}
            </div>
            <div className="m-serif mt-1.5 text-[27px] leading-[1.08]">
              <Rich text={tx(view.prompt.replace(/^(Preflop|Flop|Turn|River):\s*/, ''))} />
            </div>
            {view.handLabel && view.kind === 'table' && <div className="mt-1 text-[14px] text-[var(--mute)]">{view.handLabel}</div>}
          </div>
          <History lines={view.history.map(tx)} />
        </div>
      </div>
      <div className="m-safe-bottom px-4 pt-3 pb-3" style={{ background: 'linear-gradient(to top, var(--ink) 75%, transparent)' }}>
        <div className="mx-auto max-w-[568px] pb-1">
          <Dock options={view.options} chosen={chosen} outcome={outcome} onChoose={choose} />
        </div>
      </div>
      {outcome && <ResultSheet key={view.id} o={outcome} onNext={onNext} nextLabel={nextLabel} real={view.real} />}
    </div>
  );
}
