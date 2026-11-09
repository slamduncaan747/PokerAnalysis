import { Check, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { haptic, sound } from '../feedback.ts';
import { useUnits } from '../settings.ts';
import type { Outcome, SpotView, ViewOption } from './spot.ts';
import { Btn, ChipPile, Confetti, MCard, type BtnTone } from './ui.tsx';

function useViewport() {
  const read = () => {
    if (typeof window === 'undefined') return { w: 390, h: 844 };
    // Usable height: the screen minus the notch and the home indicator.
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:var(--sat);padding-bottom:var(--sab)';
    document.body.appendChild(probe);
    const ps = getComputedStyle(probe);
    const safe = (parseFloat(ps.paddingTop) || 0) + (parseFloat(ps.paddingBottom) || 0);
    probe.remove();
    return { w: Math.min(window.innerWidth, 560), h: window.innerHeight - safe };
  };
  const [v, setV] = useState(read);
  useEffect(() => {
    const on = () => setV(read());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return v;
}

const STREET_NAME: Record<string, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' };

/** A seat marker on the felt. */
function Puck({ pos, you = false }: { pos: string; you?: boolean }) {
  return (
    <div className="f-disp grid h-[42px] min-w-[42px] shrink-0 place-items-center rounded-full px-2 text-[15px] font-extrabold" style={you ? { background: '#fff', color: '#0a0b0d' } : { background: 'rgba(0,0,0,.42)', color: '#fff' }}>
      {pos}
    </div>
  );
}

function Bubble({ children, chips }: { children: ReactNode; chips?: boolean }) {
  return (
    <div className="m-pop flex h-[38px] items-center gap-2 rounded-full pr-4 pl-3 text-[15px] font-bold" style={{ background: 'rgba(0,0,0,.42)', color: '#fff' }}>
      {chips ? <ChipPile colors={['red', 'gold', 'red']} size={18} /> : <span className="ml-1 h-1.5 w-1.5 rounded-full bg-white/60" />}
      <span className="f-num">{children}</span>
    </div>
  );
}

/**
 * The table: a railed felt that fills the top of the screen. Villain across from you,
 * the pot and board in the middle, your cards in front of you.
 */
function Felt({ v, h, shake, celebrate }: { v: SpotView; h: number; shake?: boolean; celebrate?: boolean }) {
  const { fmt } = useUnits(v.real);
  const { w: vw } = useViewport();
  const scale = Math.min(1, h / 372);
  const boardW = Math.round(Math.max(40, Math.min(60 * scale, (vw - 24 - 16 - 28 - 4 * 6) / 5)));
  const heroW = Math.round(boardW * 1.3);
  const isBet = !!v.villainAction && !/^check/i.test(v.villainAction);
  return (
    <div className={`m-rail relative ${shake ? 'm-shake' : ''}`} style={{ borderRadius: 44, height: h }}>
      {celebrate && <Confetti />}
      <div className="m-felt relative flex h-full flex-col items-center" style={{ borderRadius: 36, color: '#fff' }}>
        {v.kind === 'math' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
            <ChipPile colors={['green', 'black', 'red', 'gold']} size={44} />
            <div className="mt-3 text-[13px] font-bold tracking-[.08em] text-white/70 uppercase">Pot</div>
            <div className="f-hero f-num">{fmt(v.centerPotBB)}</div>
            <div className="mt-4">
              <Bubble chips>Villain bets {fmt(v.toCallBB)}</Bubble>
            </div>
          </div>
        ) : (
          <>
            <div className="flex h-[42px] items-center justify-center gap-2" style={{ marginTop: Math.round(16 * scale) }}>
              {v.villainPos ? (
                <>
                  <div className="mr-0.5 flex">
                    <MCard hidden w={24} style={{ transform: 'rotate(-7deg)' }} />
                    <MCard hidden w={24} style={{ marginLeft: -10, transform: 'rotate(7deg)' }} />
                  </div>
                  <Puck pos={v.villainPos} />
                  {v.villainAction && <Bubble chips={isBet}>{v.villainAction}</Bubble>}
                </>
              ) : (
                <div className="grid h-[38px] place-items-center rounded-full px-4 text-[15px] font-bold" style={{ background: 'rgba(0,0,0,.42)' }}>
                  Folded to you
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col items-center justify-center">
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] font-bold tracking-[.08em] text-white/65 uppercase">Pot</span>
                <span className="f-disp f-num text-[22px] leading-none font-extrabold">{fmt(v.centerPotBB)}</span>
              </div>
              <div className="mt-2.5 flex gap-[6px]">
                {[0, 1, 2, 3, 4].map((i) =>
                  v.board[i] !== undefined ? (
                    <MCard key={`${v.id}-${i}`} card={v.board[i]} w={boardW} className="m-deal" style={{ ['--i' as string]: i }} />
                  ) : (
                    <div key={i} className="shrink-0" style={{ width: boardW, height: Math.round(boardW * 1.4), borderRadius: Math.round(boardW * 0.14), background: 'rgba(0,0,0,.13)' }} />
                  ),
                )}
              </div>
            </div>
            <div className="relative z-10 flex items-end" style={{ marginBottom: -14 }}>
              <div className="absolute bottom-[26px]" style={{ right: `calc(100% + 12px)` }}>
                <Puck pos={v.heroPos} you />
              </div>
              <MCard card={v.heroCards[0]} w={heroW} className="m-deal" style={{ transform: 'rotate(-5deg)', ['--i' as string]: 5, ['--dx' as string]: '-20px' }} />
              <MCard card={v.heroCards[1]} w={heroW} className="m-deal" style={{ marginLeft: -Math.round(heroW * 0.16), transform: 'rotate(5deg) translateY(2px)', ['--i' as string]: 6, ['--dx' as string]: '20px' }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function History({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  // One line only repeats what the table already shows.
  if (lines.length < 2) return null;
  const shown = open ? lines : lines.slice(-1);
  const many = lines.length > 1;
  const body = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {shown.map((l, i) => {
          const m = /^(Preflop|Flop|Turn|River):\s*(.*)$/.exec(l);
          return (
            <div key={i} className="flex gap-2.5 text-[14px] leading-snug">
              {m && <span className="t3 w-[54px] shrink-0 font-semibold">{m[1]}</span>}
              <span className={`t2 min-w-0 ${open ? '' : 'truncate'}`}>
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
      {many && <span className="t3 shrink-0">{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>}
    </>
  );
  const cls = 'flex w-full items-center gap-2 rounded-[16px] px-4 py-3 text-left';
  if (!many) return <div className={cls} style={{ background: 'var(--s1)' }}>{body}</div>;
  return (
    <button
      aria-label={open ? 'Hide earlier streets' : 'Show the whole hand'}
      className={`m-press ${cls}`}
      style={{ background: 'var(--s1)' }}
      onClick={() => {
        haptic.tap();
        setOpen((x) => !x);
      }}
    >
      {body}
    </button>
  );
}

type OptState = 'idle' | 'chosen-ok' | 'chosen-bad' | 'correct' | 'faded';

function OptionButton({ o, state, onClick }: { o: ViewOption; state: OptState; onClick: () => void }) {
  const tone: BtnTone = state === 'chosen-ok' ? 'ok' : state === 'chosen-bad' ? 'bad' : 'card';
  const correct = state === 'correct';
  return (
    <Btn
      tone={tone}
      onClick={onClick}
      disabled={state !== 'idle'}
      className={`keep !flex-col !gap-0 !px-2 transition-opacity ${state === 'faded' ? 'opacity-30' : ''}`}
      style={{ minHeight: 64, ...(correct ? { boxShadow: 'inset 0 0 0 2px var(--go)', color: 'var(--go)' } : {}) }}
    >
      <span className="f-num text-[17px] leading-tight font-bold">{o.label.replace(/^All-in$/i, 'All in')}</span>
      {o.sub && <span className="f-num mt-0.5 text-[13px] font-semibold opacity-65">{o.sub.replace(/^\((.*)\)$/, '$1')}</span>}
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

const PRAISE = ['Well played!', 'Nicely done!', 'Good read!', 'That’s the play!', 'Spot on!'];
const MISS = ['Not quite.', 'Not this time.', 'Close, but no.'];

/** The answer: a sheet in the result colour. Verdict, one sentence, Continue. */
function Feedback({ o, seed, onNext, nextLabel, real }: { o: Outcome; seed: number; onNext: () => void; nextLabel: string; real?: SpotView['real'] }) {
  const { fmt } = useUnits(real);
  const [open, setOpen] = useState(false);
  const good = o.ok || !!o.brilliant;
  const color = o.brilliant ? 'var(--gold)' : o.ok ? 'var(--go)' : 'var(--bad)';
  const bg = o.brilliant ? '#2a2008' : o.ok ? 'var(--go-bg)' : 'var(--bad-bg)';
  const title = o.brilliant ? 'Brilliant!' : o.ok ? PRAISE[seed % PRAISE.length] : MISS[seed % MISS.length];
  const evs = o.bars.filter((b) => b.ev !== undefined);
  const hasMore = !!o.idea || o.bars.length > 0 || (o.lines?.length ?? 0) > 0 || o.facts.length > 0;
  return (
    <div className="m-up fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[600px]" style={{ background: bg, boxShadow: '0 -20px 50px rgba(0,0,0,.55)', borderRadius: '28px 28px 0 0' }}>
      <div className="m-noscrollbar max-h-[62dvh] overflow-y-auto px-5 pt-5 pb-1">
        <div className="flex items-center gap-3">
          <div className="m-pop grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: color, color: o.brilliant ? '#2b1c00' : good ? 'var(--go-ink)' : 'var(--bad-ink)' }}>
            {o.brilliant ? <Sparkles size={22} strokeWidth={2.6} /> : o.ok ? <Check size={25} strokeWidth={3.4} /> : <X size={23} strokeWidth={3.4} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="f-title" style={{ color }}>{title}</div>
            {o.tag && <div className="f-small mt-0.5 truncate text-white/60">{o.tag}</div>}
          </div>
          {o.delta !== undefined && (
            <div className="m-pop f-disp f-num grid h-10 shrink-0 place-items-center rounded-full px-3.5 text-[19px] font-extrabold" style={{ ['--i' as string]: 2, background: 'rgba(255,255,255,.1)', color: o.delta >= 0 ? color : '#fff' }}>
              {o.delta >= 0 ? '+' : '−'}
              {Math.abs(o.delta)}
            </div>
          )}
        </div>
        {!o.ok && (
          <div className="mt-4 text-[16px] text-white/70">
            Best play: <span className="font-bold text-white">{o.bestLabel}</span>
          </div>
        )}
        {o.headline && !(open && o.idea) && <p className={`f-body text-white/90 ${o.ok ? 'mt-4' : 'mt-1.5'}`}>{o.headline}</p>}
        {open && (
          <div className="m-fade mt-4 flex flex-col gap-4 pb-1">
            {o.idea && <p className="f-body text-white/90">{o.idea}</p>}
            {o.lines && o.lines.length > 0 && (
              <ul className="f-ui flex flex-col gap-2 font-normal text-white/75">
                {o.lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
            {o.bars.length > 0 && (
              <div className="overflow-hidden rounded-[16px] bg-black/25">
                {o.bars.map((b, i) => {
                  const isBest = o.correctKeys.includes(b.key);
                  return (
                    <div key={b.key} className="flex items-center justify-between gap-3 px-4 py-3" style={i ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07)' } : undefined}>
                      <span className={`f-ui truncate ${isBest ? 'font-bold' : 'text-white/70'}`}>
                        {isBest && <Check size={16} strokeWidth={3.4} className="mr-1.5 -mt-0.5 inline" style={{ color: 'var(--go)' }} />}
                        {b.label}
                        {b.key === o.chosenKey && <span className="font-medium text-white/50"> · your pick</span>}
                      </span>
                      <span className="f-ui f-num shrink-0 font-bold" style={{ color: isBest ? 'var(--go)' : 'rgba(255,255,255,.7)' }}>
                        {evs.length ? (b.ev !== undefined ? `${b.ev >= 0 ? '+' : '−'}${fmt(Math.abs(b.ev))}` : '') : b.freq !== undefined ? `${Math.round(b.freq * 100)}%` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {o.bars.length > 0 && <p className="f-small -mt-2 font-normal text-white/50">{evs.length ? (o.barSource === 'solver' ? 'What each play wins on average, from the GTO solver for your exact hand.' : 'What each play wins on average.') : 'How often a solid player makes each play with this hand.'}</p>}
            {o.facts.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {o.facts.map((f) => (
                  <div key={f.label} className={`f-ui font-normal ${f.value.length > 14 ? 'flex flex-col gap-0.5 pt-1' : 'flex justify-between gap-4'}`}>
                    <span className="text-white/60">{f.label}</span>
                    <span className="font-semibold">{f.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {hasMore && (
          <button
            className="m-press mt-3 flex h-9 items-center gap-1 rounded-full pr-2.5 pl-3.5 text-[15px] font-bold"
            style={{ background: 'rgba(255,255,255,.1)', color: '#fff' }}
            onClick={() => {
              haptic.tap();
              setOpen((x) => !x);
            }}
          >
            {open ? 'Less' : 'Why?'} {open ? <ChevronUp size={17} strokeWidth={2.6} /> : <ChevronDown size={17} strokeWidth={2.6} />}
          </button>
        )}
      </div>
      <div className="m-safe-bottom px-5 pt-5 pb-4">
        <Btn tone={o.brilliant ? 'gold' : o.ok ? 'ok' : 'bad'} onClick={onNext}>
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
  const { h: vh } = useViewport();
  const rows = view.options.length > 3 ? 2 : 1;
  const room = vh - 56 - 196 - (rows * 72 + 28);
  const tableH = Math.round(Math.max(250, Math.min(470, room)));
  // On a short screen the table and the buttons come first.
  const tight = room < 250;
  const label = [title, subtitle].filter(Boolean).join(' · ');
  return (
    <div className="m-app fixed inset-0 z-30 flex flex-col">
      <div className="m-safe-top" />
      <div className="mx-auto flex h-[56px] w-full max-w-[600px] shrink-0 items-center gap-3 px-4">
        <button
          aria-label="Close"
          className="m-press grid h-10 w-10 shrink-0 place-items-center rounded-full"
          style={{ background: 'var(--s1)' }}
          onClick={() => {
            haptic.tap();
            onClose();
          }}
        >
          <X size={21} strokeWidth={2.6} />
        </button>
        {progress ? (
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: progress.n }, (_, i) => {
              const r = progress.results?.[i];
              return (
                <div key={i} className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--s2)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: r === undefined ? (i === progress.i ? '40%' : '0%') : '100%', background: r === true ? 'var(--go)' : r === false ? 'var(--bad)' : '#fff' }} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-[16px] leading-tight font-bold">{title}</div>
            {subtitle && <div className="f-small t2 truncate">{subtitle}</div>}
          </div>
        )}
        <div className="flex min-w-10 shrink-0 justify-end">{right}</div>
      </div>
      <div className="m-noscrollbar flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[600px] flex-col">
          <div className="px-3 pt-1">
            <Felt v={view} h={tableH} shake={!!outcome && !outcome.ok} celebrate={!!outcome?.brilliant} />
          </div>
          <div className="flex flex-1 flex-col justify-center px-5 pb-3" style={{ paddingTop: view.kind === 'table' ? 26 : 16 }}>
            <div className="text-center">
              {progress && <div className="f-caps mb-1.5">{label}</div>}
              <div className="f-title" style={{ fontSize: prompt.length > 26 ? 23 : 27 }}>{prompt}</div>
              <div className="f-ui t2 mt-1">{[view.kind === 'math' ? undefined : STREET_NAME[view.street], view.kind === 'table' ? view.handLabel : undefined].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="mt-3.5">
              {!tight && <History lines={view.history.map(tx).filter((l) => !/:\s*—\s*$/.test(l))} />}
            </div>
          </div>
        </div>
      </div>
      <div className="m-safe-bottom px-4 pt-2 pb-4">
        <div className="mx-auto max-w-[568px] pb-1">
          <Dock options={view.options} chosen={chosen} outcome={outcome} onChoose={choose} />
        </div>
      </div>
      {outcome && <Feedback key={view.id} seed={seed} o={outcome} onNext={onNext} nextLabel={nextLabel} real={view.real} />}
    </div>
  );
}
