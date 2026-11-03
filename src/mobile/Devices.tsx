import { CheckCircle2, Download, FileUp, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { haptic, sound } from '../feedback.ts';
import { appDevice, deviceName, saveBackup } from '../transfer/device.ts';
import { newCode, normalizeCode, runSession, type TransferStats } from '../transfer/protocol.ts';
import { FilePicker } from './MyGame.tsx';
import { Group, PrimaryButton, Row, Screen, Section } from './ui.tsx';

type Phase = { k: 'idle' } | { k: 'hosting'; code: string; ready: boolean } | { k: 'working'; status: string } | { k: 'done'; stats: TransferStats } | { k: 'error'; message: string };

const pretty = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`;

/** Pair with the computer: type the code it shows (or show one), then hands + training sync both ways. */
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
    <Screen title={<>Sync <em className="text-[var(--signal)]">&amp;</em> devices</>} back>
      <div className="m-card m-in p-5">
        <div className="m-serif text-[28px] leading-[1.02]">Send hands from your computer.</div>
        <ol className="mt-2 flex flex-col gap-1 text-[14.5px] text-[var(--mute)]">
          <li>1. On your computer, open Leakfinder → <b className="text-[var(--text)]">Sync &amp; devices</b> → <b className="text-[var(--text)]">Show a code</b>.</li>
          <li>2. Type the code here. Hands and progress sync both ways, directly — no account.</li>
        </ol>

        {(phase.k === 'idle' || phase.k === 'error') && (
          <form
            className="mt-4 flex flex-col gap-3"
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
              onChange={(e) => {
                setTyped(e.target.value.toUpperCase());
                haptic.tap();
              }}
              placeholder="ABC 123"
              className="m-num h-[68px] w-full rounded-[18px] border border-[var(--line-2)] bg-[var(--ink)] text-center font-mono text-[34px] font-extrabold tracking-[0.25em] text-[var(--text)] uppercase outline-none placeholder:text-white/15 focus:border-[var(--signal)]"
            />
            <PrimaryButton disabled={code.length !== 6}>Connect</PrimaryButton>
            {phase.k === 'error' && <div className="rounded-[14px] bg-[rgba(242,69,61,.1)] px-3 py-2 text-[14px] text-[var(--loss)]">{phase.message}</div>}
            <button type="button" className="m-tap py-2 text-[15px] font-semibold text-[var(--signal)]" onClick={() => void host()}>
              Show a code on this phone instead
            </button>
          </form>
        )}

        {phase.k === 'hosting' && (
          <div className="m-fade mt-4 flex flex-col items-center gap-3 rounded-[18px] bg-[var(--ink)] p-5 text-center">
            <div className="m-label">Type this on your other device</div>
            <div className="m-num font-mono text-[44px] font-black tracking-[0.2em]">{pretty(phase.code)}</div>
            <div className="flex items-center gap-2 text-[14px] text-[var(--mute)]">
              <Loader2 size={15} className="animate-spin" /> {phase.ready ? 'Waiting for the other device…' : 'Getting a code ready…'}
            </div>
            <button className="m-tap rounded-full border border-[var(--line-2)] px-4 py-2 text-[15px] font-semibold" onClick={reset}>
              Cancel
            </button>
          </div>
        )}

        {phase.k === 'working' && (
          <div className="m-fade mt-4 flex items-center gap-3 rounded-[18px] bg-[var(--ink)] p-4 text-[15px]" aria-live="polite">
            <Loader2 size={18} className="animate-spin text-[var(--signal)]" /> {phase.status}
          </div>
        )}

        {phase.k === 'done' && (
          <div className="m-pop mt-4 flex flex-col gap-2 rounded-[18px] bg-[rgba(51,194,122,.1)] p-4">
            <div className="flex items-center gap-2 text-[16px] font-bold">
              <CheckCircle2 size={20} className="text-[var(--signal)]" /> Synced with {phase.stats.peerName || 'your computer'}
            </div>
            <div className="text-[14px] text-[var(--mute)]">
              Received {phase.stats.received.toLocaleString()} hands · sent {phase.stats.sent.toLocaleString()}
              {phase.stats.progressMerged ? ' · progress merged' : ''}
            </div>
            <PrimaryButton to="/game" className="mt-1">
              Open My Game
            </PrimaryButton>
          </div>
        )}
      </div>

      <Section kicker="Or" title="Files">
        <Group>
          <FilePicker className="m-tap block w-full text-left">
            <Row icon={<FileUp size={18} />} title="Import hand histories or a backup" sub=".txt or .zip from the Files app" chevron={false} />
          </FilePicker>
          <Row
            icon={<Download size={18} />}
            title="Export a backup"
            sub="Every hand + training progress in one .zip"
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
        {note && <div className="mt-2 px-2 text-[14px] text-[var(--mute)]">{note}</div>}
      </Section>
      <p className="m-mono px-3 text-center text-[10.5px] leading-relaxed tracking-wide text-[var(--dim)] uppercase">The codes only introduce the two devices; your hands travel directly between them over an encrypted connection.</p>
    </Screen>
  );
}
