import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { analyzeHand } from '../lib/engine/analyze.ts';
import { parseHandHistories } from '../lib/parser/index.ts';
import type { Progress } from '../lib/training/progress.ts';
import { useStore } from '../store.ts';
import { __setClientForTests, syncNow, useCloud } from './cloud.ts';
import { mergeProgress } from './merge.ts';

/**
 * Two "devices" syncing through an in-memory stand-in for Supabase's query API.
 * The fake enforces per-user isolation like row-level security does.
 */
type Row = Record<string, unknown>;
class FakeDb {
  tables: Record<string, Row[]> = { hands: [], training_progress: [] };
  requests = 0;
}
function fakeClient(db: FakeDb, userId: string) {
  class Q implements PromiseLike<{ data: unknown; error: null }> {
    private filters: ((r: Row) => boolean)[] = [(r) => r.user_id === userId];
    private op: 'select' | 'upsert' | 'delete' = 'select';
    private cols: string[] = [];
    private payload: Row[] = [];
    private opts: { onConflict?: string; ignoreDuplicates?: boolean } = {};
    private rng: [number, number] | null = null;
    private orderBy: string | null = null;
    private single = false;
    constructor(private table: string) {}
    select(c: string) {
      this.cols = c.split(',').map((x) => x.trim());
      return this;
    }
    order(c: string) {
      this.orderBy = c;
      return this;
    }
    range(a: number, b: number) {
      this.rng = [a, b];
      return this;
    }
    in(c: string, vals: unknown[]) {
      const set = new Set(vals);
      this.filters.push((r) => set.has(r[c]));
      return this;
    }
    neq(c: string, v: unknown) {
      this.filters.push((r) => r[c] !== v);
      return this;
    }
    maybeSingle() {
      this.single = true;
      return this;
    }
    upsert(rows: Row | Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean }) {
      this.op = 'upsert';
      this.payload = Array.isArray(rows) ? rows : [rows];
      this.opts = opts;
      return this;
    }
    delete() {
      this.op = 'delete';
      return this;
    }
    then<T>(res: (v: { data: unknown; error: null }) => T) {
      db.requests++;
      const t = (db.tables[this.table] ??= []);
      if (this.op === 'upsert') {
        const keys = (this.opts.onConflict ?? '').split(',');
        for (const p of this.payload) {
          const row: Row = { user_id: userId, ...p };
          if (row.user_id !== userId) throw new Error('RLS violation');
          const i = t.findIndex((r) => keys.every((k) => r[k] === row[k]));
          if (i < 0) t.push(row);
          else if (!this.opts.ignoreDuplicates) t[i] = row;
        }
        return Promise.resolve(res({ data: null, error: null }));
      }
      const match = t.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === 'delete') {
        db.tables[this.table] = t.filter((r) => !match.includes(r));
        return Promise.resolve(res({ data: null, error: null }));
      }
      let rows = match.map((r) => Object.fromEntries(this.cols.map((c) => [c, r[c]])));
      if (this.orderBy) rows.sort((x, y) => String(x[this.orderBy!]).localeCompare(String(y[this.orderBy!])));
      if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
      return Promise.resolve(res({ data: this.single ? (rows[0] ?? null) : rows, error: null }));
    }
  }
  return { from: (t: string) => new Q(t), auth: { onAuthStateChange: () => ({}) } };
}

const all = parseHandHistories(readFileSync(new URL('../../public/demo/sample-hands.txt', import.meta.url), 'utf8')).hands.slice(0, 120);
const deviceA = all.slice(0, 80);
const deviceB = all.slice(60, 120); // overlaps A by 20 hands

function boot(hands: typeof all, progress: Progress) {
  useStore.setState({
    hands: new Map(hands.map((h) => [h.id, h])),
    analyses: new Map(hands.map((h) => [h.id, analyzeHand(h, { iterations: 200 })])),
    progress,
    // Fake import: parse + analyze synchronously instead of in a Web Worker.
    importFiles: async (files) => {
      const s = useStore.getState();
      const hm = new Map(s.hands);
      const am = new Map(s.analyses);
      for (const f of files) for (const h of parseHandHistories(f.text).hands) if (!hm.has(h.id)) {
        hm.set(h.id, h);
        am.set(h.id, analyzeHand(h, { iterations: 200 }));
      }
      useStore.setState({ hands: hm, analyses: am });
    },
  });
}

