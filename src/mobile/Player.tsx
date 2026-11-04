import { Check, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { haptic, sound } from '../feedback.ts';
import { useUnits } from '../settings.ts';
import type { Outcome, SpotView, ViewOption } from './spot.ts';
import { Btn, ChipPile, Confetti, MCard, type BtnTone } from './ui.tsx';

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

/** A position puck on the felt (villain's seat, and yours). */
function Puck({ pos, size = 46 }: { pos: string; size?: number }) {
  return (
    <div className="grid shrink-0 place-items-center rounded-full bg-[#0b2b1d] font-extrabold" style={{ width: size, height: size, fontSize: size * 0.3, boxShadow: '0 0 0 2px rgba(255,255,255,.18), 0 4px 10px rgba(0,0,0,.35)' }}>
      {pos}
    </div>
  );
}

/**
 * The felt, edge to edge, always the same height so nothing jumps between puzzles:
 * villain seat, pot, board, then your cards resting on the rail.
 */
function Felt({ v, top, shake, celebrate }: { v: SpotView; top: ReactNode; shake?: boolean; celebrate?: boolean }) {
  const { fmt } = useUnits(v.real);
  const vw = useViewportWidth();
  const boardW = Math.max(44, Math.min(64, Math.floor((vw - 40 - 4 * 7) / 5)));
  const heroW = Math.min(100, Math.round(boardW * 1.5));
  const isBet = !!v.villainAction && !/^check/i.test(v.villainAction);
  return (
    <div className={`m-felt m-rail relative text-white ${shake ? 'm-shake' : ''}`} style={{ borderRadius: '0 0 40px 40px' }}>
      {celebrate && <Confetti />}
      <div className="m-safe-top" />
      {top}
      {v.kind === 'math' ? (
        <div className="flex flex-col items-center gap-2 px-5 pt-8 pb-12">
          <ChipPile colors={['green', 'black', 'red']} size={34} />
          <div className="f-ui mt-2 text-white/70">The pot</div>
          <div className="f-hero f-num">{fmt(v.centerPotBB)}</div>
          <div className="m-pop mt-3 flex items-center gap-2 rounded-full bg-black/35 py-1.5 pr-3.5 pl-2">
            <ChipPile colors={['gold', 'red']} size={20} />
            <span className="f-ui font-bold">Villain bets {fmt(v.toCallBB)}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center px-5">
          <div className="mt-3 flex h-[60px] items-center justify-center gap-3">
            {v.villainPos ? (
              <>
                <div className="relative">
                  <div className="absolute -top-3.5 left-1/2 flex -translate-x-1/2">
                    <MCard hidden w={20} style={{ transform: 'rotate(-10deg)' }} />
                    <MCard hidden w={20} style={{ marginLeft: -9, transform: 'rotate(10deg)' }} />
                  </div>
                  <Puck pos={v.villainPos} />
                </div>
                {v.villainAction && (
                  <div className="m-pop flex items-center gap-2 rounded-full bg-black/35 py-1.5 pr-3.5 pl-2">
                    {isBet ? <ChipPile colors={['gold', 'red']} size={20} /> : <span className="ml-1 h-2 w-2 rounded-full bg-white/60" />}
                    <span className="f-ui font-bold">{v.villainAction}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="f-ui rounded-full bg-black/25 px-3.5 py-1.5 font-semibold text-white/85">Folded to you</div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-full bg-black/30 py-1.5 pr-3.5 pl-2">
            <ChipPile colors={['green', 'black', 'red']} size={20} />
            <span className="f-ui f-num font-bold">Pot {fmt(v.centerPotBB)}</span>
          </div>
          <div className="mt-3.5 flex gap-[7px]">
            {[0, 1, 2, 3, 4].map((i) =>
              v.board[i] !== undefined ? (
                <MCard key={`${v.id}-${i}`} card={v.board[i]} w={boardW} className="m-deal" style={{ ['--i' as string]: i }} />
              ) : (
                <div key={i} className="shrink-0 rounded-[8px]" style={{ width: boardW, height: Math.round(boardW * 1.4), background: 'rgba(0,0,0,.1)', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.06)' }} />
              ),
            )}
          </div>
          <div className="relative z-10 mt-4 flex items-end" style={{ marginBottom: -Math.round(heroW * 0.32) }}>
            <div className="absolute -left-14 bottom-[34%]">
              <Puck pos={v.heroPos} size={40} />
            </div>
            <MCard card={v.heroCards[0]} w={heroW} className="m-deal" style={{ transform: 'rotate(-6deg)', ['--i' as string]: 5, ['--dx' as string]: '-20px' }} />
            <MCard card={v.heroCards[1]} w={heroW} className="m-deal" style={{ marginLeft: -Math.round(heroW * 0.18), transform: 'rotate(6deg) translateY(2px)', ['--i' as string]: 6, ['--dx' as string]: '20px' }} />
          </div>
        </div>
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
            <div key={i} className="f-small flex gap-3 font-normal">
              {m && <span className="t3 w-[52px] shrink-0 font-semibold">{m[1]}</span>}
              <span className="t2">
                {(m ? m[2] : l).split(' · ').map((p, k) => (
                  <span key={k}>
                    {k > 0 && ', '}
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
          {open ? 'Hide earlier streets' : 'Show the whole hand'} {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      )}
    </div>
  );
}

type OptState = 'idle' | 'chosen-ok' | 'chosen-bad' | 'correct' | 'faded';

function OptionButton({ o, state, onClick }: { o: ViewOption; state: OptState; onClick: () => void }) {
  const tone: BtnTone = state === 'chosen-ok' || state === 'correct' ? 'go' : state === 'chosen-bad' ? 'bad' : 'card';
  return (
    <Btn tone={tone} onClick={onClick} disabled={state !== 'idle'} className={`keep !flex-col !gap-0 !px-2 transition-opacity ${state === 'faded' ? 'opacity-30' : ''}`} style={{ minHeight: 60 }}>
      <span className="f-num text-[17px] leading-tight">{o.label}</span>
      {o.sub && <span className="f-num mt-0.5 text-[13px] font-medium opacity-65">{o.sub}</span>}
      {(state === 'chosen-ok' || state === 'correct') && <Check size={16} strokeWidth={3.4} className="m-pop absolute top-1.5 right-2" />}
    </Btn>
  );
}

/** Every option looks the same until you choose — nothing hints at the answer. */
function Dock({ options, chosen, outcome, onChoose }: { options: ViewOption[]; chosen: string | null; outcome: Outcome | null; onChoose: (k: string) => void }) {
  const stateOf = (o: ViewOption): OptState => {
    if (!chosen || !outcome) return 'idle';
    if (o.key === chosen) return outcome.ok ? 'chosen-ok' : 'chosen-bad';
    if (outcome.correctKeys.includes(o.key)) return 'correct';
    return 'faded';
  };
  const order = (o: ViewOption) => (o.group === 'choice' ? 0 : o.tone === 'fold' ? 0 : o.group === 'passive' ? 1 : 2);
  const sorted = [...options].sort((a, b) => order(a) - order(b));
  const cols = sorted.length <= 3 ? sorted.length : sorted.length === 4 ? 2 : 3;
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {sorted.map((o) => (
        <OptionButton key={o.key} o={o} state={stateOf(o)} onClick={() => onChoose(o.key)} />
      ))}
    </div>
  );
}

const PRAISE = ['Nailed it!', 'Sharp!', 'Great read!', 'That’s the play!', 'Spot on!'];
const MISS = ['Not quite', 'So close', 'Tough one'];

/** The answer: a full-width banner in the result colour. Verdict, one sentence, Continue. */
function Feedback({ o, seed, onNext, nextLabel, real }: { o: Outcome; seed: number; onNext: () => void; nextLabel: string; real?: SpotView['real'] }) {
  const { fmt } = useUnits(real);
  const [open, setOpen] = useState(false);
  const color = o.brilliant ? 'var(--gold)' : o.ok ? 'var(--go)' : 'var(--bad)';
  const bg = o.brilliant ? '#2a2210' : o.ok ? 'var(--go-bg)' : 'var(--bad-bg)';
  const title = o.brilliant ? 'Brilliant!' : o.ok ? PRAISE[seed % PRAISE.length] : MISS[seed % MISS.length];
  const evs = o.bars.filter((b) => b.ev !== undefined);
  const hasMore = !!o.idea || o.bars.length > 0 || (o.lines?.length ?? 0) > 0 || o.facts.length > 0;
  return (
    <div className="m-up fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[600px]" style={{ background: bg, boxShadow: `0 -2px 0 ${color}, 0 -20px 50px rgba(0,0,0,.5)`, borderRadius: '24px 24px 0 0' }}>
      <div className="m-noscrollbar max-h-[64dvh] overflow-y-auto px-5 pt-5">
        <div className="flex items-center gap-3">
          <div className="m-pop grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: color, color: o.brilliant ? 'var(--gold-ink)' : o.ok ? 'var(--go-ink)' : '#fff' }}>
            {o.brilliant ? <Sparkles size={22} strokeWidth={2.6} /> : o.ok ? <Check size={24} strokeWidth={3.4} /> : <X size={24} strokeWidth={3.4} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="f-title font-extrabold" style={{ color }}>
              {title}
            </div>
            {o.tag && <div className="f-small t2 truncate">{o.tag}</div>}
          </div>
          {o.delta !== undefined && (
            <span className="m-pop f-num shrink-0 rounded-full px-3 py-1 text-[18px] font-extrabold" style={{ ['--i' as string]: 2, background: o.delta >= 0 ? 'var(--gold)' : 'rgba(255,255,255,.1)', color: o.delta >= 0 ? 'var(--gold-ink)' : 'var(--text-2)' }}>
              {o.delta >= 0 ? '+' : '−'}
              {Math.abs(o.delta)}
            </span>
          )}
        </div>
        {!o.ok && (
          <div className="f-ui mt-3">
            Best play: <span className="font-bold">{o.bestLabel}</span>
          </div>
        )}
        {o.headline && <p className="f-body mt-2 font-medium text-white/90">{o.headline}</p>}
        {open && (
          <div className="m-fade mt-4 flex flex-col gap-4 pb-1">
            {o.idea && <p className="f-ui font-normal text-white/80">{o.idea}</p>}
            {o.lines && o.lines.length > 0 && (
              <ul className="f-ui flex flex-col gap-2 font-normal text-white/80">
                {o.lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
            {o.bars.length > 0 && (
              <div className="overflow-hidden rounded-[14px] bg-black/20">
                {o.bars.map((b, i) => {
                  const isBest = o.correctKeys.includes(b.key);
                  return (
                    <div key={b.key} className="flex items-center justify-between gap-3 px-3.5 py-2.5" style={i ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)' } : undefined}>
                      <span className={`f-ui truncate ${isBest ? 'font-bold' : 'text-white/75'}`}>
                        {isBest && <Check size={15} strokeWidth={3.2} className="mr-1.5 -mt-0.5 inline" style={{ color: 'var(--go)' }} />}
                        {b.label}
                        {b.key === o.chosenKey && <span className="t2 font-medium"> · your pick</span>}
                      </span>
                      <span className="f-ui f-num shrink-0 font-bold" style={{ color: isBest ? 'var(--go)' : 'var(--text-2)' }}>
                        {evs.length ? (b.ev !== undefined ? `${b.ev >= 0 ? '+' : '−'}${fmt(Math.abs(b.ev))}` : '') : b.freq !== undefined ? `${Math.round(b.freq * 100)}%` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {o.bars.length > 0 && <p className="f-small t3 -mt-2">{evs.length ? (o.barSource === 'solver' ? 'What each play wins on average, from the GTO solver for your exact hand.' : 'What each play wins on average.') : 'How often a solid player makes each play with this hand.'}</p>}
            {o.facts.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {o.facts.map((f) => (
                  <div key={f.label} className="f-ui flex justify-between gap-4 font-normal">
                    <span className="t2">{f.label}</span>
                    <span className="text-right font-semibold">{f.value}</span>
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
        <Btn tone={o.brilliant || o.ok ? 'go' : 'bad'} onClick={onNext}>
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
  const seed = [...view.id].reduce((s, c) => s + c.charCodeAt(0), 0);
  const top = (
    <div className="w-full px-4">
      <div className="flex h-[52px] items-center gap-3">
        <button
          aria-label="Close"
          className="m-press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/25"
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
        <div className="flex min-w-9 shrink-0 justify-end">{right}</div>
      </div>
      {progress && (
        <div className="f-small -mt-1 text-center font-semibold text-white/75">
          {title}
          {subtitle ? ` · ${subtitle}` : ''}
        </div>
      )}
    </div>
  );
  return (
    <div className="m-app fixed inset-0 z-30 flex flex-col">
      <div className="m-noscrollbar flex-1 overflow-y-auto pb-4">
        <div className="mx-auto max-w-[600px]">
          <Felt v={view} top={top} shake={!!outcome && !outcome.ok} celebrate={!!outcome?.brilliant} />
          <div className="px-5" style={{ marginTop: view.kind === 'table' ? 48 : 20 }}>
            <div className="text-center">
              <div className="f-title">{prompt}</div>
              <div className="f-ui t2 mt-1">{[view.kind === 'math' ? undefined : STREET_NAME[view.street], view.kind === 'table' ? view.handLabel : undefined].filter(Boolean).join(' · ')}</div>
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
      {outcome && <Feedback key={view.id} seed={seed} o={outcome} onNext={onNext} nextLabel={nextLabel} real={view.real} />}
    </div>
  );
}
