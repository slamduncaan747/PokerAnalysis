import { ChevronRight, FileUp, Laptop, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { mergeProgress } from '../cloud/merge.ts';
import { haptic } from '../feedback.ts';
import { readHandFiles } from '../lib/files.ts';
import { DRILL_INFO, LEAKS, type DrillType } from '../lib/engine/leaks.ts';
import { dueCards, mastery, syncCards, type Progress } from '../lib/training/progress.ts';
import { useOwnMistakesOf } from '../lib/training/queue.ts';
import { useUnits } from '../settings.ts';
import { useStore } from '../store.ts';
import { PROGRESS_FILE } from '../transfer/device.ts';
import { Bar, MiniCards, PrimaryButton, Ring, Screen, Section } from './ui.tsx';

const DRILLS: { d: DrillType; emoji: string }[] = [
  { d: 'rfi', emoji: '🚪' },
  { d: 'vs_open', emoji: '🛡️' },
  { d: 'bb_defense', emoji: '🧱' },
  { d: 'vs_3bet', emoji: '⚔️' },
  { d: 'value', emoji: '💰' },
  { d: 'bluffcatch', emoji: '🪤' },
  { d: 'bluff', emoji: '🎭' },
  { d: 'draws', emoji: '🌊' },
  { d: 'allin', emoji: '💥' },
  { d: 'pot_odds', emoji: '🧮' },
];

/** Hand histories or a Leakfinder backup (.zip) from the Files app. */
export async function importFromFiles(list: FileList | File[]) {
  const all = await readHandFiles(list);
  for (const f of all.filter((x) => x.name.endsWith(PROGRESS_FILE))) {
    try {
      const s = useStore.getState();
      s.setProgress(mergeProgress(s.progress, JSON.parse(f.text) as Progress));
    } catch {
      /* not a progress file */
    }
  }
  const files = all.filter((x) => !/\.json$/i.test(x.name));
  if (files.length) await useStore.getState().importFiles(files);
}

export function FilePicker({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" multiple accept=".txt,.zip,.log,.json,text/plain,application/zip" className="hidden" onChange={(e) => e.target.files && void importFromFiles(e.target.files).finally(() => (e.target.value = ''))} />
      <button
        className={className}
        onClick={() => {
          haptic.press();
          ref.current?.click();
        }}
      >
        {children}
      </button>
    </>
  );
}

function ImportBanner() {
  const status = useStore((s) => s.status);
  if (status.phase !== 'parsing' && status.phase !== 'analyzing') return null;
  const pct = status.total ? status.done / status.total : 0.05;
  return (
    <div className="m-card m-fade p-4">
      <div className="mb-2 text-[15px] font-semibold">{status.phase === 'parsing' ? 'Reading hand histories…' : `Analyzing ${status.done.toLocaleString()} / ${status.total.toLocaleString()} hands`}</div>
      <Bar value={pct} />
    </div>
  );
}

function Empty() {
  const loadDemo = useStore((s) => s.loadDemo);
  return (
    <Screen title="My Game" subtitle="Your own hands">
      <ImportBanner />
      <div className="m-card m-in flex flex-col items-center px-6 pt-8 pb-6 text-center">
        <div className="relative mb-5 h-[92px] w-[130px]">
          <div className="absolute left-2 top-2 h-[84px] w-[60px] -rotate-12 rounded-[10px] bg-white shadow-xl"><div className="p-1.5 text-[22px] leading-none font-black text-[#2466d6]">Q<div className="text-[16px]">♦</div></div></div>
          <div className="absolute right-2 top-0 h-[84px] w-[60px] rotate-12 rounded-[10px] bg-white shadow-xl"><div className="p-1.5 text-[22px] leading-none font-black text-[#1a8a4a]">J<div className="text-[16px]">♣</div></div></div>
        </div>
        <h2 className="m-h2">Practice the spots you actually play</h2>
        <p className="m-sub mt-2">
          Play online (CoinPoker, PokerStars, GG…)? Import your hand histories on your computer at Leakfinder, then send them here. Every decision gets graded and your
          leaks turn into drills.
        </p>
        <div className="mt-6 flex w-full flex-col gap-2.5">
          <PrimaryButton to="/devices">
            <Laptop size={19} /> Receive from my computer
          </PrimaryButton>
          <FilePicker className="m-tap m-btn m-btn-ghost w-full">
            <FileUp size={19} /> Import a file
          </FilePicker>
          <button
            className="m-tap py-3 text-[15px] font-semibold text-accent"
            onClick={() => {
              haptic.tap();
              void loadDemo();
            }}
          >
            <Sparkles size={15} className="mr-1 inline" /> Try it with 600 demo hands
          </button>
        </div>
      </div>
      <p className="px-4 text-center text-[13px] text-dim">Don’t play online? No problem — puzzles and the Daily Hand don’t need any hands.</p>
    </Screen>
  );
}

export default function MyGame() {
  const handsN = useStore((s) => s.hands.size);
  const summary = useStore((s) => s.summary);
  const progress = useStore((s) => s.progress);
  const setProgress = useStore((s) => s.setProgress);
  const ordered = useStore((s) => s.ordered);
  const mistakes = useOwnMistakesOf(ordered);
  const { tx, fmt } = useUnits();
  useEffect(() => {
    const next = syncCards(progress, mistakes);
    if (next !== progress) setProgress(next);
  }, [mistakes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!handsN || !summary) return <Empty />;
  const due = dueCards(progress).filter((c) => mistakes.some((m) => m.qid === `own-${c.handId}-${c.actionIndex}`)).length;
  const acc = summary.accuracy ?? 0;
  return (
    <Screen title="My Game" subtitle={`${summary.hands.toLocaleString()} hands analyzed`}>
      <ImportBanner />
      <div className="m-card m-in flex items-center gap-4 p-4">
        <Ring value={acc / 100} size={76} stroke={8} color={acc >= 85 ? 'var(--color-accent)' : acc >= 75 ? '#f3c23a' : 'var(--color-loss)'}>
          <div className="text-center leading-none">
            <div className="m-num text-[20px] font-extrabold">{Math.round(acc)}</div>
            <div className="text-[10px] font-semibold text-dim">ACCURACY</div>
          </div>
        </Ring>
        <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <div className="m-label">Win rate</div>
            <div className="m-num text-[17px] font-bold" style={{ color: summary.bb100 >= 0 ? 'var(--color-accent)' : 'var(--color-loss)' }}>
              {tx(`${Math.round(summary.bb100 * 10) / 10}bb`)}<span className="text-[12px] text-dim">/100</span>
            </div>
          </div>
          <div>
            <div className="m-label">Mistakes cost</div>
            <div className="m-num text-[17px] font-bold text-[#f3a03a]">
              {fmt(summary.evLossPer100)}
              <span className="text-[12px] text-dim">/100</span>
            </div>
          </div>
          <div className="col-span-2 text-[13px] text-mute">Graded like a chess game review: every decision vs the best play.</div>
        </div>
      </div>

      <Link to="/practice?own=1&n=10" onClick={() => haptic.press()} className="m-tap m-in flex items-center gap-4 rounded-[22px] p-4" style={{ background: 'linear-gradient(135deg,#2a1c3d,#171a2a)', border: '1px solid rgba(160,120,255,.22)', ['--i' as string]: 1 }}>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-white/10 text-[24px]">🔁</div>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-bold">Review your mistakes</div>
          <div className="text-[13.5px] text-mute">{due ? `${due} due today · spaced repetition` : `${mistakes.length} spots from your hands`}</div>
        </div>
        <ChevronRight size={20} className="text-dim" />
      </Link>

      <Section title="Your biggest leaks">
        <div className="flex flex-col gap-2.5">
          {summary.leaks.slice(0, 5).map((l, i) => (
            <Link key={l.id} to={`/practice?leak=${l.id}&n=8`} onClick={() => haptic.tap()} className="m-tap m-card m-in flex items-center gap-3 p-4" style={{ ['--i' as string]: i + 2 }}>
              <div className="m-num grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[.06] text-[15px] font-black text-mute">{i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15.5px] font-bold">{LEAKS[l.id].title}</div>
                <div className="m-num text-[13px] text-mute">
                  {l.count} spots · {tx(`${Math.round(l.per100 * 10) / 10}bb`)}/100
                </div>
              </div>
              <span className="rounded-full bg-accent/15 px-3 py-1.5 text-[13px] font-bold text-accent">Practice</span>
            </Link>
          ))}
          {summary.leaks.length === 0 && <div className="m-card px-4 py-6 text-center text-mute">No recurring leaks found. Nice!</div>}
        </div>
      </Section>

      <Section title="Drills">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {DRILLS.map(({ d, emoji }, i) => {
            const m = mastery(progress, d);
            return (
              <Link key={d} to={`/practice?drill=${d}&n=10`} onClick={() => haptic.tap()} className="m-tap m-card m-in flex flex-col gap-1 p-3.5" style={{ ['--i' as string]: i }}>
                <span className="text-[24px]">{emoji}</span>
                <span className="text-[14.5px] leading-tight font-bold">{DRILL_INFO[d].title}</span>
                <span className="m-num mt-0.5 text-[12px] text-dim">{m.attempts ? `Mastery ${m.score}%` : 'Not started'}</span>
                <Bar value={m.score / 100} h={4} />
              </Link>
            );
          })}
        </div>
      </Section>

      <Section title="Costliest hands">
        <div className="m-card divide-y divide-white/[.06] overflow-hidden">
          {summary.worstHands.slice(0, 6).map((w) => {
            const a = ordered.find((x) => x.handId === w.handId);
            return (
              <Link key={w.handId} to={`/hand/${encodeURIComponent(w.handId)}`} onClick={() => haptic.tap()} className="m-tap flex items-center gap-3 px-4 py-3">
                {a && <MiniCards cards={a.heroCards} w={24} />}
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold">{a?.heroPosition ?? ''} · lost {fmt(w.loss)} to mistakes</div>
                  <div className="m-num text-[12.5px] text-dim">Result {w.netBB >= 0 ? '+' : '−'}{fmt(Math.abs(w.netBB))}</div>
                </div>
                <ChevronRight size={18} className="text-dim" />
              </Link>
            );
          })}
        </div>
      </Section>

      <div className="flex gap-2.5">
        <PrimaryButton to="/devices" tone="ghost" className="flex-1 !text-[15px]">
          <Laptop size={17} /> Sync
        </PrimaryButton>
        <FilePicker className="m-tap m-btn m-btn-ghost flex-1 !text-[15px]">
          <FileUp size={17} /> Import
        </FilePicker>
      </div>
      <p className="px-4 text-center text-[13px] text-dim">Full stats, filters, the hand replayer and the GTO solver live on the web version on your computer.</p>
    </Screen>
  );
}