const emptyProgress = (): Progress => ({ attempts: [], cards: {}, streak: 0, bestStreak: 0 });

describe('cloud sync between two devices', () => {
  const db = new FakeDb();
  beforeEach(() => {
    __setClientForTests(fakeClient(db, 'user-1'));
    useCloud.setState({ user: { id: 'user-1', email: 'me@example.com' }, configured: true, ready: true, error: null });
  });

  it('uploads, downloads and converges both devices to the union of hands', async () => {
    const pA: Progress = { ...emptyProgress(), attempts: [{ t: 1, drill: 'rfi', correct: true, qid: 'q1', own: false }], streak: 1, bestStreak: 1 };
    boot(deviceA, pA);
    const r1 = await syncNow();
    expect(r1).toMatchObject({ pushed: 80, pulled: 0, cloudHands: 80 });
    expect(db.tables.hands).toHaveLength(80);
    expect(useCloud.getState().error).toBeNull();

    const pB: Progress = { ...emptyProgress(), attempts: [{ t: 2, drill: 'value', correct: false, qid: 'q2', own: false }] };
    boot(deviceB, pB);
    const r2 = await syncNow();
    expect(r2).toMatchObject({ pushed: 40, pulled: 60, cloudHands: 120 });
    expect(useStore.getState().hands.size).toBe(120);
    expect(useStore.getState().progress.attempts.map((a) => a.qid)).toEqual(['q1', 'q2']);

    boot(deviceA, pA);
    const r3 = await syncNow();
    expect(r3).toMatchObject({ pushed: 0, pulled: 40, cloudHands: 120 });
    expect(useStore.getState().hands.size).toBe(120);
    expect(useStore.getState().progress.attempts).toHaveLength(2);

    // Nothing left to do: a second sync moves no hands.
    expect(await syncNow()).toMatchObject({ pushed: 0, pulled: 0 });
    // Downloaded hands re-analyze to the same ids and results on every device.
    expect(new Set(db.tables.hands.map((r) => r.hand_id))).toEqual(new Set(all.map((h) => h.id)));
  });

  it('never sees another user’s hands', async () => {
    __setClientForTests(fakeClient(db, 'user-2'));
    useCloud.setState({ user: { id: 'user-2', email: 'other@example.com' } });
    boot([], emptyProgress());
    expect(await syncNow()).toMatchObject({ pushed: 0, pulled: 0, cloudHands: 0 });
    expect(useStore.getState().hands.size).toBe(0);
  });
});

describe('mergeProgress', () => {
  it('unions attempts, keeps the most-practised card and recomputes streaks', () => {
    const a: Progress = {
      attempts: [{ t: 1, drill: 'rfi', correct: true, qid: 'a', own: false }, { t: 3, drill: 'rfi', correct: true, qid: 'c', own: false }],
      cards: { x: { box: 2, due: 10, handId: 'h', actionIndex: 1, drill: 'value', seen: 2, correct: 2 } },
      streak: 2,
      bestStreak: 2,
    };
    const b: Progress = {
      attempts: [{ t: 2, drill: 'rfi', correct: true, qid: 'b', own: false }, { t: 3, drill: 'rfi', correct: true, qid: 'c', own: false }],
      cards: { x: { box: 1, due: 5, handId: 'h', actionIndex: 1, drill: 'value', seen: 3, correct: 2 } },
      streak: 1,
      bestStreak: 1,
    };
    const m = mergeProgress(a, b);
    expect(m.attempts.map((x) => x.qid)).toEqual(['a', 'b', 'c']);
    expect(m.cards.x.seen).toBe(3);
    expect(m.streak).toBe(3);
    expect(m.bestStreak).toBe(3);
    expect(mergeProgress(m, m)).toEqual(m);
  });
});
