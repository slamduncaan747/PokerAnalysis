import { AlertTriangle, CheckCircle2, ClipboardPaste, FileText, Lock, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mergeProgress } from '../cloud/merge.ts';
import { readHandFiles } from '../lib/files.ts';
import type { Progress } from '../lib/training/progress.ts';
import { PROGRESS_FILE } from '../transfer/device.ts';
import { useStore } from '../store.ts';

const SITES = ['PokerStars', 'GGPoker / Natural8', 'CoinPoker', 'ACR / WPN', 'Winamax', 'Ignition / Bovada', 'Most Stars-style exports'];

const readFiles = readHandFiles;

export function DropZone({ compact = false }: { compact?: boolean }) {
  const importFiles = useStore((s) => s.importFiles);
  const loadDemo = useStore((s) => s.loadDemo);
  const status = useStore((s) => s.status);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const busy = status.phase === 'parsing' || status.phase === 'analyzing';

  // Only jump to the dashboard if the user is still on the import/landing page when the import finishes.
  const goHome = () => {
    const h = window.location.hash.replace(/^#/, '') || '/';
    if (h === '/' || h.startsWith('/import')) navigate('/');
  };
  const go = async (all: { name: string; text: string }[]) => {
    // A Leakfinder backup carries training progress next to the hands: merge it in.
    for (const f of all.filter((x) => x.name.endsWith(PROGRESS_FILE))) {
      try {
        const s = useStore.getState();
        s.setProgress(mergeProgress(s.progress, JSON.parse(f.text) as Progress));
      } catch {
        /* not a progress file */
      }
    }
    const files = all.filter((x) => !/\.json$/i.test(x.name));
    if (!files.length) return;
    await importFiles(files);
    goHome();
  };
  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (busy) return;
    await go(await readFiles(e.dataTransfer.files));
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition-colors ${compact ? 'p-6' : 'p-10'} ${over ? 'border-accent bg-accent/5' : 'border-line bg-panel hover:border-mute/50'}`}
      >
        <UploadCloud size={compact ? 28 : 40} className="text-accent" />
        <div>
          <div className="font-semibold">{busy ? 'Working…' : 'Drop hand history files here'}</div>
          <div className="text-sm text-mute">or click to choose .txt or .zip files — you can select a whole folder's worth at once</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".txt,.log,.hh,.zip,text/plain,application/zip"
          className="hidden"
          onChange={async (e) => {
            if (e.target.files) await go(await readFiles(e.target.files));
            e.target.value = '';
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost" disabled={busy} onClick={() => setShowPaste((x) => !x)}>
          <ClipboardPaste size={16} /> Paste hands
        </button>
        <button
          className="btn btn-ghost"
          disabled={busy}
          onClick={async () => {
            await loadDemo();
            goHome();
          }}
        >
          <Sparkles size={16} /> Try with 600 demo hands
        </button>
      </div>
      {showPaste && (
        <div className="panel flex flex-col gap-2 p-3">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="Paste one or more hand histories…"
            className="h-48 w-full resize-y rounded-lg border border-line bg-bg p-3 font-mono text-xs text-ink outline-none focus:border-accent"
          />
          <div className="flex justify-end">
            <button className="btn btn-primary" disabled={busy || !paste.trim()} onClick={() => go([{ name: 'pasted.txt', text: paste }])}>
              Analyze
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ImportResult() {
  const status = useStore((s) => s.status);
  if (status.phase !== 'done' && status.phase !== 'error') return null;
  if (status.phase === 'error')
    return (
      <div className="panel flex items-start gap-3 border-loss/40 p-4 text-sm">
        <AlertTriangle className="text-loss" size={18} /> {status.message}
      </div>
    );
  return (
    <div className="panel flex flex-col gap-2 p-4 text-sm">
      <div className="flex items-center gap-2 font-semibold">
        <CheckCircle2 size={18} className="text-accent" />
        Imported {status.newHands?.toLocaleString() ?? 0} new hands
        {!!status.duplicates && <span className="font-normal text-mute">· {status.duplicates} duplicates skipped</span>}
        {!!status.skipped && <span className="font-normal text-mute">· {status.skipped} non-NLHE hands skipped</span>}
      </div>
      {!!status.errors?.length && (
        <details className="text-xs text-mute">
          <summary className="cursor-pointer">{status.errors.length} hands could not be parsed</summary>
          <ul className="mt-2 list-disc pl-5">
            {status.errors.slice(0, 10).map((e, i) => (
              <li key={i}>
                <span className="font-mono">{e.snippet.slice(0, 90)}</span> — {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function Import() {
  const count = useStore((s) => s.hands.size);
  const reset = useStore((s) => s.reset);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Import hand histories</h1>
        <p className="mt-1 text-mute">
          Export hands from your poker client (they're plain .txt files) and drop them below. Duplicates are skipped, so re-importing a folder is safe.
        </p>
      </div>
      <DropZone />
      <ImportResult />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="panel p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <FileText size={16} /> Supported formats
          </div>
          <ul className="grid grid-cols-1 gap-1 text-sm text-mute">
            {SITES.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-dim">
            No-Limit Hold'em cash games and tournaments; other games are skipped. Plain .txt files or a .zip download both work. CoinPoker's
            USDT (₮) amounts, straddles, splash pots and run-it-twice hands are supported.
          </p>
        </div>
        <div className="panel p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <Lock size={16} /> Your data
          </div>
          <p className="text-sm text-mute">
            Everything runs locally in your browser. Hands are saved in this browser's storage so your dashboard is here next time.
          </p>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-mute">{count.toLocaleString()} hands stored</span>
            {count > 0 &&
              (confirming ? (
                <span className="flex items-center gap-2">
                  <span className="text-xs text-mute">Delete all hands?</span>
                  <button
                    className="btn !bg-loss !py-1.5 text-white"
                    onClick={async () => {
                      await reset();
                      setConfirming(false);
                    }}
                  >
                    Delete
                  </button>
                  <button className="btn btn-ghost !py-1.5" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button className="btn btn-ghost !py-1.5 text-loss" onClick={() => setConfirming(true)}>
                  <Trash2 size={14} /> Clear data
                </button>
              ))}
          </div>
        </div>
      </div>
      {count > 0 && (
        <Link to="/" className="btn btn-primary self-start">
          Go to dashboard →
        </Link>
      )}
    </div>
  );
}
