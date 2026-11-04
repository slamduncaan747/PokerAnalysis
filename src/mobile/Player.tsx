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
    <div className="f-serif grid shrink-0 place-items-center rounded-full bg-[#0b2a1d] font-bold" style={{ width: size, height: size, fontSize: size * 0.38, boxShadow: 'inset 0 0 0 1px rgba(212,178,106,.55), 0 4px 10px rgba(0,0,0,.4)' }}>
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
    <div className={`m-felt m-rail relative ${shake ? 'm-shake' : ''}`} style={{ borderRadius: '0 0 44px 44px', color: 'var(--text)' }}>
      {celebrate && <Confetti />}
      <div className="m-safe-top" />
      {top}
      {v.kind === 'math' ? (
        <div className="flex flex-col items-center gap-2 px-5 pt-8 pb-12">
          <ChipPile colors={['green', 'black', 'red']} size={34} />
          <div className="f-ui mt-2" style={{ color: 'rgba(242,236,224,.7)' }}>The pot</div>
          <div className="f-hero f-num">{fmt(v.centerPotBB)}</div>
          <div className="m-pop mt-3 flex items-center gap-2 rounded-full bg-black/30 py-1.5 pr-3.5 pl-2.5">
            <ChipPile colors={['red', 'gold', 'red']} size={18} />
            <span className="f-ui font-semibold">Villain bets {fmt(v.toCallBB)}</span>
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
                  <div className="m-pop flex items-center gap-2 rounded-full bg-black/30 py-1.5 pr-3.5 pl-2.5">
                    {isBet ? <ChipPile colors={['red', 'gold', 'red']} size={18} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(242,236,224,.6)' }} />}
                    <span className="f-ui font-semibold">{v.villainAction}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="f-ui rounded-full bg-black/25 px-3.5 py-1.5 font-medium" style={{ color: 'rgba(242,236,224,.85)' }}>Folded to you</div>
            )}
          </div>
          <div className="f-head f-num mt-2" style={{ color: 'rgba(242,236,224,.92)' }}>
            Pot {fmt(v.centerPotBB)}
          </div>
          <div className="mt-3.5 flex gap-[7px]">
            {[0, 1, 2, 3, 4].map((i) =>
              v.board[i] !== undefined ? (
                <MCard key={`${v.id}-${i}`} card={v.board[i]} w={boardW} className="m-deal" style={{ ['--i' as string]: i }} />
              ) : (
                <div key={i} className="shrink-0 rounded-[7px]" style={{ width: boardW, height: Math.round(boardW * 1.42), background: 'rgba(0,0,0,.1)', boxShadow: 'inset 0 0 0 1px rgba(242,236,224,.07)' }} />
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
  const tone: BtnTone = state === 'chosen-ok' || state === 'correct' ? 'ok' : state === 'chosen-bad' ? 'bad' : 'card';
  return (
    <Btn tone={tone} onClick={onClick} disabled={state !== 'idle'} className={`keep !flex-col !gap-0 !px-2 transition-opacity ${state === 'faded' ? 'opacity-30' : ''}`} style={{ minHeight: 60 }}>
      <span className="f-num text-[16px] leading-tight font-semibold">{o.label}</span>
      {o.sub && <span className="f-num mt-0.5 text-[12.5px] font-medium" style={{ color: 'var(--text-2)' }}>{o.sub}</span>}
      {(state === 'chosen-ok' || state === 'correct') && <Check size={15} strokeWidth={3} className="m-pop absolute top-2 right-2.5" style={{ color: 'var(--go)' }} />}
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

const PRAISE = ['Well played.', 'Nicely done.', 'Good read.', 'That’s the play.', 'Spot on.'];
const MISS = ['Not quite.', 'Not this time.', 'Close, but no.'];

/** The answer: a full-width banner in the result colour. Verdict, one sentence, Continue. */
function Feedback({ o, seed, onNext, nextLabel, real }: { o: Outcome; seed: number; onNext: () => void; nextLabel: string; real?: SpotView['real'] }) {
  const { fmt } = useUnits(real);
  const [open, setOpen] = useState(false);
  const color = o.brilliant ? 'var(--gold)' : o.ok ? 'var(--go)' : 'var(--bad)';
  const bg = o.ok || o.brilliant ? 'linear-gradient(180deg,#123a29,#0c2a1e)' : 'linear-gradient(180deg,#36141a,#250d11)';
  const title = o.brilliant ? 'Brilliant.' : o.ok ? PRAISE[seed % PRAISE.length] : MISS[seed % MISS.length];
  const evs = o.bars.filter((b) => b.ev !== undefined);
  const hasMore = !!o.idea || o.bars.length > 0 || (o.lines?.length ?? 0) > 0 || o.facts.length > 0;
  return (
    <div className="m-up fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[600px]" style={{ background: bg, boxShadow: '0 -1px 0 rgba(212,178,106,.5), 0 -24px 60px rgba(0,0,0,.6)', borderRadius: '26px 26px 0 0' }}>
      <div className="m-noscrollbar max-h-[64dvh] overflow-y-auto px-6 pt-6">
        <div className="flex items-center gap-3.5">
          <div
            className="m-pop grid h-12 w-12 shrink-0 place-items-center rounded-full"
            style={
              o.ok || o.brilliant
                ? { background: 'radial-gradient(circle at 40% 35%,#ecd598,#c7a253 60%,#9c7c3c)', color: '#2a1f0a', boxShadow: '0 3px 8px rgba(0,0,0,.4), inset 0 0 0 2px rgba(255,255,255,.25)' }
                : { background: '#4a1a1e', color: 'var(--bad)', boxShadow: 'inset 0 0 0 1.5px rgba(229,135,124,.6)' }
            }
          >
            {o.brilliant ? <Sparkles size={22} strokeWidth={2.2} /> : o.ok ? <Check size={24} strokeWidth={3} /> : <X size={22} strokeWidth={3} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="f-title">{title}</div>
            {o.tag && <div className="f-small t2 mt-0.5 truncate">{o.tag}</div>}
          </div>
          {o.delta !== undefined && (
            <div className="m-pop shrink-0 text-right" style={{ ['--i' as string]: 2 }}>
              <div className="f-serif f-num text-[28px] leading-none font-bold" style={{ color: o.delta >= 0 ? 'var(--gold)' : 'var(--text-2)' }}>
                {o.delta >= 0 ? '+' : '−'}
                {Math.abs(o.delta)}
              </div>
              <div className="f-small t2">rating</div>
            </div>
          )}
        </div>
        {!o.ok && (
          <div className="f-ui mt-4">
            Best play: <span className="font-semibold" style={{ color }}>{o.bestLabel}</span>
          </div>
        )}
        {o.headline && <p className="f-body mt-3" style={{ color: 'rgba(242,236,224,.92)' }}>{o.headline}</p>}
        {open && (
          <div className="m-fade mt-4 flex flex-col gap-4 pb-1">
            {o.idea && <p className="f-ui font-normal" style={{ color: 'rgba(242,236,224,.78)' }}>{o.idea}</p>}
            {o.lines && o.lines.length > 0 && (
              <ul className="f-ui flex flex-col gap-2 font-normal" style={{ color: 'rgba(242,236,224,.78)' }}>
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
                      <span className={`f-ui truncate ${isBest ? 'font-semibold' : 't2'}`}>
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
            className="m-press f-ui mt-3 flex items-center gap-1 font-semibold"
            style={{ color: 'var(--gold)' }}
            onClick={() => {
              haptic.tap();
              setOpen((x) => !x);
            }}
          >
            {open ? 'Less' : 'Why?'} {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
        )}
      </div>
      <div className="m-safe-bottom px-6 pt-5 pb-4">
        <Btn tone="go" onClick={onNext}>
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
          className="m-press -ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{ color: 'rgba(242,236,224,.85)' }}
          onClick={() => {
            haptic.tap();
            onClose();
          }}
        >
          <X size={22} strokeWidth={2} />
        </button>
        {progress ? (
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: progress.n }, (_, i) => {
              const r = progress.results?.[i];
              return (
                <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(242,236,224,.15)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: r === undefined ? (i === progress.i ? '35%' : '0%') : '100%', background: r === true ? 'var(--gold)' : r === false ? 'var(--bad)' : 'rgba(242,236,224,.7)' }} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="min-w-0 flex-1 text-center">
            <div className="f-caps truncate" style={{ color: 'rgba(242,236,224,.8)' }}>{title}</div>
            {subtitle && <div className="f-small mt-0.5 truncate" style={{ color: 'rgba(242,236,224,.6)' }}>{subtitle}</div>}
          </div>
        )}
        <div className="flex min-w-9 shrink-0 justify-end">{right}</div>
      </div>
      {progress && (
        <div className="f-caps mt-1 text-center" style={{ color: 'rgba(242,236,224,.75)' }}>
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
              <div className="f-title" style={{ fontSize: 32 }}>{prompt}</div>
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
