import { mergeProgress, progressEqual } from '../cloud/merge.ts';
import type { Progress } from '../lib/training/progress.ts';

/**
 * Device-to-device sync over any message channel (a WebRTC data channel in the app).
 * Both sides run the same symmetric session:
 *   1. send `hello` with every hand id they have and their training progress
 *   2. ask the other side for the hands they are missing (`want`)
 *   3. answer `want` with the raw hand histories in chunks (`hands`)
 *   4. merge training progress, import what arrived, and say `done`
 * Large messages are split into parts so they fit any data-channel size limit.
 */

export interface Channel {
  send(data: string): void;
  onMessage(cb: (data: string) => void): void;
}

export interface Device {
  handIds(): string[];
  rawHands(ids: string[]): string[];
  importRaws(raws: string[]): Promise<void>;
  progress(): Progress;
  setProgress(p: Progress): void;
}

export type Msg =
  | { type: 'hello'; v: 1; ids: string[]; progress: Progress; name: string }
  | { type: 'want'; ids: string[] }
  | { type: 'hands'; raws: string[]; last: boolean }
  | { type: 'done'; received: number };

export interface TransferStats {
  sent: number;
  received: number;
  peerName: string;
  progressMerged: boolean;
}

const PART = 48_000; // characters per frame — safe for every browser's data-channel limit

/** Wraps a channel with framing so arbitrarily large JSON messages can be sent. */
export function framed(ch: Channel) {
  let seq = 0;
  const partial = new Map<number, string[]>();
  const handlers: ((m: Msg) => void)[] = [];
  ch.onMessage((raw) => {
    const f = JSON.parse(raw) as { s: number; i: number; n: number; d: string };
    const parts = partial.get(f.s) ?? new Array<string>(f.n);
    parts[f.i] = f.d;
    partial.set(f.s, parts);
    if (parts.filter((x) => x !== undefined).length === f.n) {
      partial.delete(f.s);
      const msg = JSON.parse(parts.join('')) as Msg;
      for (const h of handlers) h(msg);
    }
  });
  return {
    send(m: Msg) {
      const s = seq++;
      const body = JSON.stringify(m);
      const n = Math.max(1, Math.ceil(body.length / PART));
      for (let i = 0; i < n; i++) ch.send(JSON.stringify({ s, i, n, d: body.slice(i * PART, (i + 1) * PART) }));
    },
    on(h: (m: Msg) => void) {
      handlers.push(h);
    },
  };
}

/** Runs one sync session; resolves when both sides have everything. */
export function runSession(
  ch: Channel,
  dev: Device,
  opts: { name: string; onStatus?: (s: string) => void; timeoutMs?: number },
): Promise<TransferStats> {
  const f = framed(ch);
  const status = opts.onStatus ?? (() => {});
  return new Promise<TransferStats>((resolve, reject) => {
    const stats: TransferStats = { sent: 0, received: 0, peerName: '', progressMerged: false };
    let theirDone = false;
    let mineDone = false;
    let expecting = 0;
    let pendingImport: Promise<void> = Promise.resolve();
    const buffer: string[] = [];
    const timer = setTimeout(() => reject(new Error('The other device stopped responding.')), opts.timeoutMs ?? 120_000);
    const finish = () => {
      if (mineDone && theirDone) {
        clearTimeout(timer);
        resolve(stats);
      }
    };
    const completeMine = async () => {
      await pendingImport;
      mineDone = true;
      f.send({ type: 'done', received: stats.received });
      finish();
    };

    f.on(async (m) => {
      try {
        if (m.type === 'hello') {
          stats.peerName = m.name;
          status(`Connected to ${m.name}`);
          const mineIds = new Set(dev.handIds());
          const want = m.ids.filter((id) => !mineIds.has(id));
          expecting = want.length;
          const merged = mergeProgress(dev.progress(), m.progress);
          if (!progressEqual(merged, dev.progress())) {
            dev.setProgress(merged);
            stats.progressMerged = true;
          }
          // The other side always answers with at least one `hands` message (possibly empty).
          f.send({ type: 'want', ids: want });
          if (want.length) status(`Receiving ${want.length.toLocaleString()} hands…`);
        } else if (m.type === 'want') {
          const raws = dev.rawHands(m.ids);
          if (!raws.length) f.send({ type: 'hands', raws: [], last: true });
          for (let i = 0; i < raws.length; i += 500) {
            const chunk = raws.slice(i, i + 500);
            f.send({ type: 'hands', raws: chunk, last: i + 500 >= raws.length });
            stats.sent += chunk.length;
          }
        } else if (m.type === 'hands') {
          buffer.push(...m.raws);
          stats.received += m.raws.length;
          if (expecting) status(`Receiving hands ${stats.received.toLocaleString()} / ${expecting.toLocaleString()}…`);
          if (m.last) {
            const batch = buffer.splice(0);
            status('Analyzing received hands…');
            pendingImport = pendingImport.then(() => (batch.length ? dev.importRaws(batch) : undefined));
            await completeMine();
          }
        } else if (m.type === 'done') {
          theirDone = true;
          finish();
        }
      } catch (e) {
        clearTimeout(timer);
        reject(e);
      }
    });

    f.send({ type: 'hello', v: 1, ids: dev.handIds(), progress: dev.progress(), name: opts.name });
  });
}

/** Human-friendly pairing code: 6 characters without look-alikes (no 0/O, 1/I/L). */
export function newCode(rand: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
  return s;
}

export const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const peerIdFor = (code: string) => `leakfinder-${normalizeCode(code)}`;
