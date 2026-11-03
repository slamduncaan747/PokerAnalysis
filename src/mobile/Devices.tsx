import { CircleCheck, Download, FileUp, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { haptic, sound } from '../feedback.ts';
import { appDevice, deviceName, saveBackup } from '../transfer/device.ts';
import { newCode, normalizeCode, runSession, type TransferStats } from '../transfer/protocol.ts';
import { IconTile } from './meta.tsx';
import { FilePicker } from './MyGame.tsx';
import { Button, Group, Row, Screen, Section } from './ui.tsx';

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
    setPhase({ k: 'working', status: 'Connected. Comparing hands…' });
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
    <Screen title="Sync & Devices" back>
      <Section footer="The code only introduces the two devices. Your hands travel directly between them over an encrypted connection.">
        <div className="m-card p-4">
          <div className="t-headline">Receive Hands from Your Computer</div>
          <p className="t-sub c-2 mt-1">On your computer, open Leakfinder, choose Sync & Devices, then Show a Code. Enter the code here.</p>

          {(phase.k === 'idle' || phase.k === 'error') && (
            <form
              className="mt-4 flex flex-col gap-2"
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
                className="t-rounded t-num h-14 w-full rounded-[12px] text-center text-[28px] font-semibold tracking-[0.2em] uppercase outline-none"
                style={{ background: 'var(--fill)', color: 'var(--label)' }}
              />
              <Button disabled={code.length !== 6}>Connect</Button>
              {phase.k === 'error' && <div className="t-foot c-red text-center">{phase.message}</div>}
              <Button tone="plain" onClick={() => void host()}>
                Show a Code on This iPhone Instead
              </Button>
            </form>
          )}

          {phase.k === 'hosting' && (
            <div className="m-fade mt-4 flex flex-col items-center gap-2 rounded-[12px] p-4 text-center" style={{ background: 'var(--fill-3)' }}>
              <div className="t-foot c-2">Enter this code on your other device</div>
              <div className="t-rounded t-num text-[40px] font-bold tracking-[0.15em]">{pretty(phase.code)}</div>
              <div className="t-foot c-2 flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" /> {phase.ready ? 'Waiting for the other device…' : 'Getting a code…'}
              </div>
              <Button tone="plain" onClick={reset}>
                Cancel
              </Button>
            </div>
          )}

          {phase.k === 'working' && (
            <div className="t-sub mt-4 flex items-center gap-2 rounded-[12px] p-4" style={{ background: 'var(--fill-3)' }} aria-live="polite">
              <Loader2 size={18} className="c-2 animate-spin" /> {phase.status}
            </div>
          )}

          {phase.k === 'done' && (
            <div className="m-pop mt-4 flex flex-col items-center gap-1 rounded-[12px] p-4 text-center" style={{ background: 'var(--green-soft)' }}>
              <CircleCheck size={36} fill="var(--green)" stroke="var(--bg-2)" />
              <div className="t-headline mt-1">Synced with {phase.stats.peerName || 'your computer'}</div>
              <div className="t-foot c-2">
                Received {phase.stats.received.toLocaleString()} hands · sent {phase.stats.sent.toLocaleString()}
                {phase.stats.progressMerged ? ' · progress merged' : ''}
              </div>
              <Button to="/game" className="mt-3">
                Open My Game
              </Button>
            </div>
          )}
        </div>
      </Section>

      <Section title="Files" small footer={note ?? 'Hand histories (.txt or .zip) or a Leakfinder backup.'}>
        <Group inset={58}>
          <FilePicker className="m-row-press block w-full text-left">
            <Row icon={<IconTile icon={FileUp} color="var(--blue)" />} title="Import from Files" chevron={false} />
          </FilePicker>
          <Row
            icon={<IconTile icon={Download} color="var(--green)" />}
            title="Export a Backup"
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
        </Group>
      </Section>
    </Screen>
  );
}
