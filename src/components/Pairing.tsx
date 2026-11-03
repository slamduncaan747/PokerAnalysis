import { ArrowLeftRight, CheckCircle2, Download, Loader2, Smartphone, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { appDevice, deviceName, saveBackup } from '../transfer/device.ts';
import { newCode, normalizeCode, runSession, type TransferStats } from '../transfer/protocol.ts';
import { DropZone } from '../pages/Import.tsx';

type Phase =
  | { k: 'idle' }
  | { k: 'hosting'; code: string; ready: boolean }
  | { k: 'joining' }
  | { k: 'working'; status: string }
  | { k: 'done'; stats: TransferStats }
  | { k: 'error'; message: string };

const pretty = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`;

/** Pair two devices with a short code and sync hands + training directly (WebRTC). */
export function PairingCard() {
  const [phase, setPhase] = useState<Phase>({ k: 'idle' });
  const [typed, setTyped] = useState('');
  const cancelRef = useRef<() => void>(() => {});
  useEffect(() => () => cancelRef.current(), []);

  const sync = async (link: { channel: Parameters<typeof runSession>[0]; close: () => void }) => {
    setPhase({ k: 'working', status: 'Connected — comparing hands…' });
    try {
      const stats = await runSession(link.channel, appDevice(), { name: deviceName(), onStatus: (status) => setPhase({ k: 'working', status }) });
      setPhase({ k: 'done', stats });
    } catch (e) {
      setPhase({ k: 'error', message: (e as Error).message });
    } finally {
      setTimeout(() => link.close(), 1500);
    }
  };

  const host = async (attempt = 0) => {
    const { hostLink } = await import('../transfer/peer.ts');
    const code = newCode();
    setPhase({ k: 'hosting', code, ready: false });
    const h = hostLink(code, () => setPhase({ k: 'hosting', code, ready: true }));
    cancelRef.current = h.cancel;
    try {
      await sync(await h.link);
    } catch (e) {
      const msg = (e as Error).message;
      if (/already in use/.test(msg) && attempt < 3) return host(attempt + 1);
      setPhase({ k: 'error', message: msg });
    }
  };

  const join = async () => {
    const code = normalizeCode(typed);
    if (code.length !== 6) return;
    const { joinLink } = await import('../transfer/peer.ts');
    setPhase({ k: 'working', status: 'Connecting…' });
    const j = joinLink(code);
    cancelRef.current = j.cancel;
    try {
      await sync(await j.link);
    } catch (e) {
      setPhase({ k: 'error', message: (e as Error).message });
    }
  };

  const reset = () => {
    cancelRef.current();
    setPhase({ k: 'idle' });
    setTyped('');
  };

  return (
    <div className="panel flex flex-col gap-4 p-5">
      <div>
        <div className="flex items-center gap-2 font-semibold">
          <ArrowLeftRight size={18} className="text-accent" /> Sync with your other device
        </div>
        <p className="mt-1 text-sm text-mute">
          No account needed. Open Leakfinder on both devices, show a code on one and type it on the other. Hands and training progress sync both ways,
          directly between the two devices.
        </p>
      </div>

      {phase.k === 'idle' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="btn btn-primary" onClick={() => host()}>
            <Smartphone size={16} /> Show a code
          </button>
          <button className="btn btn-ghost" onClick={() => setPhase({ k: 'joining' })}>
            I have a code
          </button>
        </div>
      )}

      {phase.k === 'hosting' && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-panel-2 p-5 text-center">
          <div className="text-xs uppercase tracking-wide text-mute">Your code</div>
          <div className="font-mono text-4xl font-extrabold tracking-[0.25em] tabular-nums" aria-live="polite">
            {pretty(phase.code)}
          </div>
          <div className="flex items-center gap-2 text-sm text-mute">
            <Loader2 size={14} className="animate-spin" />
            {phase.ready ? 'On your other device: Sync & devices → I have a code' : 'Getting a code ready…'}
          </div>
          <button className="btn btn-ghost !py-1.5" onClick={reset}>
            Cancel
          </button>
        </div>
      )}

      {phase.k === 'joining' && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            join();
          }}
        >
          <label htmlFor="pair-code" className="text-xs text-mute">
            Code shown on your other device
          </label>
          <div className="flex gap-2">
            <input
              id="pair-code"
              autoFocus
              autoCapitalize="characters"
              autoComplete="one-time-code"
              inputMode="text"
              maxLength={7}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="ABC 123"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-center font-mono text-2xl tracking-[0.2em] text-ink uppercase outline-none focus:border-accent"
            />
            <button className="btn btn-primary" disabled={normalizeCode(typed).length !== 6}>
              Connect
            </button>
          </div>
          <button type="button" className="self-start text-xs text-mute hover:text-ink" onClick={reset}>
            Cancel
          </button>
        </form>
      )}

      {phase.k === 'working' && (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-panel-2 p-4 text-sm" aria-live="polite">
          <Loader2 size={16} className="animate-spin text-accent" /> {phase.status}
        </div>
      )}

      {phase.k === 'done' && (
        <div className="flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 size={16} className="text-accent" /> Synced with {phase.stats.peerName || 'your other device'}
          </div>
          <div className="text-mute">
            Received {phase.stats.received.toLocaleString()} hands · sent {phase.stats.sent.toLocaleString()} hands
            {phase.stats.progressMerged ? ' · training progress merged' : ''}.
          </div>
          <button className="btn btn-ghost self-start !py-1.5" onClick={reset}>
            Done
          </button>
        </div>
      )}

      {phase.k === 'error' && (
        <div className="flex flex-col gap-2 rounded-xl border border-loss/40 bg-loss/5 p-4 text-sm">
          <span className="text-loss">{phase.message}</span>
          <button className="btn btn-ghost self-start !py-1.5" onClick={reset}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

/** Backup file: one zip with every hand + training progress (AirDrop, iCloud Drive, email…). */
export function BackupCard() {
  const [note, setNote] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  return (
    <div className="panel flex flex-col gap-3 p-5">
      <div>
        <div className="flex items-center gap-2 font-semibold">
          <Download size={18} className="text-great" /> Backup file
        </div>
        <p className="mt-1 text-sm text-mute">
          Save everything as one .zip, then AirDrop it, keep it in iCloud Drive, or email it to yourself. Importing it on another device restores the hands and
          merges your training progress.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-primary"
          onClick={async () => {
            try {
              const n = await saveBackup();
              setNote(`Backup with ${n.toLocaleString()} hands ready.`);
            } catch (e) {
              const m = (e as Error).message;
              if (!/cancel/i.test(m)) setNote(`Couldn't save the backup: ${m}`);
            }
          }}
        >
          <Download size={16} /> Export backup
        </button>
        <button className="btn btn-ghost" onClick={() => setShowImport((x) => !x)}>
          <Upload size={16} /> Import a backup
        </button>
      </div>
      {note && <div className="text-sm text-mute">{note}</div>}
      {showImport && <DropZone compact />}
    </div>
  );
}
