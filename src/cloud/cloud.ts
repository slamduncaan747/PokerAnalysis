import { Capacitor } from '@capacitor/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadProgress, type Progress } from '../lib/training/progress.ts';
import { useStore } from '../store.ts';
import { getCloudConfig, setCustomCloudConfig } from './config.ts';
import { batchBySize, mergeProgress, progressEqual } from './merge.ts';
import { LAST_KEY, useCloud, type SyncSummary } from './state.ts';

/**
 * Optional account + cloud sync (Supabase). Raw hand histories and training progress are
 * stored per user; every device re-analyzes locally, so the phone and computer end up identical.
 */

export { useCloud, type SyncSummary };

let client: SupabaseClient | null = null;
let clientKey = '';
let testClient: SupabaseClient | null = null;

/** Tests only: route all cloud calls to a fake client. */
export function __setClientForTests(c: unknown) {
  testClient = c as SupabaseClient | null;
}

export function supabase(): SupabaseClient | null {
  if (testClient) return testClient;
  const cfg = getCloudConfig();
  if (!cfg) return null;
  const k = `${cfg.url}|${cfg.key}`;
  if (!client || clientKey !== k) {
    client = createClient(cfg.url, cfg.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'leakfinder.auth' },
    });
    clientKey = k;
    attachAuthListener(client);
  }
  return client;
}

function attachAuthListener(c: SupabaseClient) {
  c.auth.onAuthStateChange((event, session) => {
    const user = session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null;
    useCloud.setState({ user, ready: true, recovery: event === 'PASSWORD_RECOVERY' ? true : useCloud.getState().recovery });
    if (user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
      // Defer: never call Supabase inside the auth callback itself.
      setTimeout(() => void syncNow(), 0);
    }
  });
}

/** Called once at app start. */
export function initCloud() {
  const c = supabase();
  if (!c) {
    useCloud.setState({ configured: false, ready: true });
    return;
  }
  useCloud.setState({ configured: true });
  // Strip ?code=… left by email links once Supabase has consumed it.
  setTimeout(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.has('code')) {
      u.searchParams.delete('code');
      window.history.replaceState(null, '', u.toString());
    }
  }, 3000);
  document.addEventListener('visibilitychange', () => {
    const last = useCloud.getState().last?.at ?? 0;
    if (document.visibilityState === 'visible' && Date.now() - last > 60_000) void syncNow();
  });
  // Push after local imports and (debounced) after training answers.
  useStore.getState().setHooks({
    afterImport: () => void syncNow(),
    afterProgress: () => scheduleSync(8000),
  });
}

let timer: ReturnType<typeof setTimeout> | null = null;
export function scheduleSync(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), ms);
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e));

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function redirectUrl() {
  // Native app: send email links to the website; the user then signs in with their password in the app.
  const web = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) ?? '';
  return Capacitor.isNativePlatform() && web ? web : `${window.location.origin}${window.location.pathname}`;
}

export async function signUp(email: string, password: string) {
  const c = supabase();
  if (!c) throw new Error('Cloud sync is not set up.');
  const { data, error } = await c.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl() } });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string) {
  const c = supabase();
  if (!c) throw new Error('Cloud sync is not set up.');
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const c = supabase();
  if (!c) throw new Error('Cloud sync is not set up.');
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const c = supabase();
  if (!c) throw new Error('Cloud sync is not set up.');
  const { error } = await c.auth.updateUser({ password });
  if (error) throw error;
  useCloud.setState({ recovery: false });
}

export async function signOut() {
  await supabase()?.auth.signOut();
  useCloud.setState({ user: null, last: null });
  try {
    localStorage.removeItem(LAST_KEY);
  } catch {
    /* ignore */
  }
}

