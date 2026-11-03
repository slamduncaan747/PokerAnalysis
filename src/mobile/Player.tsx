import { Check, CircleCheck, CircleX, Sparkles, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { haptic, sound } from '../feedback.ts';
import { useUnits } from '../settings.ts';
import type { Outcome, SpotView, ViewOption } from './spot.ts';
import { Bar, Button, Confetti, CountUp, MCard } from './ui.tsx';

function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 390 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return Math.min(w, 520);
}

const STREET_NAME: Record<string, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' };

/** The table. Villain on top, board and pot in the middle, your cards at the bottom. Nothing else. */
export function Table({ v, shake, celebrate }: { v: SpotView; shake?: boolean; celebrate?: boolean }) {
  const { fmt } = useUnits(v.real);
  const vw = useViewportWidth();
  const boardW = Math.max(40, Math.min(58, Math.floor((vw - 32 - 28 - 4 * 6) / 5)));
  const heroW = Math.min(78, Math.round(boardW * 1.35));
  if (v.kind === 'math') {
    return (
      <div className={`m-felt relative flex flex-col items-center justify-center gap-1 rounded-[22px] px-5 py-10 text-white ${shake ? 'm-shake' : ''}`}>
        {celebrate && <Confetti />}
        <div className="t-sub text-white/70">Pot</div>
        <div className="t-rounded t-num text-[48px] leading-none font-bold">{fmt(v.centerPotBB)}</div>
        <div className="m-pop t-sub mt-3 rounded-full bg-white px-3.5 py-1.5 font-semibold text-black">Villain bets {fmt(v.toCallBB)}</div>
      </div>
    );
  }
  const isBet = v.villainAction && !/^check/i.test(v.villainAction);
  return (
    <div>
      <div className={`m-felt relative rounded-[22px] px-3.5 pt-4 text-white ${shake ? 'm-shake' : ''}`} style={{ paddingBottom: Math.round(heroW * 0.92) }}>
        {celebrate && <Confetti />}
        <div className="flex h-[58px] flex-col items-center justify-start gap-1.5">
          {v.villainPos && (
            <>
              <div className="flex items-center gap-2">
                <div className="flex">
                  <MCard hidden w={20} style={{ transform: 'rotate(-6deg)' }} />
                  <MCard hidden w={20} style={{ marginLeft: -9, transform: 'rotate(6deg)' }} />
                </div>
                <span className="t-foot font-semibold text-white/90">{v.villainPos}</span>
              </div>
              {v.villainAction && <span className={`m-pop t-foot rounded-full px-2.5 py-[3px] font-semibold ${isBet ? 'bg-white text-black' : 'bg-white/20 text-white'}`}>{v.villainAction}</span>}
            </>
          )}
        </div>
        <div className="mt-2 flex justify-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) =>
            v.board[i] !== undefined ? (
              <MCard key={`${v.id}-${i}`} card={v.board[i]} w={boardW} className="m-deal" style={{ ['--i' as string]: i }} />
            ) : (
              <div key={i} className="shrink-0 rounded-[7px] bg-black/10" style={{ width: boardW, height: Math.round(boardW * 1.38) }} />
            ),
          )}
        </div>
        <div className="mt-3 flex justify-center">
          <span className="t-sub t-num rounded-full bg-black/25 px-3 py-1 font-semibold">Pot {fmt(v.centerPotBB)}</span>
        </div>
        <div className="absolute left-1/2 flex -translate-x-1/2" style={{ bottom: -Math.round(heroW * 0.4) }}>
          <MCard card={v.heroCards[0]} w={heroW} className="m-deal" style={{ transform: 'rotate(-5deg)', ['--i' as string]: 5 }} />
          <MCard card={v.heroCards[1]} w={heroW} className="m-deal" style={{ marginLeft: -Math.round(heroW * 0.16), transform: 'rotate(5deg)', ['--i' as string]: 6 }} />
        </div>
      </div>
      <div className="t-foot c-2 text-center" style={{ marginTop: Math.round(heroW * 0.4) + 10 }}>
        You · {v.heroPos} · Stack {fmt(v.stackBB)}
      </div>
    </div>
  );
}

