import { FileUp, Laptop, Repeat2, TriangleAlert } from 'lucide-react';
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
import { DRILL_ORDER, DrillTile, IconTile } from './meta.tsx';
import { Badge, Bar, Button, Group, MCard, MiniCards, Ring, Row, Screen, Section } from './ui.tsx';

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

/** A button that opens the Files picker. Render-prop free: style it like any button. */
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
    <div className="m-card m-fade p-4">
      <div className="t-sub mb-2">{status.phase === 'parsing' ? 'Reading hand histories…' : `Analyzing ${status.done.toLocaleString()} of ${status.total.toLocaleString()} hands…`}</div>
      <Bar value={pct} />
    </div>
  );
}

function Empty() {
  const loadDemo = useStore((s) => s.loadDemo);
  return (
    <Screen title="My Game">
      <ImportProgress />
      <div className="flex flex-col items-center px-4 pt-6 text-center">
        <div className="mb-6 flex">
          <MCard card={51} w={64} style={{ transform: 'rotate(-8deg) translateY(4px)' }} />
          <MCard card={46} w={64} style={{ marginLeft: -16, transform: 'rotate(7deg)' }} />
        </div>
        <h2 className="t-title2">Practice Your Own Hands</h2>
        <p className="t-body c-2 mt-2">If you play online, import your hand histories on your computer and send them here. Every decision gets graded, and your biggest leaks become drills.</p>
        <div className="mt-7 flex w-full flex-col gap-2">
          <Button to="/devices">
            <Laptop size={19} /> Receive from Computer
          </Button>
          <FilePicker className="m-press m-btn m-btn-gray">
            <FileUp size={19} /> Import a File
          </FilePicker>
          <Button
            tone="plain"
            onClick={() => {
              void loadDemo();
            }}
          >
            Try with Demo Hands
          </Button>
        </div>
        <p className="t-foot c-2 mt-6">Puzzles and the Daily Hand work without any hands.</p>
      </div>
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
    <Screen title="My Game" eyebrow={`${summary.hands.toLocaleString()} hands analyzed`}>
      <ImportProgress />
      <div className="m-card m-in flex items-center gap-4 p-4">
        <Ring value={acc / 100} size={84} stroke={9} color={acc >= 85 ? 'var(--green)' : acc >= 75 ? 'var(--orange)' : 'var(--red)'}>
          <span className="t-rounded t-num text-[24px] font-bold">{Math.round(acc)}</span>
        </Ring>
        <div className="grid flex-1 grid-cols-1 gap-2">
          <div>
            <div className="t-foot c-2">Accuracy</div>
            <div className="t-sub">Graded like a chess game review</div>
          </div>
          <div className="flex gap-5">
            <div>
              <div className="t-foot c-2">Win rate</div>
              <div className="t-headline t-num" style={{ color: summary.bb100 >= 0 ? 'var(--green-text)' : 'var(--red-text)' }}>
                {tx(`${Math.round(summary.bb100 * 10) / 10}bb`)}
                <span className="t-foot c-2 font-normal">/100</span>
              </div>
            </div>
            <div>
              <div className="t-foot c-2">Lost to mistakes</div>
              <div className="t-headline t-num">
                {fmt(summary.evLossPer100)}
                <span className="t-foot c-2 font-normal">/100</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Group inset={58}>
        <Row icon={<IconTile icon={Repeat2} color="var(--indigo)" />} title="Review Mistakes" sub="Spaced repetition from your hands" right={<Badge n={due} />} to="/practice?own=1&n=10" />
      </Group>

      <Section title="Biggest Leaks" footer="Ranked by how much each one costs you per 100 hands.">
        {summary.leaks.length === 0 ? (
          <div className="m-group t-sub c-2 px-4 py-6 text-center">No recurring leaks found.</div>
        ) : (
          <Group inset={58}>
            {summary.leaks.slice(0, 5).map((l) => (
              <Row key={l.id} icon={<IconTile icon={TriangleAlert} color="var(--orange)" />} title={LEAKS[l.id].title} sub={tx(`${l.count} spots · −${Math.round(l.per100 * 10) / 10}bb/100`)} to={`/practice?leak=${l.id}&n=8`} />
            ))}
          </Group>
        )}
      </Section>

      <Section title="Drills">
        <Group inset={58}>
          {DRILL_ORDER.map((d) => {
            const m = mastery(progress, d);
            return <Row key={d} icon={<DrillTile drill={d} />} title={DRILL_INFO[d].title} value={m.attempts ? `${m.score}%` : undefined} to={`/practice?drill=${d}&n=10`} />;
          })}
        </Group>
      </Section>

      <Section title="Costliest Hands">
        <Group inset={86}>
          {summary.worstHands.slice(0, 6).map((w) => {
            const a = ordered.find((x) => x.handId === w.handId);
            return (
              <Row
                key={w.handId}
                icon={a ? <MiniCards cards={a.heroCards} w={26} /> : undefined}
                title={`${a?.heroPosition ?? ''} · Mistakes cost ${fmt(w.loss)}`}
                sub={`Result ${w.netBB >= 0 ? '+' : '−'}${fmt(Math.abs(w.netBB))}`}
                to={`/hand/${encodeURIComponent(w.handId)}`}
              />
            );
          })}
        </Group>
      </Section>

      <Section title="Add Hands" footer="Full stats, the hand replayer and the GTO solver are in the web version on your computer.">
        <Group inset={58}>
          <Row icon={<IconTile icon={Laptop} color="var(--blue)" />} title="Sync with Computer" to="/devices" />
          <FilePicker className="m-row-press block w-full text-left">
            <Row icon={<IconTile icon={FileUp} color="var(--gray)" />} title="Import a File" chevron={false} />
          </FilePicker>
        </Group>
      </Section>
    </Screen>
  );
}
