import { ArrowRight, FileUp, Laptop } from 'lucide-react';
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
import { Bar, MCard, MiniCards, PrimaryButton, Ring, Screen, Section } from './ui.tsx';

const DRILLS: DrillType[] = ['rfi', 'vs_open', 'bb_defense', 'vs_3bet', 'value', 'bluffcatch', 'bluff', 'draws', 'allin', 'pot_odds'];

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
      <div className="m-label m-live mb-2.5">{status.phase === 'parsing' ? 'Reading hand histories' : `Grading ${status.done.toLocaleString()} / ${status.total.toLocaleString()} hands`}</div>
      <Bar value={pct} color="var(--signal)" />
    </div>
  );
}

function Empty() {
  const loadDemo = useStore((s) => s.loadDemo);
  return (
    <Screen eyebrow="Your own hands" title="My Game">
      <ImportBanner />
      <div className="m-card m-in overflow-hidden">
        <div className="m-felt flex h-[150px] items-center justify-center rounded-none">
          <div className="flex">
            <MCard card={51} w={62} style={{ transform: 'rotate(-9deg) translateY(4px)' }} />
            <MCard card={46} w={62} style={{ marginLeft: -14, transform: 'rotate(7deg)' }} />
          </div>
        </div>
        <div className="p-5">
          <div className="m-serif text-[30px] leading-[1.02]">Practice the spots you actually play.</div>
          <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--mute)]">
            Play on CoinPoker, Stars, GG? Import your hand histories at Leakfinder on your computer and send them here. Every decision gets graded, and your leaks turn into drills.
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            <PrimaryButton to="/devices">
              <Laptop size={18} /> Receive from my computer
            </PrimaryButton>
            <FilePicker className="m-tap m-btn m-btn-ghost w-full">
              <FileUp size={18} /> Import a file
            </FilePicker>
            <button
              className="m-tap m-mono py-3 text-[12px] tracking-wider text-[var(--signal)] uppercase"
              onClick={() => {
                haptic.tap();
                void loadDemo();
              }}
            >
              Try it with 600 demo hands →
            </button>
          </div>
        </div>
      </div>
      <p className="m-mono px-2 text-center text-[11px] leading-relaxed tracking-wide text-[var(--dim)] uppercase">No hands? No problem. Puzzles and the Daily Hand work without them.</p>
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
    <Screen eyebrow={`${summary.hands.toLocaleString()} hands graded`} title="My Game">
      <ImportBanner />
      <div className="m-card m-in grid grid-cols-[auto_1fr] items-center gap-5 p-5">
        <Ring value={acc / 100} size={88} stroke={6} color={acc >= 85 ? 'var(--win)' : acc >= 75 ? 'var(--gold)' : 'var(--loss)'}>
          <div className="text-center leading-none">
            <div className="m-num text-[26px] font-medium">{Math.round(acc)}</div>
            <div className="m-label mt-1 !text-[9px]">Accuracy</div>
          </div>
        </Ring>
        <div className="flex flex-col gap-3">
          <div>
            <div className="m-label">Win rate</div>
            <div className={`m-num text-[20px] font-medium ${summary.bb100 >= 0 ? 'm-win' : 'm-loss'}`}>
              {tx(`${Math.round(summary.bb100 * 10) / 10}bb`)}
              <span className="text-[12px] text-[var(--dim)]"> /100</span>
            </div>
          </div>
          <div>
            <div className="m-label">Mistakes cost</div>
            <div className="m-num text-[20px] font-medium text-[var(--signal)]">
              {fmt(summary.evLossPer100)}
              <span className="text-[12px] text-[var(--dim)]"> /100</span>
            </div>
          </div>
        </div>
      </div>

      <Link to="/practice?own=1&n=10" onClick={() => haptic.press()} className="m-tap m-in block" style={{ ['--i' as string]: 1 }}>
        <div className="m-paper rounded-[18px] p-5">
          <div className="flex items-center justify-between">
            <span className="m-label !text-[#5c574e]">Spaced repetition</span>
            <span className="m-mono text-[12px] font-semibold">{due ? `${due} DUE` : `${mistakes.length} SPOTS`}</span>
          </div>
          <div className="mt-1.5 flex items-end justify-between gap-3">
            <div className="m-serif text-[32px] leading-none">Review your mistakes.</div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[var(--signal)]">
              <ArrowRight size={18} />
            </span>
          </div>
        </div>
      </Link>

      <Section kicker="Ranked by what they cost" title="Your leaks">
        <div className="m-card m-divide overflow-hidden">
          {summary.leaks.slice(0, 5).map((l, i) => (
            <Link key={l.id} to={`/practice?leak=${l.id}&n=8`} onClick={() => haptic.tap()} className="m-tap flex items-center gap-4 px-4 py-3.5">
              <span className="m-serif w-7 text-[28px] leading-none text-[var(--dim)]">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15.5px] font-semibold">{LEAKS[l.id].title}</div>
                <div className="m-mono text-[11.5px] text-[var(--mute)]">
                  {l.count} spots · {tx(`−${Math.round(l.per100 * 10) / 10}bb`)}/100
                </div>
              </div>
              <span className="m-mono text-[11px] tracking-wider text-[var(--signal)] uppercase">Drill</span>
            </Link>
          ))}
          {summary.leaks.length === 0 && <div className="px-4 py-6 text-center text-[var(--mute)]">No recurring leaks. Nice.</div>}
        </div>
      </Section>

      <Section kicker="Unlimited spots" title="Drills">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {DRILLS.map((d, i) => {
            const m = mastery(progress, d);
            return (
              <Link key={d} to={`/practice?drill=${d}&n=10`} onClick={() => haptic.tap()} className="m-tap m-card m-in flex flex-col justify-between gap-4 p-3.5" style={{ ['--i' as string]: i }}>
                <div className="flex items-start justify-between">
                  <span className="m-mono text-[11px] text-[var(--dim)]">{String(i + 1).padStart(2, '0')}</span>
                  <span className="m-mono text-[11px] text-[var(--mute)]">{m.attempts ? `${m.score}%` : '—'}</span>
                </div>
                <div>
                  <div className="text-[15px] leading-tight font-semibold">{DRILL_INFO[d].title}</div>
                  <div className="mt-2.5">
                    <Bar value={m.score / 100} h={3} color="var(--signal)" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section kicker="Where the money went" title="Costliest hands">
        <div className="m-card m-divide overflow-hidden">
          {summary.worstHands.slice(0, 6).map((w) => {
            const a = ordered.find((x) => x.handId === w.handId);
            return (
              <Link key={w.handId} to={`/hand/${encodeURIComponent(w.handId)}`} onClick={() => haptic.tap()} className="m-tap flex items-center gap-3.5 px-4 py-3">
                {a && <MiniCards cards={a.heroCards} w={24} />}
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium">
                    {a?.heroPosition ?? ''} <span className="text-[var(--mute)]">· mistakes cost</span> <span className="text-[var(--signal)]">{fmt(w.loss)}</span>
                  </div>
                  <div className="m-mono text-[11.5px] text-[var(--dim)]">
                    RESULT {w.netBB >= 0 ? '+' : '−'}
                    {fmt(Math.abs(w.netBB))}
                  </div>
                </div>
                <ArrowRight size={16} className="text-[var(--dim)]" />
              </Link>
            );
          })}
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-2.5">
        <PrimaryButton to="/devices" tone="ghost" className="!text-[15px]">
          <Laptop size={17} /> Sync
        </PrimaryButton>
        <FilePicker className="m-tap m-btn m-btn-ghost !text-[15px]">
          <FileUp size={17} /> Import
        </FilePicker>
      </div>
      <p className="m-mono px-3 text-center text-[10.5px] leading-relaxed tracking-wide text-[var(--dim)] uppercase">Full stats, the replayer and the GTO solver live on the web version on your computer.</p>
    </Screen>
  );
}
