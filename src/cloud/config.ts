/**
 * Where the cloud (Supabase) lives. Baked in at build time from
 * VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY, or set on the Account page
 * ("Use my own Supabase project"), which is stored in this browser.
 * The publishable key is safe to ship: row-level security limits every user to their own rows.
 */
export interface CloudConfig {
  url: string;
  key: string;
  source: 'build' | 'custom';
}

const KEY = 'leakfinder.cloud.config';

export function getCloudConfig(): CloudConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const c = JSON.parse(raw) as { url: string; key: string };
      if (c.url && c.key) return { ...c, source: 'custom' };
    }
  } catch {
    /* storage unavailable */
  }
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  const key = ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined) ?? '';
  return url && key ? { url, key, source: 'build' } : null;
}

export function setCustomCloudConfig(c: { url: string; key: string } | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify({ url: c.url.trim().replace(/\/+$/, ''), key: c.key.trim() }));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
