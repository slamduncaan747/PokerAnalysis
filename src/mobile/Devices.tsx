import { Check, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { haptic, sound } from '../feedback.ts';
import { appDevice, deviceName, saveBackup } from '../transfer/device.ts';
import { newCode, normalizeCode, runSession, type TransferStats } from '../transfer/protocol.ts';
import { FilePicker } from './MyGame.tsx';
import { Btn, List, PushScreen, Row, Section } from './ui.tsx';

type Phase = { k: 'idle' } | { k: 'hosting'; code: string; ready: boolean } | { k: 'working'; status: string } | { k: 'done'; stats: TransferStats } | { k: 'error'; message: string };

const pretty = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`;

/** Pair with the computer: type the code it shows (or show one). Hands and progress sync both ways. */
export default function Devices() {
  const [phase, setPhase] = useState<Phase>({ k: 'idle' });
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const cancelRef = useRef<() => void>(() => {});
  useEffect(() => () => cancelRef.current(), []);

  const sync = async (link: { channel: Parameters<typeof runSession>[0]; close: () => void }) => {
    setPhase({ k: 'working', status: 'Connected — comparing hands…' });
    haptic.press();
    try {
      const stats = await runSession(link.channel, appDevice(), { name: deviceName(), onStatus: (status) => setPhase({ k: 'working', status }) });
      setPhase({ k: 'done', stats });
      haptic.success();
      sound.correct();
    } catch (e) {
      setPhase({ k: 'error', message: (e as Error).message });
      haptic.error();
    } finally {
      setTimeout(() => link.close(), 1500);
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

  const host = async (attempt = 0): Promise<void> => {
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

  const reset = () => {
    cancelRef.current();
    setPhase({ k: 'idle' });
    setTyped('');
  };

  const code = normalizeCode(typed);
  return (
    <PushScreen title="Sync & devices">
      <div>
        <h1 className="f-display">Send hands from your computer</h1>
        <p className="f-body t2 mt-2">On your computer, open Leakfinder → Sync &amp; devices → Show a code. Type it here. No account needed.</p>
      </div>

      {(phase.k === 'idle' || phase.k === 'error') && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          <input
            aria-label="Code from your computer"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            autoCorrect="off"
            spellCheck={false}
            maxLength={7}
            value={typed}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
            placeholder="ABC 123"
            className="f-num h-[72px] w-full rounded-[18px] text-center text-[34px] font-extrabold tracking-[0.2em] uppercase outline-none placeholder:text-white/15"
            style={{ background: 'var(--s1)', color: 'var(--text)', boxShadow: 'inset 0 0 0 2px var(--line-2)' }}
          />
          <Btn disabled={code.length !== 6}>Connect</Btn>
          {phase.k === 'error' && <div className="f-small c-bad text-center">{phase.message}</div>}
          <Btn tone="ghost" onClick={() => void host()}>
            Show a code on this phone instead
          </Btn>
        </form>
      )}

      {phase.k === 'hosting' && (
        <div className="m-tile-flat m-fade flex flex-col items-center gap-2 p-6 text-center">
          <div className="f-tiny t2">Type this on your other device</div>
          <div className="f-num text-[46px] font-extrabold tracking-[0.15em]">{pretty(phase.code)}</div>
          <div className="f-small t2 flex items-center gap-1.5">
            <Loader2 size={15} className="animate-spin" /> {phase.ready ? 'Waiting for the other device…' : 'Getting a code…'}
          </div>
          <Btn tone="ghost" onClick={reset} className="mt-2">
            Cancel
          </Btn>
        </div>
      )}

      {phase.k === 'working' && (
        <div className="m-tile-flat f-ui flex items-center gap-3 p-5" aria-live="polite">
          <Loader2 size={20} className="t2 animate-spin" /> {phase.status}
        </div>
      )}

      {phase.k === 'done' && (
        <div className="m-pop flex flex-col items-center gap-1 rounded-[22px] p-6 text-center" style={{ background: 'var(--go-bg)', boxShadow: 'inset 0 0 0 2px var(--go)' }}>
          <div className="grid h-14 w-14 place-items-center rounded-full" style={{ background: 'var(--go)', color: 'var(--go-ink)' }}>
            <Check size={30} strokeWidth={3.4} />
          </div>
          <div className="f-head mt-2">Synced with {phase.stats.peerName || 'your computer'}</div>
          <div className="f-small t2">
            {phase.stats.received.toLocaleString()} hands in · {phase.stats.sent.toLocaleString()} out
            {phase.stats.progressMerged ? ' · progress merged' : ''}
          </div>
          <Btn to="/game" className="mt-4">
            Open My Game
          </Btn>
        </div>
      )}

      <Section title="Files" note={note ?? 'The code only introduces the two devices; your hands travel directly between them, encrypted.'}>
        <List>
          <FilePicker className="m-row-press block w-full text-left">
            <Row title="Import from Files" sub="Hand histories (.txt, .zip) or a backup" chevron={false} />
          </FilePicker>
          <Row
            title="Export a backup"
            sub="Every hand and your progress in one file"
            onClick={async () => {
              try {
                const n = await saveBackup();
                setNote(`Backup with ${n.toLocaleString()} hands ready.`);
              } catch (e) {
                const m = (e as Error).message;
                if (!/cancel/i.test(m)) setNote(`Couldn’t save the backup: ${m}`);
              }
            }}
          />
        </List>
      </Section>
    </PushScreen>
  );
}
