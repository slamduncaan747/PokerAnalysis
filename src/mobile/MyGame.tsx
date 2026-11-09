import { ChevronRight, FileUp, Laptop } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { mergeProgress } from '../cloud/merge.ts';
import { haptic } from '../feedback.ts';
import { readHandFiles } from '../lib/files.ts';
import { DRILL_INFO, LEAKS } from '../lib/engine/leaks.ts';
import { dueCards, mastery, syncCards, type Progress } from '../lib/training/progress.ts';
import { useOwnMistakesOf } from '../lib/training/queue.ts';
import { useUnits } from '../settings.ts';
import { useStore } from '../store.ts';
import { PROGRESS_FILE } from '../transfer/device.ts';
import { DRILL_ORDER, DrillChip } from './meta.tsx';
import { Bar, Btn, Chip, List, MCard, MiniCards, Ring, Row, Section, TabScreen, Tile } from './ui.tsx';

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

/** A button that opens the Files picker. */
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

function ImportProgress() {
  const status = useStore((s) => s.status);
  if (status.phase !== 'parsing' && status.phase !== 'analyzing') return null;
  const pct = status.total ? status.done / status.total : 0.05;
  return (
    <div className="m-tile-flat m-fade p-4">
      <div className="f-ui mb-2.5 font-semibold">{status.phase === 'parsing' ? 'Reading hand histories…' : `Grading ${status.done.toLocaleString()} of ${status.total.toLocaleString()} hands…`}</div>
      <Bar value={pct} h={10} />
    </div>
  );
}

