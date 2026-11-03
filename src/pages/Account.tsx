import { Cloud, CloudOff, KeyRound, LogOut, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Pill, SectionTitle } from '../components/ui.tsx';
import { getCloudConfig } from '../cloud/config.ts';
import {
  deleteAccount, deleteCloudData, sendPasswordReset, signIn, signOut, signUp, syncNow, updatePassword, useCloud, connectCustomProject,
} from '../cloud/cloud.ts';
import { useStore } from '../store.ts';

const inputCls = 'w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent';
const msg = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e));

function timeAgo(t: number) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleString();
}

function AuthForm() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      if (mode === 'in') await signIn(email, password);
      else if (mode === 'up') {
        const r = await signUp(email, password);
        setNote({ ok: true, text: r.needsConfirmation ? 'Check your email to confirm your account, then sign in here.' : 'Account created — you are signed in.' });
      } else {
        await sendPasswordReset(email);
        setNote({ ok: true, text: 'If that email has an account, a reset link is on its way.' });
      }
    } catch (err) {
      setNote({ ok: false, text: msg(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="panel flex flex-col gap-3 p-5">
      <div className="flex gap-1 rounded-lg bg-panel-2 p-1 text-sm">
        {(['in', 'up'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 rounded-md py-1.5 font-medium ${mode === m ? 'bg-panel-3 text-ink' : 'text-mute'}`}>
            {m === 'in' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-xs text-mute">
        Email
        <input id="auth-email" className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {mode !== 'reset' && (
        <label className="flex flex-col gap-1 text-xs text-mute">
          Password
          <input
            id="auth-password"
            className={inputCls}
            type="password"
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? 'Working…' : mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}
      </button>
      {note && <div className={`text-sm ${note.ok ? 'text-accent' : 'text-loss'}`}>{note.text}</div>}
      <button type="button" className="self-start text-xs text-mute hover:text-ink" onClick={() => setMode(mode === 'reset' ? 'in' : 'reset')}>
        {mode === 'reset' ? '← Back to sign in' : 'Forgot password?'}
      </button>
    </form>
  );
}

function NewPassword() {
  const [pw, setPw] = useState('');
  const [note, setNote] = useState<string | null>(null);
  return (
    <form
      className="panel flex flex-col gap-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await updatePassword(pw);
          setNote('Password updated.');
        } catch (err) {
          setNote(msg(err));
        }
      }}
    >
      <div className="flex items-center gap-2 font-semibold">
        <KeyRound size={16} /> Choose a new password
      </div>
      <input id="new-password" className={inputCls} type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} />
      <button className="btn btn-primary self-start">Save password</button>
      {note && <div className="text-sm text-mute">{note}</div>}
    </form>
  );
}

function Confirm({ label, warn, onConfirm }: { label: string; warn: string; onConfirm: () => Promise<void> }) {
  const [step, setStep] = useState<'idle' | 'ask' | 'busy'>('idle');
  const [err, setErr] = useState<string | null>(null);
  if (step === 'idle')
    return (
      <button className="btn btn-ghost text-loss" onClick={() => setStep('ask')}>
        <Trash2 size={14} /> {label}
      </button>
    );
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-loss/40 bg-loss/5 p-3 text-sm">
      <span>{warn}</span>
      <div className="flex gap-2">
        <button
          className="btn !bg-loss text-white"
          disabled={step === 'busy'}
          onClick={async () => {
            setStep('busy');
            try {
              await onConfirm();
              setStep('idle');
            } catch (e) {
              setErr(msg(e));
              setStep('ask');
            }
          }}
        >
          {step === 'busy' ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button className="btn btn-ghost" onClick={() => setStep('idle')}>
          Cancel
        </button>
      </div>
      {err && <span className="text-loss">{err}</span>}
    </div>
  );
}

function CustomProject() {
  const cfg = getCloudConfig();
  const [url, setUrl] = useState(cfg?.source === 'custom' ? cfg.url : '');
  const [key, setKey] = useState(cfg?.source === 'custom' ? cfg.key : '');
  return (
    <details className="panel p-4 text-sm">
      <summary className="cursor-pointer text-mute">Advanced: use your own Supabase project</summary>
      <div className="mt-3 flex flex-col gap-2">
        <p className="text-xs text-dim">
          Paste the project URL and publishable key of a Supabase project that has the Leakfinder tables (see <code>supabase/migrations</code> in the source). Saved in this browser only.
        </p>
        <input id="sb-url" className={inputCls} placeholder="https://xxxx.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input id="sb-key" className={inputCls} placeholder="Publishable (anon) key" value={key} onChange={(e) => setKey(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={!url || !key} onClick={() => connectCustomProject({ url, key })}>
            Connect
          </button>
          {cfg?.source === 'custom' && (
            <button className="btn btn-ghost" onClick={() => connectCustomProject(null)}>
              Reset to default
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

export default function Account() {
  const cloud = useCloud();
  const localHands = useStore((s) => s.hands.size);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          {cloud.user ? <Cloud className="text-accent" /> : <CloudOff className="text-mute" />} Account &amp; sync
        </h1>
        <p className="mt-1 text-sm text-mute">
          Sign in on your computer and your phone to keep the same hands, reviews and training progress everywhere. Without an account everything stays on this
          device only.
        </p>
      </div>

      {!cloud.configured && (
        <div className="panel p-5 text-sm text-mute">
          Cloud sync isn't connected in this build yet. Your hands are stored on this device.
        </div>
      )}

      {cloud.configured && !cloud.ready && <div className="text-sm text-mute">Connecting…</div>}
      {cloud.configured && cloud.ready && cloud.recovery && <NewPassword />}
      {cloud.configured && cloud.ready && !cloud.user && !cloud.recovery && <AuthForm />}

      {cloud.user && (
        <>
          <div className="panel flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs text-mute">Signed in as</div>
                <div className="font-semibold">{cloud.user.email}</div>
              </div>
              <button className="btn btn-ghost" onClick={() => signOut()}>
                <LogOut size={14} /> Sign out
              </button>
            </div>
            <div className="rounded-xl border border-line bg-panel-2 p-4">
              <SectionTitle
                right={
                  <button className="btn btn-primary !py-1.5" disabled={cloud.syncing} onClick={() => syncNow()}>
                    <RefreshCw size={14} className={cloud.syncing ? 'animate-spin' : ''} /> {cloud.syncing ? 'Syncing…' : 'Sync now'}
                  </button>
                }
              >
                Sync
              </SectionTitle>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-mute">On this device</div>
                  <div className="text-lg font-semibold tabular-nums">{localHands.toLocaleString()} hands</div>
                </div>
                <div>
                  <div className="text-xs text-mute">In your account</div>
                  <div className="text-lg font-semibold tabular-nums">{cloud.last ? `${cloud.last.cloudHands.toLocaleString()} hands` : '—'}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-mute">
                {cloud.syncing
                  ? cloud.phase
                  : cloud.last
                    ? `Last synced ${timeAgo(cloud.last.at)} · ${cloud.last.pushed} uploaded · ${cloud.last.pulled} downloaded`
                    : 'Not synced yet.'}
              </div>
              {cloud.error && <div className="mt-2 text-sm text-loss">Sync failed: {cloud.error}</div>}
              <p className="mt-3 text-[11px] text-dim">Syncs automatically after imports, when you return to the app, and after training.</p>
            </div>
            <div className="flex items-start gap-2 text-xs text-dim">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              Your account stores your raw hand history text and training progress. Only you can read them (row-level security).
            </div>
          </div>

          <div className="panel flex flex-col gap-3 p-5">
            <SectionTitle>Danger zone</SectionTitle>
            <Confirm label="Delete synced hands" warn="Delete every hand and your training progress from your account? Hands on this device stay." onConfirm={deleteCloudData} />
            <Confirm label="Delete account" warn="Permanently delete your account and all synced data? This can't be undone." onConfirm={deleteAccount} />
          </div>
        </>
      )}

      <Pill>Tip: on iPhone, open this site in Safari → Share → Add to Home Screen, or use the iOS app.</Pill>
      <CustomProject />
    </div>
  );
}
