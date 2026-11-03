import { clear, createStore, entries, setMany, get, set } from 'idb-keyval';
import type { HandAnalysis } from './lib/engine/types.ts';
import type { Hand } from './lib/types.ts';

/** Everything stays in this browser's IndexedDB — nothing is uploaded anywhere. */
const store = createStore('leakfinder-db', 'kv');

export const ENGINE_VERSION = 4;

export async function loadAll(): Promise<{ hands: Hand[]; analyses: HandAnalysis[]; engineVersion: number | null }> {
  const all = await entries(store);
  const hands: Hand[] = [];
  const analyses: HandAnalysis[] = [];
  let engineVersion: number | null = null;
  for (const [k, v] of all) {
    const key = String(k);
    if (key.startsWith('h:')) hands.push(v as Hand);
    else if (key.startsWith('a:')) analyses.push(v as HandAnalysis);
    else if (key === 'meta') engineVersion = (v as { engineVersion: number }).engineVersion;
  }
  return { hands, analyses, engineVersion };
}

export async function saveBatch(hands: Hand[], analyses: HandAnalysis[]) {
  const items: [string, unknown][] = [];
  for (const h of hands) items.push([`h:${h.id}`, h]);
  for (const a of analyses) items.push([`a:${a.handId}`, a]);
  await setMany(items, store);
  await set('meta', { engineVersion: ENGINE_VERSION }, store);
}

export async function clearAll() {
  await clear(store);
}

export async function getMeta() {
  return get('meta', store);
}
