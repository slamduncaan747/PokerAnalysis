// Checks appstore/metadata.md against App Store Connect field limits.
import { readFileSync } from 'node:fs';
const md = readFileSync(new URL('./metadata.md', import.meta.url), 'utf8');
const section = (h) => md.split(`## ${h}`)[1].split('\n## ')[0].replace(/^[^\n]*\n/, '').trim();
const row = (label) => md.match(new RegExp(`\\| ${label.replace(/[()]/g, '\\$&')} \\| (.+?) \\|`))[1].trim();
const checks = [
  ['Name', row('Name (≤30)'), 30],
  ['Subtitle', row('Subtitle (≤30)'), 30],
  ['Promotional text', section('Promotional text (≤170)'), 170],
  ['Description', section('Description (≤4000)'), 4000],
  ['Keywords', section('Keywords (≤100, comma-separated, no spaces needed)'), 100],
];
let ok = true;
for (const [name, text, max] of checks) {
  const n = [...text].length;
  console.log(`${n <= max ? 'ok ' : 'TOO LONG'} ${name}: ${n}/${max}`);
  if (n > max) ok = false;
}
process.exit(ok ? 0 : 1);
