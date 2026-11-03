import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Runs the real migration on an in-process Postgres (PGlite) with a minimal stand-in for
 * Supabase's auth schema, then checks row-level security from the "authenticated" role.
 */
const migration = readFileSync(new URL('../../supabase/migrations/20261103000000_leakfinder_sync.sql', import.meta.url), 'utf8');
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
let db: PGlite;

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); set role ${user ? 'authenticated' : 'anon'};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role;');
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    insert into auth.users values ('${A}', 'a@example.com'), ('${B}', 'b@example.com');
  `);
  await db.exec(migration);
});
afterAll(async () => db?.close());

describe('supabase migration + row-level security', () => {
  it('lets a user insert and read only their own hands', async () => {
    await as(A, `insert into public.hands (hand_id, site, played_at, raw) values ('PokerStars-1', 'PokerStars', '2024-01-01T10:00:00', 'raw A')`);
    await as(B, `insert into public.hands (hand_id, site, played_at, raw) values ('PokerStars-1', 'PokerStars', null, 'raw B'), ('GGPoker-2', 'GGPoker', null, 'raw B2')`);
    const a = await as(A, 'select hand_id, raw, user_id from public.hands order by hand_id');
    expect(a.rows).toEqual([{ hand_id: 'PokerStars-1', raw: 'raw A', user_id: A }]);
    const b = await as(B, 'select count(*)::int as n from public.hands');
    expect((b.rows[0] as { n: number }).n).toBe(2);
  });

  it("blocks writing rows for someone else and anonymous access", async () => {
    await expect(as(A, `insert into public.hands (user_id, hand_id, site, raw) values ('${B}', 'X-1', 'X', 'evil')`)).rejects.toThrow(/row-level security/);
    await expect(as(null, 'select * from public.hands')).rejects.toThrow(/permission denied/);
    const del = await as(A, `delete from public.hands where user_id = '${B}' returning hand_id`);
    expect(del.rows).toHaveLength(0);
  });

  it('ignores duplicate uploads (upsert do nothing)', async () => {
    await as(A, `insert into public.hands (hand_id, site, raw) values ('PokerStars-1', 'PokerStars', 'again') on conflict (user_id, hand_id) do nothing`);
    const a = await as(A, `select raw from public.hands where hand_id = 'PokerStars-1'`);
    expect(a.rows).toEqual([{ raw: 'raw A' }]);
  });

  it('stores one training-progress document per user', async () => {
    await as(A, `insert into public.training_progress (user_id, data) values ('${A}', '{"attempts":[]}') on conflict (user_id) do update set data = excluded.data`);
    await as(A, `insert into public.training_progress (user_id, data) values ('${A}', '{"attempts":[1]}') on conflict (user_id) do update set data = excluded.data`);
    const r = await as(A, 'select data from public.training_progress');
    expect(r.rows).toEqual([{ data: { attempts: [1] } }]);
    expect((await as(B, 'select * from public.training_progress')).rows).toHaveLength(0);
  });

  it('delete_my_account removes the user and cascades their data only', async () => {
    await as(A, 'select public.delete_my_account()');
    expect((await db.query(`select count(*)::int as n from auth.users where id = '${A}'`)).rows[0]).toEqual({ n: 0 });
    expect((await db.query(`select count(*)::int as n from public.hands where user_id = '${A}'`)).rows[0]).toEqual({ n: 0 });
    expect((await db.query(`select count(*)::int as n from public.hands where user_id = '${B}'`)).rows[0]).toEqual({ n: 2 });
    await expect(as(null, 'select public.delete_my_account()')).rejects.toThrow(/permission denied/);
  });
});
