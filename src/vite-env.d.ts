/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL for account + sync (optional). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (anon) key — safe to ship; RLS protects the data. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Public web address, used for email links sent from the native app. */
  readonly VITE_PUBLIC_SITE_URL?: string;
}
