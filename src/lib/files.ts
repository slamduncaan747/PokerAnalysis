import { unzipSync } from 'fflate';

/**
 * Turns whatever the user dropped (single .txt files, whole folders, or a .zip download such as
 * CoinPoker's or PokerStars' exports) into decoded text files.
 */

const TEXT_EXT = /\.(txt|log|hh|csv|xml)$/i;

/** Decode bytes as UTF-8 or UTF-16 (with or without BOM), dropping any BOM. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3));
  // UTF-16 without a BOM: lots of zero bytes in alternating positions.
  const n = Math.min(bytes.length, 2000);
  let zEven = 0;
  let zOdd = 0;
  for (let i = 0; i < n; i++) if (bytes[i] === 0) (i % 2 ? zOdd++ : zEven++);
  if (zOdd > n * 0.3 && zEven < n * 0.05) return new TextDecoder('utf-16le').decode(bytes);
  if (zEven > n * 0.3 && zOdd < n * 0.05) return new TextDecoder('utf-16be').decode(bytes);
  return new TextDecoder('utf-8').decode(bytes);
}

export const isZip = (bytes: Uint8Array) => bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

/** Expand a zip archive into text files (nested zips included). */
export function unzipText(name: string, bytes: Uint8Array, depth = 0): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  const entries = unzipSync(bytes);
  for (const [path, data] of Object.entries(entries)) {
    if (path.endsWith('/') || path.includes('__MACOSX') || /(^|\/)\./.test(path)) continue;
    if (isZip(data) && depth < 2) out.push(...unzipText(`${name}/${path}`, data, depth + 1));
    else if (TEXT_EXT.test(path) || !/\.[a-z0-9]{1,5}$/i.test(path)) out.push({ name: `${name}/${path}`, text: decodeText(data) });
  }
  return out;
}

export async function readHandFiles(list: FileList | File[]): Promise<{ name: string; text: string }[]> {
  const out: { name: string; text: string }[] = [];
  for (const f of [...list]) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (isZip(bytes) || /\.zip$/i.test(f.name)) {
      try {
        out.push(...unzipText(f.name, bytes));
      } catch {
        /* not a readable zip — ignore */
      }
    } else if (TEXT_EXT.test(f.name) || f.type.startsWith('text/') || !f.type) {
      out.push({ name: f.name, text: decodeText(bytes) });
    }
  }
  return out;
}
