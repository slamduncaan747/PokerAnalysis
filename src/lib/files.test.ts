import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { decodeText, isZip, unzipText } from './files.ts';
import { COINPOKER_CASH } from './parser/fixtures.ts';
import { parseHandHistories } from './parser/index.ts';

describe('file decoding', () => {
  it('decodes UTF-8 (with/without BOM) and UTF-16 (with/without BOM)', () => {
    const s = 'CoinPoker Hand #1: NLH (₮0.05/₮0.10)';
    const u8 = new TextEncoder().encode(s);
    expect(decodeText(u8)).toBe(s);
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...u8]))).toBe(s);
    const u16 = new Uint8Array(s.length * 2);
    for (let i = 0; i < s.length; i++) {
      u16[i * 2] = s.charCodeAt(i) & 0xff;
      u16[i * 2 + 1] = s.charCodeAt(i) >> 8;
    }
    expect(decodeText(u16)).toBe(s);
    expect(decodeText(new Uint8Array([0xff, 0xfe, ...u16]))).toBe(s);
  });

  it('reads hand histories out of a zip download', () => {
    const zip = zipSync({
      'HandHistory/session-1.txt': strToU8(COINPOKER_CASH),
      'HandHistory/readme.pdf': new Uint8Array([1, 2, 3]),
      '__MACOSX/._session-1.txt': strToU8('junk'),
    });
    expect(isZip(zip)).toBe(true);
    const files = unzipText('coinpoker.zip', zip);
    expect(files.map((f) => f.name)).toEqual(['coinpoker.zip/HandHistory/session-1.txt']);
    expect(parseHandHistories(files[0].text).hands).toHaveLength(3);
  });
});