export function connectCustomProject(cfg: { url: string; key: string } | null) {
  setCustomCloudConfig(cfg);
  client = null;
  useCloud.setState({ configured: !!getCloudConfig(), user: null, ready: false });
  initCloud();
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

let running: Promise<SyncSummary | null> | null = null;

export function syncNow(): Promise<SyncSummary | null> {
  if (running) return running;
  running = doSync().finally(() => {
    running = null;
  });
  return running;
}

async function remoteHandIds(c: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await c.from('hands').select('hand_id').order('hand_id').range(from, from + page - 1);
    if (error) throw error;
    for (const r of data ?? []) ids.add(r.hand_id as string);
    if (!data || data.length < page) break;
  }
  return ids;
}

async function doSync(): Promise<SyncSummary | null> {
  const c = supabase();
  const user = useCloud.getState().user;
  if (!c || !user) return null;
  useCloud.setState({ syncing: true, error: null, phase: 'Checking cloud…' });
  try {
    const store = useStore.getState();
    const local = store.hands;
    const remote = await remoteHandIds(c);

    // Push hands this device has that the cloud doesn't.
    const toPush = [...local.values()].filter((h) => !remote.has(h.id) && h.raw);
    const rows = toPush.map((h) => ({ hand_id: h.id, site: h.site, played_at: h.date || null, raw: h.raw }));
    let pushed = 0;
    for (const batch of batchBySize(rows, (r) => r.raw.length + 200)) {
      useCloud.setState({ phase: `Uploading hands ${pushed.toLocaleString()} / ${rows.length.toLocaleString()}` });
      const { error } = await c.from('hands').upsert(batch, { onConflict: 'user_id,hand_id', ignoreDuplicates: true });
      if (error) throw error;
      pushed += batch.length;
    }

    // Pull hands the cloud has that this device doesn't, then analyze them locally.
    const missing = [...remote].filter((id) => !local.has(id));
    const texts: string[] = [];
    for (let i = 0; i < missing.length; i += 150) {
      useCloud.setState({ phase: `Downloading hands ${i.toLocaleString()} / ${missing.length.toLocaleString()}` });
      const { data, error } = await c.from('hands').select('raw').in('hand_id', missing.slice(i, i + 150));
      if (error) throw error;
      for (const r of data ?? []) texts.push(r.raw as string);
    }
    if (texts.length) {
      useCloud.setState({ phase: 'Analyzing downloaded hands…' });
      await useStore.getState().importFiles([{ name: 'cloud', text: texts.join('\n\n\n') }], { fromCloud: true });
    }

    // Training progress: merge both ways.
    useCloud.setState({ phase: 'Syncing training progress…' });
    const { data: prow, error: perr } = await c.from('training_progress').select('data').maybeSingle();
    if (perr) throw perr;
    const localP = useStore.getState().progress ?? loadProgress();
    const cloudP = (prow?.data as Progress | undefined) ?? { attempts: [], cards: {}, streak: 0, bestStreak: 0 };
    const merged = mergeProgress(localP, cloudP);
    if (!progressEqual(merged, localP)) useStore.getState().setProgress(merged, { fromCloud: true });
    if (!prow || !progressEqual(merged, cloudP)) {
      const { error } = await c.from('training_progress').upsert({ user_id: user.id, data: merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
    }

    const summary: SyncSummary = { pushed, pulled: texts.length, cloudHands: remote.size + pushed, at: Date.now() };
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify(summary));
    } catch {
      /* ignore */
    }
    useCloud.setState({ syncing: false, phase: '', last: summary });
    return summary;
  } catch (e) {
    useCloud.setState({ syncing: false, phase: '', error: errMsg(e) });
    return null;
  }
}

export async function deleteCloudData() {
  const c = supabase();
  if (!c) return;
  const { error } = await c.from('hands').delete().neq('hand_id', '');
  if (error) throw error;
  const { error: e2 } = await c.from('training_progress').delete().neq('updated_at', '1970-01-01');
  if (e2) throw e2;
  useCloud.setState({ last: { pushed: 0, pulled: 0, cloudHands: 0, at: Date.now() } });
}

export async function deleteAccount() {
  const c = supabase();
  if (!c) return;
  const { error } = await c.rpc('delete_my_account');
  if (error) throw error;
  await signOut();
}
