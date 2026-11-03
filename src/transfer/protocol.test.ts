import { describe, expect, it } from 'vitest';
import type { Progress } from '../lib/training/progress.ts';
import { newCode, normalizeCode, runSession, type Channel, type Device } from './protocol.ts';

function pipe(): [Channel, Channel] {
  const a: ((d: string) => void)[] = [];
  const b: ((d: string) => void)[] = [];
  const sizes: number[] = [];
  const mk = (mine: typeof a, theirs: typeof b): Channel => ({
    send: (d) => {
      sizes.push(d.length);
      // Deliver asynchronously and in order, like a data channel.
      setTimeout(() => theirs.forEach((h) => h(d)), 0);
    },
    onMessage: (cb) => mine.push(cb),
  });
  const ca = mk(a, b);
  const cb = mk(b, a);
  (ca as unknown as { sizes: number[] }).sizes = sizes;
  return [ca, cb];
}

function device(ids: string[], attempts: Progress['attempts']): Device & { store: Map<string, string>; prog: Progress } {
  const store = new Map(ids.map((id) => [id, `RAW ${id} ${'x'.repeat(1500)}`]));
  const d = {
    store,
    prog: { attempts, cards: {}, streak: 0, bestStreak: 0 } as Progress,
    handIds: () => [...store.keys()],
    rawHands: (want: string[]) => want.map((id) => store.get(id)!).filter(Boolean),
    importRaws: async (raws: string[]) => {
      for (const r of raws) store.set(r.split(' ')[1], r);
    },
    progress: () => d.prog,
    setProgress: (p: Progress) => {
      d.prog = p;
    },
  };
  return d;
}

describe('device-to-device transfer protocol', () => {
  it('syncs hands both ways and merges training progress', async () => {
    const [ca, cb] = pipe();
    const mac = device(Array.from({ length: 1200 }, (_, i) => `H${i}`), [{ t: 1, drill: 'rfi', correct: true, qid: 'a', own: false }]);
    const phone = device(['H5', 'P1', 'P2'], [{ t: 2, drill: 'value', correct: false, qid: 'b', own: false }]);
    const [sa, sb] = await Promise.all([runSession(ca, mac, { name: 'Mac' }), runSession(cb, phone, { name: 'iPhone' })]);
    expect(sa).toMatchObject({ peerName: 'iPhone', received: 2, sent: 1199 });
    expect(sb).toMatchObject({ peerName: 'Mac', received: 1199, sent: 2 });
    expect(new Set(mac.handIds())).toEqual(new Set(phone.handIds()));
    expect(mac.handIds()).toHaveLength(1202);
    expect(mac.prog.attempts.map((x) => x.qid)).toEqual(['a', 'b']);
    expect(phone.prog.attempts.map((x) => x.qid)).toEqual(['a', 'b']);
    // Every frame stays under the data-channel size budget.
    expect(Math.max(...(ca as unknown as { sizes: number[] }).sizes)).toBeLessThan(64_000);
  });

  it('finishes cleanly when both devices already match', async () => {
    const [ca, cb] = pipe();
    const a = device(['X1', 'X2'], []);
    const b = device(['X1', 'X2'], []);
    const [sa, sb] = await Promise.all([runSession(ca, a, { name: 'A' }), runSession(cb, b, { name: 'B' })]);
    expect(sa.received + sa.sent + sb.received + sb.sent).toBe(0);
  });

  it('makes readable codes', () => {
    const c = newCode();
    expect(c).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
    expect(normalizeCode(' k7q-2mx ')).toBe('K7Q2MX');
  });
});
