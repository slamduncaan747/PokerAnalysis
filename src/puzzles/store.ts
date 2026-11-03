import { create } from 'zustand';
import { mergeProfiles, newProfile, recordAttempt, type Attempt, type PuzzleProfile } from './engine.ts';
import type { Puzzle, PuzzleBank } from './types.ts';

const KEY = 'leakfinder.puzzles.v1';

function load(): PuzzleProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as PuzzleProfile;
      if (p && p.version === 1) return { ...newProfile(), ...p };
    }
  } catch {
    /* private mode or corrupt: start fresh */
  }
  return newProfile();
}

function save(p: PuzzleProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full or blocked */
  }
}

let bankPromise: Promise<Puzzle[]> | null = null;
/** The bank is a static JSON file next to index.html (~1.6 MB, ~130 kB gzipped), fetched on first use. */
export function loadBank(): Promise<Puzzle[]> {
  bankPromise ??= fetch(new URL('puzzles/bank.json', document.baseURI).toString())
    .then((r) => {
      if (!r.ok) throw new Error(`Couldn't load puzzles (${r.status})`);
      return r.json() as Promise<PuzzleBank>;
    })
    .then((b) => b.puzzles)
    .catch((e) => {
      bankPromise = null;
      throw e;
    });
  return bankPromise;
}

interface PuzzleState {
  profile: PuzzleProfile;
  bank: Puzzle[] | null;
  ensureBank: () => Promise<Puzzle[]>;
  record: (p: Puzzle, ok: boolean, mode: Attempt['mode'], key?: string) => number;
  importProfile: (p: PuzzleProfile) => void;
  resetProfile: () => void;
}

export const usePuzzles = create<PuzzleState>((set, get) => ({
  profile: load(),
  bank: null,
  ensureBank: async () => {
    const b = get().bank ?? (await loadBank());
    if (!get().bank) set({ bank: b });
    return b;
  },
  record: (p, ok, mode, key) => {
    const { profile, delta } = recordAttempt(get().profile, p, ok, mode, Date.now(), undefined, key);
    save(profile);
    set({ profile });
    return delta;
  },
  importProfile: (p) => {
    const merged = mergeProfiles(get().profile, p);
    save(merged);
    set({ profile: merged });
  },
  resetProfile: () => {
    const p = newProfile();
    save(p);
    set({ profile: p });
  },
}));

export const puzzleById = (bank: readonly Puzzle[] | null, id: string) => bank?.find((p) => p.id === id) ?? null;
