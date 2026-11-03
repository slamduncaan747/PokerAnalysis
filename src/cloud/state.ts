import { create } from 'zustand';
import { getCloudConfig } from './config.ts';

/** Cloud/auth UI state — kept separate from the Supabase client so it loads without it. */

export const LAST_KEY = 'leakfinder.cloud.last';
export interface SyncSummary {
  pushed: number;
  pulled: number;
  cloudHands: number;
  at: number;
}

interface CloudState {
  configured: boolean;
  ready: boolean;
  user: { id: string; email: string } | null;
  syncing: boolean;
  phase: string;
  last: SyncSummary | null;
  error: string | null;
  recovery: boolean;
}

export const useCloud = create<CloudState>(() => ({
  configured: !!getCloudConfig(),
  ready: false,
  user: null,
  syncing: false,
  phase: '',
  last: loadLast(),
  error: null,
  recovery: false,
}));

function loadLast(): SyncSummary | null {
  try {
    const r = localStorage.getItem(LAST_KEY);
    return r ? (JSON.parse(r) as SyncSummary) : null;
  } catch {
    return null;
  }
}

