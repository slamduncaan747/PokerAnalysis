import { create } from 'zustand';
import { clearAll, ENGINE_VERSION, loadAll, saveBatch } from './db.ts';
import { summarize, type Summary } from './lib/engine/summary.ts';
import type { HandAnalysis } from './lib/engine/types.ts';
import { loadProgress, saveProgress, type Progress } from './lib/training/progress.ts';
import type { Hand } from './lib/types.ts';
import type { WorkerIn, WorkerOut } from './workers/analyze.worker.ts';

export interface ImportStatus {
  phase: 'idle' | 'parsing' | 'analyzing' | 'done' | 'error';
  done: number;
  total: number;
  message?: string;
  errors?: { snippet: string; message: string }[];
  newHands?: number;
  duplicates?: number;
  skipped?: number;
}

interface State {
  ready: boolean;
  hands: Map<string, Hand>;
  analyses: Map<string, HandAnalysis>;
  /** Analyses sorted by date (oldest first). */
  ordered: HandAnalysis[];
  summary: Summary | null;
  status: ImportStatus;
  progress: Progress;
  init: () => Promise<void>;
  importFiles: (files: { name: string; text: string }[]) => Promise<void>;
  loadDemo: () => Promise<void>;
  reset: () => Promise<void>;
  setProgress: (p: Progress) => void;
}

let worker: Worker | null = null;
function getWorker(): Worker {
  if (!worker) worker = new Worker(new URL('./workers/analyze.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

function recompute(analyses: Map<string, HandAnalysis>) {
  const ordered = [...analyses.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.handId < b.handId ? -1 : 1));
  return { ordered, summary: ordered.length ? summarize(ordered) : null };
}

export const useStore = create<State>((set, get) => {
  const runWorker = (msg: WorkerIn) =>
    new Promise<void>((resolve) => {
      const w = getWorker();
      const hands = new Map(get().hands);
      const analyses = new Map(get().analyses);
      let pending: Promise<void> = Promise.resolve();
      let lastRecompute = 0;
      w.onmessage = (ev: MessageEvent<WorkerOut>) => {
        const m = ev.data;
        if (m.type === 'parsed') {
          set({ status: { phase: 'analyzing', done: 0, total: m.newHands, errors: m.errors, newHands: m.newHands, duplicates: m.duplicates, skipped: m.skipped } });
        } else if (m.type === 'batch') {
          for (const h of m.hands) hands.set(h.id, h);
          for (const a of m.analyses) analyses.set(a.handId, a);
          pending = pending.then(() => saveBatch(m.hands, m.analyses)).catch((e) => console.warn('save failed', e));
          const now = performance.now();
          if (now - lastRecompute > 1500) {
            lastRecompute = now;
            set({ hands: new Map(hands), analyses: new Map(analyses), ...recompute(analyses) });
          }
        } else if (m.type === 'progress') {
          set((s) => ({ status: { ...s.status, phase: 'analyzing', done: m.done, total: m.total } }));
        } else if (m.type === 'done') {
          set((s) => ({ hands: new Map(hands), analyses: new Map(analyses), ...recompute(analyses), status: { ...s.status, phase: 'done' } }));
          pending.then(() => resolve());
        } else if (m.type === 'error') {
          set({ status: { phase: 'error', done: 0, total: 0, message: m.message } });
          resolve();
        }
      };
      w.postMessage(msg);
    });

  return {
    ready: false,
    hands: new Map(),
    analyses: new Map(),
    ordered: [],
    summary: null,
    status: { phase: 'idle', done: 0, total: 0 },
    progress: loadProgress(),
    init: async () => {
      try {
        const { hands, analyses, engineVersion } = await loadAll();
        const hm = new Map(hands.map((h) => [h.id, h]));
        const am = new Map(analyses.map((a) => [a.handId, a]));
        set({ hands: hm, analyses: am, ...recompute(am), ready: true });
        if (hands.length && engineVersion !== ENGINE_VERSION) {
          // Engine improved since these were analysed — refresh in the background.
          set({ status: { phase: 'parsing', done: 0, total: hands.length, message: 'Updating analysis…' } });
          await runWorker({ type: 'reanalyze', hands });
        }
      } catch (e) {
        console.warn('Could not load saved data', e);
        set({ ready: true });
      }
    },
    importFiles: async (files) => {
      set({ status: { phase: 'parsing', done: 0, total: 0 } });
      await runWorker({ type: 'analyze', files, known: [...get().hands.keys()] });
    },
    loadDemo: async () => {
      set({ status: { phase: 'parsing', done: 0, total: 0, message: 'Loading demo hands…' } });
      const res = await fetch(`${import.meta.env.BASE_URL}demo/sample-hands.txt`);
      const text = await res.text();
      await get().importFiles([{ name: 'demo.txt', text }]);
    },
    reset: async () => {
      await clearAll();
      set({ hands: new Map(), analyses: new Map(), ordered: [], summary: null, status: { phase: 'idle', done: 0, total: 0 } });
    },
    setProgress: (p) => {
      saveProgress(p);
      set({ progress: p });
    },
  };
});
