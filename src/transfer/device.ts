import { Capacitor } from '@capacitor/core';
import { strToU8, zipSync } from 'fflate';
import type { Progress } from '../lib/training/progress.ts';
import { useStore } from '../store.ts';
import type { Device } from './protocol.ts';

/** This app's data, as seen by the transfer protocol. */
export function appDevice(): Device {
  return {
    handIds: () => [...useStore.getState().hands.keys()],
    rawHands: (ids) => {
      const hands = useStore.getState().hands;
      return ids.map((id) => hands.get(id)?.raw ?? '').filter(Boolean);
    },
    importRaws: (raws) => useStore.getState().importFiles([{ name: 'other device', text: raws.join('\n\n\n') }], { fromCloud: true }),
    progress: () => useStore.getState().progress,
    setProgress: (p: Progress) => useStore.getState().setProgress(p),
  };
}

export function deviceName(): string {
  if (Capacitor.getPlatform() === 'ios') return /iPad/.test(navigator.userAgent) ? 'iPad' : 'iPhone';
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android phone';
  if (/Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  return 'computer';
}

export const PROGRESS_FILE = 'leakfinder-progress.json';

/** All hands (raw text) + training progress as one zip the Import screen understands. */
export function buildBackup(): { name: string; bytes: Uint8Array; hands: number } {
  const s = useStore.getState();
  const raws = [...s.hands.values()].map((h) => h.raw).filter(Boolean);
  const bytes = zipSync(
    {
      'leakfinder-hands.txt': strToU8(raws.join('\n\n\n')),
      [PROGRESS_FILE]: strToU8(JSON.stringify(s.progress)),
    },
    { level: 6 },
  );
  const day = new Date().toISOString().slice(0, 10);
  return { name: `leakfinder-backup-${day}.zip`, bytes, hands: raws.length };
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Saves the backup: share sheet on iOS (AirDrop, Files, Mail…), a download in browsers. */
export async function saveBackup(): Promise<number> {
  const { name, bytes, hands } = buildBackup();
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const res = await Filesystem.writeFile({ path: name, data: toBase64(bytes), directory: Directory.Cache });
    await Share.share({ title: 'Leakfinder backup', files: [res.uri] });
    return hands;
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return hands;
}