function Empty() {
  const loadDemo = useStore((s) => s.loadDemo);
  return (
    <TabScreen title="My Game">
      <ImportProgress />
      <div className="m-rail m-in" style={{ borderRadius: 36 }}>
        <div className="m-felt relative flex h-[180px] items-center justify-center overflow-hidden" style={{ borderRadius: 28 }}>
          <div className="absolute top-[54%] left-[14%] -rotate-12"><Chip color="red" size={46}><span>5</span></Chip></div>
          <div className="absolute top-[20%] left-[8%] rotate-6"><Chip color="black" size={40}><span>100</span></Chip></div>
          <div className="flex">
            <MCard card={51} w={72} style={{ transform: 'rotate(-8deg) translateY(4px)' }} />
            <MCard card={46} w={72} style={{ marginLeft: -14, transform: 'rotate(8deg)' }} />
          </div>
          <div className="absolute top-[18%] right-[10%] rotate-12"><Chip color="green" size={44}><span>25</span></Chip></div>
          <div className="absolute top-[58%] right-[16%] -rotate-6"><Chip color="purple" size={38}><span>500</span></Chip></div>
        </div>
      </div>
      <div className="-mt-2 px-2 text-center">
        <h2 className="f-display">Your game, graded</h2>
        <p className="f-body t2 mt-2.5">Import your hand histories and every decision gets a grade. Your biggest leaks turn into drills.</p>
      </div>
      <div className="flex flex-col gap-3">
        <Btn to="/devices">
          <Laptop size={20} strokeWidth={2.4} /> Receive from computer
        </Btn>
        <FilePicker className="m-btn3d b-outline">
          <FileUp size={20} strokeWidth={2.4} /> Import a file
        </FilePicker>
        <Btn tone="ghost" onClick={() => void loadDemo()}>
          Try it with demo hands
        </Btn>
      </div>
      <p className="f-small t3 text-center">No hands? No problem — puzzles and the Daily Hand don’t need any.</p>
    </TabScreen>
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
  const accColor = acc >= 85 ? 'var(--go)' : acc >= 75 ? 'var(--gold)' : 'var(--bad)';
  return (
    <TabScreen title="My Game">
      <ImportProgress />
      <div className="m-tile m-in p-5">
        <div className="flex items-center gap-5">
          <Ring value={acc / 100} size={104} stroke={11} color={accColor}>
            <div className="text-center leading-none">
              <div className="f-display f-num">{Math.round(acc)}</div>
              <div className="f-small t3 mt-1">accuracy</div>
            </div>
          </Ring>
          <div className="flex flex-1 flex-col gap-3">
            <div>
              <div className="f-caps">Win rate</div>
              <div className="f-head f-num" style={{ color: summary.bb100 >= 0 ? 'var(--go)' : 'var(--bad)' }}>
                {tx(`${Math.round(summary.bb100 * 10) / 10}bb`)}
                <span className="f-small t3 font-medium"> /100</span>
              </div>
            </div>
            <div>
              <div className="f-caps">Lost to mistakes</div>
              <div className="f-head f-num c-bad">
                {fmt(summary.evLossPer100)}
                <span className="f-small t3 font-medium"> /100</span>
              </div>
            </div>
          </div>
        </div>
        <div className="f-small t2 mt-4 font-normal">{summary.hands.toLocaleString()} hands, graded move by move like a chess game review.</div>
        <Btn to="/practice?own=1&n=10" className="mt-4">
          {due && due <= 99 ? `Review ${due} mistakes` : 'Review your mistakes'}
        </Btn>
      </div>

      <Section title="Biggest leaks" note="Ranked by what each one costs you per 100 hands.">
        <div className="flex flex-col gap-3">
          {summary.leaks.slice(0, 4).map((l, i) => (
            <Tile key={l.id} to={`/practice?leak=${l.id}&n=8`} className="m-in flex items-center gap-3.5 p-4" style={{ ['--i' as string]: i }}>
              <span className="f-head f-disp grid h-11 w-11 shrink-0 place-items-center rounded-[30%] font-extrabold" style={{ background: i === 0 ? 'var(--bad)' : 'var(--s3)', color: i === 0 ? 'var(--bad-ink)' : 'var(--text-2)' }}>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="f-ui leading-snug font-bold">{LEAKS[l.id].title}</div>
                <div className="f-small t2 font-normal">{tx(`${l.count} spots · −${Math.round(l.per100 * 10) / 10}bb/100`)}</div>
              </div>
              <ChevronRight size={20} className="t3" />
            </Tile>
          ))}
          {summary.leaks.length === 0 && <div className="m-tile-flat f-ui t2 px-4 py-6 text-center">No recurring leaks. Nice.</div>}
        </div>
      </Section>

      <Section title="Drills">
        <List>
          {DRILL_ORDER.map((d) => {
            const m = mastery(progress, d);
            return <Row key={d} icon={<DrillChip drill={d} size={40} />} title={DRILL_INFO[d].title} sub={DRILL_INFO[d].blurb} value={m.attempts ? `${m.score}%` : undefined} to={`/practice?drill=${d}&n=10`} />;
          })}
        </List>
      </Section>

      <Section title="Costliest hands">
        <List>
          {summary.worstHands.slice(0, 5).map((w) => {
            const a = ordered.find((x) => x.handId === w.handId);
            return <Row key={w.handId} icon={a ? <MiniCards cards={a.heroCards} w={26} /> : undefined} title={`Lost ${fmt(w.loss)} to mistakes`} sub={`${a?.heroPosition ? `${a.heroPosition} · ` : ''}result ${w.netBB >= 0 ? '+' : '−'}${fmt(Math.abs(w.netBB))}`} to={`/hand/${encodeURIComponent(w.handId)}`} />;
          })}
        </List>
      </Section>

      <Section note="The full stats, replayer and GTO solver are in the web version on your computer.">
        <div className="grid grid-cols-2 gap-3">
          <Tile to="/devices" className="flex items-center gap-2 p-4">
            <Laptop size={20} className="t2" />
            <span className="f-ui flex-1 font-bold">Sync</span>
            <ChevronRight size={18} className="t3" />
          </Tile>
          <FilePicker className="m-tile m-press flex w-full items-center gap-2 p-4 text-left">
            <FileUp size={20} className="t2" />
            <span className="f-ui flex-1 font-bold">Import</span>
            <ChevronRight size={18} className="t3" />
          </FilePicker>
        </div>
      </Section>
    </TabScreen>
  );
}