function History({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div className="m-group">
      {lines.map((l, i) => {
        const m = /^(Preflop|Flop|Turn|River):\s*(.*)$/.exec(l);
        const parts = (m ? m[2] : l).split(' · ');
        return (
          <div key={i} className="flex gap-3 px-4 py-2.5">
            {m && <span className="t-sub w-[52px] shrink-0 font-semibold">{m[1]}</span>}
            <span className="t-sub c-2">
              {parts.map((p, k) => (
                <span key={k}>
                  {k > 0 && ', '}
                  <span style={p.startsWith('You ') ? { color: 'var(--label)' } : undefined}>{p}</span>
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

type OptState = 'idle' | 'chosen-ok' | 'chosen-bad' | 'correct' | 'faded';

function OptionButton({ o, state, onClick, compact }: { o: ViewOption; state: OptState; onClick: () => void; compact?: boolean }) {
  const look: Record<OptState, { background: string; color: string }> = {
    idle: { background: 'var(--bg-2)', color: 'var(--label)' },
    'chosen-ok': { background: 'var(--green)', color: '#fff' },
    'chosen-bad': { background: 'var(--red)', color: '#fff' },
    correct: { background: 'var(--green-soft)', color: 'var(--green-text)' },
    faded: { background: 'var(--bg-2)', color: 'var(--label)' },
  };
  return (
    <button
      onClick={onClick}
      disabled={state !== 'idle'}
      className={`m-press relative flex flex-1 flex-col items-center justify-center rounded-[14px] px-2 transition-[background-color,color,opacity] duration-300 ${state === 'faded' ? 'opacity-35' : ''}`}
      style={{ minHeight: compact ? 54 : 56, boxShadow: state === 'idle' ? 'var(--shadow)' : 'none', ...look[state] }}
    >
      <span className={`t-num leading-tight font-semibold ${compact ? 'text-[15px]' : 'text-[17px]'}`}>{o.label}</span>
      {o.sub && <span className="t-cap t-num mt-0.5 opacity-60">{o.sub}</span>}
      {(state === 'chosen-ok' || state === 'correct') && <Check size={15} strokeWidth={3} className="m-pop absolute top-1.5 right-2" />}
    </button>
  );
}

function Dock({ options, chosen, outcome, onChoose }: { options: ViewOption[]; chosen: string | null; outcome: Outcome | null; onChoose: (k: string) => void }) {
  const stateOf = (o: ViewOption): OptState => {
    if (!chosen || !outcome) return 'idle';
    if (o.key === chosen) return outcome.ok ? 'chosen-ok' : 'chosen-bad';
    if (outcome.correctKeys.includes(o.key)) return 'correct';
    return 'faded';
  };
  const passive = options.filter((o) => o.group === 'passive');
  const aggr = options.filter((o) => o.group === 'aggr');
  const choice = options.filter((o) => o.group === 'choice');
  return (
    <div className="flex flex-col gap-2">
      {choice.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
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
        <div className="flex gap-2">
          {passive.map((o) => (
            <OptionButton key={o.key} o={o} state={stateOf(o)} onClick={() => onChoose(o.key)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** The answer, as a sheet: verdict first, the idea second, the numbers on demand. */
function ResultSheet({ o, onNext, nextLabel, real }: { o: Outcome; onNext: () => void; nextLabel: string; real?: SpotView['real'] }) {
  const { fmt } = useUnits(real);
  const [open, setOpen] = useState(!o.ok);
  const title = o.brilliant ? 'Brilliant' : o.ok ? 'Correct' : 'Not Quite';
  const color = o.brilliant ? 'var(--teal)' : o.ok ? 'var(--green)' : 'var(--red)';
  const Icon = o.brilliant ? Sparkles : o.ok ? CircleCheck : CircleX;
  const maxEv = Math.max(...o.bars.map((b) => b.ev ?? -Infinity));
  const hasMore = o.bars.length > 0 || (o.lines?.length ?? 0) > 0 || o.facts.length > 0;
  return (
    <>
      {open && <div className="m-fade fixed inset-0 z-30" style={{ background: 'var(--sheet-dim)' }} onClick={() => setOpen(false)} />}
      <div className="m-sheet-in fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[82dvh] max-w-[600px] flex-col rounded-t-[22px] shadow-[0_-8px_40px_rgba(0,0,0,.18)]" style={{ background: 'var(--sheet-bg)' }}>
        <button
          className="flex w-full justify-center pt-2 pb-2"
          aria-label={open ? 'Collapse' : 'Expand'}
          onClick={() => {
            haptic.tap();
            setOpen((x) => !x);
          }}
        >
          <span className="h-[5px] w-9 rounded-full" style={{ background: 'var(--fill-2)' }} />
        </button>
        <div className="m-noscrollbar overflow-y-auto px-4 pb-2">
          <div className="flex items-center gap-3 px-1">
            <Icon size={40} strokeWidth={2} className="m-pop shrink-0" style={{ color }} fill={o.brilliant ? 'none' : 'currentColor'} stroke={o.brilliant ? 'currentColor' : 'var(--sheet-bg)'} />
            <div className="min-w-0 flex-1">
              <div className="t-title2">{title}</div>
              <div className="t-sub c-2 truncate">
                {o.ok && o.correctKeys.length > 1 ? 'Any bet size works here' : `Best play: ${o.bestLabel}`}
              </div>
            </div>
            {o.delta !== undefined && o.ratingBefore !== undefined && (
              <div className="flex flex-col items-end">
                <span className="t-rounded t-num rounded-full px-2.5 py-0.5 text-[17px] font-bold" style={{ background: o.delta >= 0 ? 'var(--green-soft)' : 'var(--red-soft)', color: o.delta >= 0 ? 'var(--green-text)' : 'var(--red-text)' }}>
                  {o.delta >= 0 ? '+' : '−'}
                  {Math.abs(o.delta)}
                </span>
                <span className="t-cap c-2 mt-1">
                  Rating <CountUp from={o.ratingBefore} to={o.ratingBefore + o.delta} />
                </span>
              </div>
            )}
          </div>

          {o.idea && (
            <div className="t-body mt-4 rounded-[12px] px-4 py-3" style={{ background: 'var(--sheet-cell)' }}>
              {o.idea}
            </div>
          )}

          {open && (
            <div className="m-fade">
              {o.lines && o.lines.length > 0 && (
                <div className="mt-4 rounded-[12px] px-4 py-3" style={{ background: 'var(--sheet-cell)' }}>
                  <ul className="t-sub flex flex-col gap-2">
                    {o.lines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
              {o.bars.length > 0 && (
                <>
                  <div className="t-foot c-2 mt-5 mb-1.5 px-4 uppercase">{o.barSource === 'solver' ? 'GTO solver · your exact hand' : o.barSource === 'chart' ? 'Range chart' : 'Engine estimate'}</div>
                  <div className="m-group" style={{ background: 'var(--sheet-cell)' }}>
                    {o.bars.map((b) => {
                      const isBest = o.correctKeys.includes(b.key);
                      const isChosen = b.key === o.chosenKey;
                      return (
                        <div key={b.key} className="px-4 py-2.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className={`t-body truncate ${isBest ? 'font-semibold' : ''}`}>
                              {b.label}
                              {isChosen && <span className="t-foot c-2 ml-1.5">Your pick</span>}
                            </span>
                            <span className="t-sub t-num shrink-0">
                              {b.freq !== undefined && <span className="font-semibold">{Math.round(b.freq * 100)}%</span>}
                              {b.ev !== undefined && (
                                <span className="ml-2" style={{ color: b.ev === maxEv ? 'var(--green-text)' : 'var(--label-2)' }}>
                                  {b.ev >= 0 ? '+' : '−'}
                                  {fmt(Math.abs(b.ev))}
                                </span>
                              )}
                            </span>
                          </div>
                          {b.freq !== undefined && (
                            <div className="mt-1.5">
                              <Bar value={b.freq} color={isBest ? 'var(--green)' : 'var(--gray)'} h={4} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {o.bars.some((b) => b.ev !== undefined) && <p className="t-foot c-2 mt-1.5 px-4">Numbers are expected value compared with folding.</p>}
                </>
              )}
              {o.facts.length > 0 && (
                <>
                  <div className="t-foot c-2 mt-5 mb-1.5 px-4 uppercase">Details</div>
                  <div className="m-group" style={{ background: 'var(--sheet-cell)' }}>
                    {o.facts.map((f) => (
                      <div key={f.label} className="flex items-start justify-between gap-4 px-4 py-2.5">
                        <span className="t-body shrink-0">{f.label}</span>
                        <span className="t-body c-2 text-right">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {hasMore && (
            <button
              className="m-press t-sub c-tint mt-3 w-full py-2 font-semibold"
              onClick={() => {
                haptic.tap();
                setOpen((x) => !x);
              }}
            >
              {open ? 'Show Table' : 'Show Details'}
            </button>
          )}
        </div>
        <div className="m-safe-bottom px-4 pt-1">
          <Button onClick={onNext} className="mb-3">
            {nextLabel}
          </Button>
        </div>
      </div>
    </>
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
  subtitle,
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
  subtitle?: ReactNode;
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
  const prompt = tx(view.prompt.replace(/^(Preflop|Flop|Turn|River):\s*/, ''));
  const context = [view.kind === 'math' ? 'Pot odds' : STREET_NAME[view.street], view.kind === 'table' ? view.handLabel : undefined].filter(Boolean).join(' · ');
  return (
    <div className="m-app fixed inset-0 z-30 flex flex-col">
      <div className="m-safe-top" />
      <div className="mx-auto flex h-[52px] w-full max-w-[600px] items-center gap-2 px-4">
        <button
          aria-label="Close"
          className="m-press grid h-[30px] w-[30px] place-items-center rounded-full"
          style={{ background: 'var(--fill)', color: 'var(--label-2)' }}
          onClick={() => {
            haptic.tap();
            onClose();
          }}
        >
          <X size={17} strokeWidth={2.6} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="t-headline truncate">{title}</div>
          {subtitle && <div className="t-cap c-2 truncate">{subtitle}</div>}
        </div>
        <div className="flex min-w-[30px] justify-end">{right}</div>
      </div>
      {progress && (
        <div className="mx-auto flex w-full max-w-[600px] gap-1 px-4 pb-1">
          {Array.from({ length: progress.n }, (_, i) => {
            const r = progress.results?.[i];
            return <div key={i} className="h-1 flex-1 rounded-full transition-colors duration-500" style={{ background: r === true ? 'var(--green)' : r === false ? 'var(--red)' : i === progress.i ? 'var(--label-2)' : 'var(--fill)' }} />;
          })}
        </div>
      )}
      <div className="m-noscrollbar mx-auto w-full max-w-[600px] flex-1 overflow-y-auto px-4 pt-2 pb-4">
        <Table v={view} shake={!!outcome && !outcome.ok} celebrate={!!outcome?.brilliant} />
        <div className="mt-5 px-1">
          <div className="t-title2">{prompt}</div>
          {context && <div className="t-sub c-2 mt-1">{context}</div>}
        </div>
        <div className="mt-4">
          <History lines={view.history.map(tx)} />
        </div>
      </div>
      <div className="m-bar m-hair-t m-safe-bottom px-4 pt-3 pb-3">
        <div className="mx-auto max-w-[568px] pb-1">
          <Dock options={view.options} chosen={chosen} outcome={outcome} onChoose={choose} />
        </div>
      </div>
      {outcome && <ResultSheet key={view.id} o={outcome} onNext={onNext} nextLabel={nextLabel} real={view.real} />}
    </div>
  );
}
