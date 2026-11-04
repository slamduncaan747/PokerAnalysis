import { Check, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { haptic, sound } from '../feedback.ts';
import { hashString } from '../lib/cards.ts';
import { useUnits } from '../settings.ts';
import type { Outcome, SpotView, ViewOption } from './spot.ts';
import { Bar, Btn, ChipPile, Confetti, CountUp, MCard, type BtnTone } from './ui.tsx';

function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 390 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return Math.min(w, 560);
}

const STREET_NAME: Record<string, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' };

/** The felt, edge to edge. The top bar floats on it; your cards sit on the rail. */
function Felt({ v, top, shake, celebrate }: { v: SpotView; top: ReactNode; shake?: boolean; celebrate?: boolean }) {
  const { fmt } = useUnits(v.real);
  const vw = useViewportWidth();
  const boardW = Math.max(42, Math.min(60, Math.floor((vw - 40 - 4 * 7) / 5)));
  const heroW = Math.min(86, Math.round(boardW * 1.42));
  const isBet = !!v.villainAction && !/^check/i.test(v.villainAction);
  return (
    <div className={`m-felt m-rail relative text-white ${shake ? 'm-shake' : ''}`} style={{ borderRadius: '0 0 40px 40px', paddingBottom: v.kind === 'math' ? 16 : 0 }}>
      {celebrate && <Confetti />}
      <div className="m-safe-top" />
      {top}
      {v.kind === 'math' ? (
        <div className="flex flex-col items-center gap-3 px-5 pt-6 pb-4">
          <ChipPile colors={['green', 'black', 'red', 'purple']} size={34} />
          <div className="f-small font-semibold text-white/70">Pot</div>
          <div className="f-hero f-num -mt-2">{fmt(v.centerPotBB)}</div>
          <div className="m-pop flex items-center gap-2 rounded-full bg-black/35 py-1.5 pr-3.5 pl-2">
            <ChipPile colors={['gold', 'red']} size={20} />
            <span className="f-ui font-bold">Villain bets {fmt(v.toCallBB)}</span>
          </div>
        </div>
      ) : (
        <>
          <div className="flex h-[74px] items-center justify-center gap-3 px-5">
            {!v.villainPos && v.history.length > 0 && (
              <div className="f-ui rounded-full bg-black/25 px-3.5 py-1.5 font-semibold text-white/85">Folded to you</div>
            )}
            {v.villainPos && (
              <>
                <div className="relative">
                  <div className="absolute -top-3 left-1/2 flex -translate-x-1/2">
                    <MCard hidden w={22} style={{ transform: 'rotate(-10deg)' }} />
                    <MCard hidden w={22} style={{ marginLeft: -10, transform: 'rotate(10deg)' }} />
                  </div>
                  <div className="relative grid h-12 w-12 place-items-center rounded-full bg-[#0b2b1d] text-[14px] font-extrabold" style={{ boxShadow: '0 0 0 2px rgba(255,255,255,.18), 0 4px 10px rgba(0,0,0,.35)' }}>
                    {v.villainPos}
                  </div>
                </div>
                {v.villainAction && (
                  <div className="m-pop flex items-center gap-2 rounded-full bg-black/35 py-1.5 pr-3.5 pl-2">
                    {isBet ? <ChipPile colors={['gold', 'red']} size={20} /> : <span className="ml-1 h-2 w-2 rounded-full bg-white/60" />}
                    <span className="f-ui font-bold">{v.villainAction}</span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className={`mt-3 flex justify-center gap-[7px] ${v.board.length ? '' : 'hidden'}`}>
            {[0, 1, 2, 3, 4].map((i) =>
              v.board[i] !== undefined ? (
                <MCard key={`${v.id}-${i}`} card={v.board[i]} w={boardW} className="m-deal" style={{ ['--i' as string]: i }} />
              ) : (
                <div key={i} className="shrink-0 rounded-[8px]" style={{ width: boardW, height: Math.round(boardW * 1.4), background: 'rgba(0,0,0,.14)', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.08)' }} />
              ),
            )}
          </div>
          <div className={`flex justify-center ${v.board.length ? 'mt-4' : 'mt-8 mb-4'}`}>
            <div className="flex items-center gap-2 rounded-full bg-black/30 py-1.5 pr-3.5 pl-2">
              <ChipPile colors={['green', 'black', 'red']} size={20} />
              <span className="f-ui f-num font-bold">Pot {fmt(v.centerPotBB)}</span>
            </div>
          </div>
          <div className="relative z-10 mt-4 flex justify-center" style={{ marginBottom: -Math.round(heroW * 0.32) }}>
            <MCard card={v.heroCards[0]} w={heroW} className="m-deal" style={{ transform: 'rotate(-6deg)', ['--i' as string]: 5, ['--dx' as string]: '-20px' }} />
            <MCard card={v.heroCards[1]} w={heroW} className="m-deal" style={{ marginLeft: -Math.round(heroW * 0.18), transform: 'rotate(6deg) translateY(2px)', ['--i' as string]: 6, ['--dx' as string]: '20px' }} />
          </div>
        </>
      )}
    </div>
  );
}

function History({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  if (!lines.length) return null;
  const shown = open ? lines : lines.slice(-1);
  return (
    <div className="m-tile-flat px-4 py-3">
      <div className="flex flex-col gap-2">
        {shown.map((l, i) => {
          const m = /^(Preflop|Flop|Turn|River):\s*(.*)$/.exec(l);
          return (
            <div key={i} className="flex gap-3">
              {m && <span className="f-tiny t3 w-[54px] shrink-0 pt-[3px]">{m[1]}</span>}
              <span className="f-small t2 font-normal">
                {(m ? m[2] : l).split(' · ').map((p, k) => (
                  <span key={k}>
                    {k > 0 && <span className="t3"> → </span>}
                    <span style={p.startsWith('You ') ? { color: 'var(--text)', fontWeight: 600 } : undefined}>{p}</span>
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
      {lines.length > 1 && (
        <button
          className="m-press f-small t2 mt-2 flex items-center gap-1 font-semibold"
          onClick={() => {
            haptic.tap();
            setOpen((x) => !x);
          }}
        >
          {open ? 'Hide' : 'Show'} the full hand {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      )}
    </div>
  );
}

const TONE: Record<ViewOption['tone'], BtnTone> = { fold: 'slate', neutral: 'blue', aggr: 'amber' };
type OptState = 'idle' | 'chosen-ok' | 'chosen-bad' | 'correct' | 'faded';

function OptionButton({ o, state, onClick, compact }: { o: ViewOption; state: OptState; onClick: () => void; compact?: boolean }) {
  const tone: BtnTone = state === 'chosen-ok' || state === 'correct' ? 'go' : state === 'chosen-bad' ? 'bad' : o.group === 'choice' ? 'slate' : TONE[o.tone];
  return (
    <Btn tone={tone} onClick={onClick} disabled={state !== 'idle'} className={`!flex-col !gap-0 !px-2 transition-opacity ${state === 'faded' ? 'opacity-30' : ''} keep`} style={{ minHeight: compact ? 54 : 58 }}>
      <span className={`f-num leading-tight ${compact ? 'text-[15px]' : 'text-[17px]'}`}>{o.label}</span>
      {o.sub && <span className="f-num text-[12px] font-semibold opacity-75">{o.sub}</span>}
      {(state === 'chosen-ok' || state === 'correct') && <Check size={16} strokeWidth={3.4} className="m-pop absolute top-1.5 right-2" />}
    </Btn>
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
    <div className="flex flex-col gap-3">
      {choice.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {choice.map((o) => (
            <OptionButton key={o.key} o={o} state={stateOf(o)} onClick={() => onChoose(o.key)} />
          ))}
        </div>
      )}
      {aggr.length > 0 && (
        <div className="flex gap-2.5">
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

const PRAISE = ['Nailed it!', 'Sharp!', 'Great read!', 'That’s the play!', 'Spot on!'];
const MISS = ['Not quite', 'So close', 'Tough one'];

/** The answer: a full-width banner in the result colour, Duolingo-style. */
function Feedback({ o, id, onNext, nextLabel, real }: { o: Outcome; id: string; onNext: () => void; nextLabel: string; real?: SpotView['real'] }) {
  const { fmt } = useUnits(real);
  const [open, setOpen] = useState(false);
  const h = hashString(id);
  const tone: BtnTone = o.brilliant ? 'gold' : o.ok ? 'go' : 'bad';
  const color = o.brilliant ? 'var(--gold)' : o.ok ? 'var(--go)' : 'var(--bad)';
  const bg = o.brilliant ? '#2a2210' : o.ok ? 'var(--go-bg)' : 'var(--bad-bg)';
  const title = o.brilliant ? 'Brilliant!' : o.ok ? PRAISE[h % PRAISE.length] : MISS[h % MISS.length];
  const maxEv = Math.max(...o.bars.map((b) => b.ev ?? -Infinity));
  const hasMore = o.bars.length > 0 || (o.lines?.length ?? 0) > 0 || o.facts.length > 0;
  return (
    <div className="m-up fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[600px]" style={{ background: bg, boxShadow: `0 -2px 0 ${color}, 0 -20px 50px rgba(0,0,0,.5)`, borderRadius: '24px 24px 0 0' }}>
      <div className="m-noscrollbar max-h-[62dvh] overflow-y-auto px-5 pt-5">
        <div className="flex items-center gap-3">
          <div className="m-pop grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: color, color: o.brilliant ? 'var(--gold-ink)' : o.ok ? 'var(--go-ink)' : '#fff' }}>
            {o.brilliant ? <Sparkles size={22} strokeWidth={2.6} /> : o.ok ? <Check size={24} strokeWidth={3.4} /> : <X size={24} strokeWidth={3.4} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="f-title font-extrabold" style={{ color }}>
              {title}
            </div>
            {!o.ok && <div className="f-ui t2 truncate">Best play: <span style={{ color: 'var(--text)' }}>{o.bestLabel}</span></div>}
            {o.ok && o.correctKeys.length > 1 && <div className="f-ui t2">Any bet size works here</div>}
          </div>
          {o.delta !== undefined && o.ratingBefore !== undefined && (
            <div className="m-pop flex flex-col items-end" style={{ ['--i' as string]: 2 }}>
              <span className="f-num rounded-full px-3 py-1 text-[17px] font-extrabold" style={{ background: o.delta >= 0 ? 'var(--gold)' : 'rgba(255,255,255,.1)', color: o.delta >= 0 ? 'var(--gold-ink)' : 'var(--text-2)' }}>
                {o.delta >= 0 ? '+' : '−'}
                {Math.abs(o.delta)}
              </span>
              <span className="f-small t2 mt-1">
                <CountUp from={o.ratingBefore} to={o.ratingBefore + o.delta} />
              </span>
            </div>
          )}
        </div>
        {o.idea && <p className="f-body mt-3 text-white/85">{o.idea}</p>}
        {open && (
          <div className="m-fade mt-4 flex flex-col gap-4">
            {o.lines && o.lines.length > 0 && (
              <ul className="f-ui flex flex-col gap-2 font-normal text-white/80">
                {o.lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
            {o.bars.length > 0 && (
              <div>
                <div className="f-tiny t2 mb-2.5">{o.barSource === 'solver' ? 'GTO solver · your exact hand' : o.barSource === 'chart' ? 'Range chart' : 'Engine estimate'}</div>
                <div className="flex flex-col gap-3">
                  {o.bars.map((b) => {
                    const isBest = o.correctKeys.includes(b.key);
                    return (
                      <div key={b.key}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                          <span className={`f-ui truncate ${isBest ? 'font-bold' : 'font-medium text-white/80'}`}>
                            {b.label}
                            {b.key === o.chosenKey && <span className="f-small t2 ml-1.5 font-medium">· you</span>}
                          </span>
                          <span className="f-small f-num shrink-0">
                            {b.freq !== undefined && <span className="font-bold">{Math.round(b.freq * 100)}%</span>}
                            {b.ev !== undefined && (
                              <span className="ml-2" style={{ color: b.ev === maxEv ? 'var(--go)' : 'var(--text-2)' }}>
                                EV {b.ev >= 0 ? '+' : '−'}
                                {fmt(Math.abs(b.ev))}
                              </span>
                            )}
                          </span>
                        </div>
                        {b.freq !== undefined && <Bar value={b.freq} color={isBest ? 'var(--go)' : 'var(--slate)'} h={8} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {o.facts.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-[14px] bg-black/20 p-3.5">
                {o.facts.map((f) => (
                  <div key={f.label} className={f.value.length > 20 ? 'col-span-2' : ''}>
                    <div className="f-tiny t3">{f.label}</div>
                    <div className="f-ui mt-0.5 font-semibold">{f.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {hasMore && (
          <button
            className="m-press f-ui mt-3 flex items-center gap-1 font-bold"
            style={{ color }}
            onClick={() => {
              haptic.tap();
              setOpen((x) => !x);
            }}
          >
            {open ? 'Less' : 'Why?'} {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
        )}
      </div>
      <div className="m-safe-bottom px-5 pt-4 pb-4">
        <Btn tone={tone} onClick={onNext} className="uppercase tracking-wide">
          {nextLabel}
        </Btn>
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
  subtitle,
  right,
  progress,
  nextLabel = 'Continue',
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
  const { tx, fmt } = useUnits(view.real);
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
  const top = (
    <div className="mx-auto w-full max-w-[600px] px-4">
      <div className="flex h-[50px] items-center gap-3">
        <button
          aria-label="Close"
          className="m-press grid h-9 w-9 place-items-center rounded-full bg-black/25"
          onClick={() => {
            haptic.tap();
            onClose();
          }}
        >
          <X size={20} strokeWidth={2.8} />
        </button>
        {progress ? (
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: progress.n }, (_, i) => {
              const r = progress.results?.[i];
              return (
                <div key={i} className="h-3 flex-1 overflow-hidden rounded-full bg-black/25">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: r === undefined ? (i === progress.i ? '35%' : '0%') : '100%', background: r === true ? 'var(--go)' : r === false ? 'var(--bad)' : 'rgba(255,255,255,.6)' }} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="min-w-0 flex-1 text-center">
            <div className="f-ui truncate font-bold">{title}</div>
            {subtitle && <div className="f-small truncate text-white/65">{subtitle}</div>}
          </div>
        )}
        <div className="flex min-w-9 justify-end">{right}</div>
      </div>
      {progress && (
        <div className="-mt-1 text-center">
          <div className="f-ui font-bold">{title}</div>
          {subtitle && <div className="f-small text-white/65">{subtitle}</div>}
        </div>
      )}
    </div>
  );
  return (
    <div className="m-app fixed inset-0 z-30 flex flex-col">
      <div className="m-noscrollbar flex-1 overflow-y-auto pb-4">
        <div className="mx-auto max-w-[600px]">
          <Felt v={view} top={top} shake={!!outcome && !outcome.ok} celebrate={!!outcome?.brilliant} />
          <div className="px-5" style={{ marginTop: view.kind === 'table' ? 40 : 18 }}>
            {view.kind === 'table' && (
              <div className="f-tiny t2 mb-2 flex items-center justify-center gap-2">
                <span>You · {view.heroPos}</span>
                <span className="t3">•</span>
                <span className="f-num">{fmt(view.stackBB)} behind</span>
              </div>
            )}
            <div className="text-center">
              <div className="f-tiny c-gold">{view.kind === 'math' ? 'Pot odds' : `${STREET_NAME[view.street]} · your move`}</div>
              <div className="f-title mt-1.5">{prompt}</div>
              {view.handLabel && view.kind === 'table' && <div className="f-ui t2 mt-1">{view.handLabel}</div>}
            </div>
            <div className="mt-4">
              <History lines={view.history.map(tx)} />
            </div>
          </div>
        </div>
      </div>
      <div className="m-safe-bottom px-4 pt-3 pb-4" style={{ background: 'linear-gradient(to top, var(--bg) 80%, transparent)' }}>
        <div className="mx-auto max-w-[568px] pb-1">
          <Dock options={view.options} chosen={chosen} outcome={outcome} onChoose={choose} />
        </div>
      </div>
      {outcome && <Feedback key={view.id} id={view.id} o={outcome} onNext={onNext} nextLabel={nextLabel} real={view.real} />}
    </div>
  );
}
