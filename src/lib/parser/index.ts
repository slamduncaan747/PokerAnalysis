import { parseCards } from '../cards.ts';
import type { ParseResult, Street } from '../types.ts';
import { HandBuilder } from './builder.ts';

/**
 * Hand history parser for No-Limit Hold'em.
 *
 * Supported formats:
 *  - PokerStars (cash, zoom, tournaments)
 *  - GGPoker / Natural8 exports ("Poker Hand #...")
 *  - Winning Poker Network / ACR ("Game Hand #...")
 *  - Winamax
 *  - Ignition / Bovada / Bodog
 *  - Anything else that follows the PokerStars text layout closely.
 */

const HEADER_RES: RegExp[] = [
  /^PokerStars (?:Zoom |Home Game )?(?:Hand|Game) #/,
  /^Poker Hand #/,
  /^Game Hand #/,
  /^Winamax Poker - /,
  /^(?:Ignition|Bovada|Bodog) (?:Hand|Game) #/,
  /^Hand #\d+/, // generic stars-like
];

const AMT = String.raw`[$€£¥₹]?\s?([\d,]+(?:\.\d+)?)\s?(?:[$€£¥₹]|USD|EUR|GBP)?`;

export function parseNumber(s: string): number {
  const cleaned = s.replace(/[^\d.,-]/g, '');
  // Handle "1.234,56" (EU) vs "1,234.56"
  if (/,\d{1,2}$/.test(cleaned) && cleaned.includes('.')) return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  return parseFloat(cleaned.replace(/,/g, ''));
}

export function splitHands(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/^﻿/, '').split('\n');
  const chunks: string[] = [];
  let cur: string[] = [];
  for (const line of lines) {
    const l = line.trimEnd();
    if (HEADER_RES.some((re) => re.test(l.trimStart()))) {
      if (cur.some((x) => x.trim())) chunks.push(cur.join('\n').trim());
      cur = [l.trimStart()];
    } else if (cur.length) {
      cur.push(l);
    }
  }
  if (cur.some((x) => x.trim())) chunks.push(cur.join('\n').trim());
  return chunks;
}

function isNLHE(header: string): boolean {
  const h = header.toLowerCase();
  if (/omaha|stud|razz|draw|badugi|short ?deck|6\+|courchevel|plo/.test(h)) return false;
  if (/pot limit|pot-limit|fixed limit|\blimit\b/.test(h.replace(/no limit|no-limit|nolimit/g, ''))) return false;
  return /hold'?em|holdem/.test(h);
}

function parseDate(s: string | undefined): string {
  if (!s) return '';
  const m = s.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return '';
  const pad = (x: string) => x.padStart(2, '0');
  return `${m[1]}-${pad(m[2])}-${pad(m[3])}T${pad(m[4])}:${m[5]}:${m[6] ?? '00'}`;
}

function currencyOf(s: string): string {
  if (s.includes('€')) return 'EUR';
  if (s.includes('£')) return 'GBP';
  if (s.includes('$') || /USD/.test(s)) return 'USD';
  return '';
}

export function parseHandHistories(text: string): ParseResult {
  const result: ParseResult = { hands: [], errors: [], skipped: 0 };
  const seen = new Set<string>();
  for (const chunk of splitHands(text)) {
    const header = chunk.split('\n', 1)[0];
    if (!isNLHE(header) && !/^(Ignition|Bovada|Bodog)/.test(header)) {
      result.skipped++;
      continue;
    }
    try {
      const b = /^(Ignition|Bovada|Bodog)/.test(header) ? parseIgnition(chunk) : parseStarsFamily(chunk);
      if (!b) {
        result.skipped++;
        continue;
      }
      const hand = b.finish();
      if (seen.has(hand.id)) continue;
      seen.add(hand.id);
      result.hands.push(hand);
    } catch (e) {
      result.errors.push({ snippet: header.slice(0, 160), message: (e as Error).message });
    }
  }
  result.hands.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return result;
}

// ---------------------------------------------------------------------------
// PokerStars family (PokerStars, GG, ACR/WPN, Winamax, generic)
// ---------------------------------------------------------------------------

function parseStarsHeader(b: HandBuilder, header: string) {
  let m: RegExpMatchArray | null;
  if ((m = header.match(/^PokerStars (?:Zoom |Home Game )?(?:Hand|Game) #(\d+)/))) {
    b.site = 'PokerStars';
    b.id = m[1];
  } else if ((m = header.match(/^Poker Hand #([A-Z]*\d+)/))) {
    b.site = 'GGPoker';
    b.id = m[1];
  } else if ((m = header.match(/^Game Hand #(\d+)/))) {
    b.site = 'ACR';
    b.id = m[1];
  } else if ((m = header.match(/HandId: #([\d-]+)/))) {
    b.site = 'Winamax';
    b.id = m[1];
  } else if ((m = header.match(/^Hand #(\d+)/))) {
    b.site = 'Generic';
    b.id = m[1];
  }
  b.currency = currencyOf(header);
  const tm = header.match(/Tournament #(\d+)/i);
  if (tm || /Tournament/i.test(header)) {
    b.gameType = 'tournament';
    b.tournamentId = tm?.[1];
    b.currency = '';
  }
  // Blinds: "(0.25/0.50" or "($0.25/$0.50" or "Level IV (50/100)" or "Level10(200/400(50))" or "- $0.01/$0.02 -" or "(0.01€/0.02€)"
  const bm =
    header.match(/\(\s*[$€£]?([\d.,]+)\s?[€$£]?\s*\/\s*[$€£]?([\d.,]+)\s?[€$£]?(?:\s*\(([\d.,]+)\))?/) ??
    header.match(/-\s*[$€£]?([\d.,]+)\s?[€$£]?\/[$€£]?([\d.,]+)\s?[€$£]?\s*-/);
  if (bm) {
    b.sb = parseNumber(bm[1]);
    b.bb = parseNumber(bm[2]);
    if (bm[3]) b.ante = parseNumber(bm[3]);
  }
  b.date = parseDate(header);
}

function matchName(line: string, names: string[]): [string, string] | null {
  for (const n of names) {
    if (line.startsWith(n)) {
      const rest = line.slice(n.length);
      if (rest.startsWith(': ')) return [n, rest.slice(2)];
      if (rest.startsWith(' ')) return [n, rest.slice(1)];
      if (rest === ':' || rest === '') return [n, ''];
    }
  }
  return null;
}

function parseStarsFamily(chunk: string): HandBuilder | null {
  const b = new HandBuilder();
  b.raw = chunk;
  const lines = chunk.split('\n');
  parseStarsHeader(b, lines[0]);
  let section: 'pre' | 'play' | 'summary' = 'pre';
  let names: string[] = [];
  let street: Street = 'preflop';
  let headerExtra = lines[0];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let m: RegExpMatchArray | null;

    if (line.startsWith('***')) {
      const sm = line.match(/^\*\*\*\s*(FIRST |SECOND |THIRD )?(HOLE CARDS|FLOP|TURN|RIVER|SHOW ?DOWN|SUMMARY|PRE-FLOP|DEALING HAND)/i);
      if (sm) {
        const which = (sm[1] ?? '').trim().toUpperCase();
        const tag = sm[2].toUpperCase();
        if (tag === 'SUMMARY') section = 'summary';
        else if (tag === 'HOLE CARDS' || tag === 'PRE-FLOP' || tag === 'DEALING HAND') section = 'play';
        else if (tag === 'FLOP' || tag === 'TURN' || tag === 'RIVER') {
          section = 'play';
          // Run-it-twice: only the first board is used for analysis.
          if (which === 'SECOND' || which === 'THIRD') continue;
          street = tag.toLowerCase() as Street;
          const brackets = [...line.matchAll(/\[([^\]]+)\]/g)].map((x) => x[1]);
          const newCards = brackets.length ? parseCards(brackets[brackets.length - 1]) : [];
          const cards = tag === 'FLOP' ? parseCards(brackets[0] ?? '') : newCards;
          b.events.push({ kind: 'street', street, cards });
        }
      }
      continue;
    }

    if (section === 'pre') {
      if ((m = line.match(/^Table:? '([^']+)'(.*)$/))) {
        b.table = m[1];
        const rest = m[2];
        const mx = rest.match(/(\d+)-max/);
        if (mx) b.maxSeats = parseInt(mx[1]);
        const bt = rest.match(/Seat #(\d+) is the button/);
        if (bt) b.buttonSeat = parseInt(bt[1]);
        continue;
      }
      if ((m = line.match(/^Seat (\d+): (.+?) \(\s*[$€£]?\s?([\d.,]+)\s?[€$£]?(?: in chips)?(?:[,;][^)]*)?\)(.*)$/))) {
        b.seats.push({
          seat: parseInt(m[1]),
          name: m[2],
          stack: parseNumber(m[3]),
          sittingOut: /sitting out|out of hand/i.test(m[4]),
        });
        names = b.seats.map((s) => s.name).sort((x, y) => y.length - x.length);
        continue;
      }
      // Winamax/ACR sometimes put level/blind info on line 2
      if (!b.bb && /Level|Blinds/i.test(line)) headerExtra += ' ' + line;
    }

    if (section === 'summary') {
      if ((m = line.match(/^Total pot\s*[$€£]?\s?([\d.,]+)/i))) {
        b.totalPot = parseNumber(m[1]);
        const rk = line.match(/Rake\s*[$€£]?\s?([\d.,]+)/i);
        if (rk) b.rake = parseNumber(rk[1]);
        continue;
      }
      if ((m = line.match(/^Seat \d+: (.+?) (?:\([^)]*\) )*(?:showed|mucked) \[([^\]]+)\]/))) {
        const nm = names.find((n) => m![1] === n || m![1].startsWith(n));
        if (nm && !b.shown[nm]) b.shown[nm] = parseCards(m[2]);
      }
      continue;
    }

    // Dealt to
    if ((m = line.match(/^Dealt to (.+?) \[([^\]]+)\]/))) {
      const nm = names.find((n) => n === m![1]) ?? m[1];
      const cards = parseCards(m[2]);
      if (cards.length === 2) {
        b.hero = nm;
        b.heroCards = cards;
      }
      continue;
    }
    if ((m = line.match(/^Uncalled bet \(\s*[$€£]?\s?([\d.,]+)\s?[€$£]?\s*\) returned to (.+)$/))) {
      const nm = m[2].trim();
      b.uncalled[nm] = (b.uncalled[nm] ?? 0) + parseNumber(m[1]);
      continue;
    }

    const nm = matchName(line, names);
    if (!nm) continue;
    const [player, rest0] = nm;
    const rest = rest0.trim();
    const allIn = /all-in|all in/i.test(rest);

    if ((m = rest.match(new RegExp(`^posts (?:the |a )?(small & big blinds|small blind|big blind|straddle|dead small blind|dead big blind|dead blind|ante|bring-in|missed blind)\\s*${AMT}`, 'i')))) {
      const kind = m[1].toLowerCase();
      const amount = parseNumber(m[2]);
      if (kind === 'small & big blinds') {
        b.events.push({ kind: 'post', player, post: 'bb', amount, live: b.bb || amount * (2 / 3), allIn });
      } else if (kind === 'small blind') {
        if (!b.sb) b.sb = amount;
        b.events.push({ kind: 'post', player, post: 'sb', amount, allIn });
      } else if (kind === 'big blind') {
        if (!b.bb) b.bb = amount;
        b.events.push({ kind: 'post', player, post: 'bb', amount, allIn });
      } else if (kind === 'straddle') {
        b.events.push({ kind: 'post', player, post: 'straddle', amount, allIn });
      } else if (kind === 'ante') {
        if (!b.ante) b.ante = amount;
        b.events.push({ kind: 'post', player, post: 'ante', amount, allIn });
      } else {
        b.events.push({ kind: 'post', player, post: 'dead', amount, allIn });
      }
      continue;
    }
    if (/^folds/i.test(rest)) {
      b.events.push({ kind: 'fold', player });
      continue;
    }
    if (/^checks/i.test(rest)) {
      b.events.push({ kind: 'check', player });
      continue;
    }
    if ((m = rest.match(new RegExp(`^calls\\s*${AMT}`, 'i')))) {
      b.events.push({ kind: 'call', player, amount: parseNumber(m[1]), allIn });
      continue;
    }
    if ((m = rest.match(new RegExp(`^bets\\s*${AMT}`, 'i')))) {
      b.events.push({ kind: 'bet', player, amount: parseNumber(m[1]), allIn });
      continue;
    }
    if ((m = rest.match(new RegExp(`^raises\\s*${AMT}\\s*to\\s*${AMT}`, 'i')))) {
      b.events.push({ kind: 'raise', player, to: parseNumber(m[2]), allIn });
      continue;
    }
    if ((m = rest.match(new RegExp(`^collected\\s*${AMT}\\s*from`, 'i')))) {
      b.addCollected(player, parseNumber(m[1]));
      continue;
    }
    if ((m = rest.match(/^(?:shows|mucks hand|mucks)\s*\[([^\]]+)\]/i))) {
      const cards = parseCards(m[1]);
      if (cards.length === 2) b.shown[player] = cards;
      continue;
    }
  }

  if (!b.bb) {
    const bm = headerExtra.match(/\(\s*[$€£]?([\d.,]+)\s?[€$£]?\s*\/\s*[$€£]?([\d.,]+)/);
    if (bm) {
      b.sb = parseNumber(bm[1]);
      b.bb = parseNumber(bm[2]);
    }
  }
  if (!b.buttonSeat) {
    const bt = chunk.match(/Seat #(\d+) is the button/);
    if (bt) b.buttonSeat = parseInt(bt[1]);
  }
  return b;
}

// ---------------------------------------------------------------------------
// Ignition / Bovada / Bodog
// ---------------------------------------------------------------------------

function parseIgnition(chunk: string): HandBuilder | null {
  const b = new HandBuilder();
  b.raw = chunk;
  const lines = chunk.split('\n');
  const header = lines[0];
  const hm = header.match(/^(Ignition|Bovada|Bodog) (?:Hand|Game) #(\d+)/);
  if (!hm) return null;
  b.site = 'Ignition';
  b.id = hm[2];
  b.currency = 'USD';
  if (/Tournament/i.test(header)) {
    b.gameType = 'tournament';
    b.tournamentId = header.match(/Tournament #?(\d+)/i)?.[1];
  }
  if (/omaha|stud/i.test(header)) return null;
  b.date = parseDate(header);
  const tm = header.match(/TBL#(\d+)/);
  if (tm) b.table = tm[1];
  b.maxSeats = 6;
  let section: 'pre' | 'play' | 'summary' = 'pre';
  let street: Street = 'preflop';
  const clean = (n: string) => n.replace(/\s*\[ME\]\s*$/, '').trim();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let m: RegExpMatchArray | null;
    if (line.startsWith('***')) {
      const sm = line.match(/^\*\*\*\s*(HOLE CARDS|FLOP|TURN|RIVER|SUMMARY)/i);
      if (sm) {
        const tag = sm[1].toUpperCase();
        if (tag === 'SUMMARY') section = 'summary';
        else if (tag === 'HOLE CARDS') section = 'play';
        else {
          section = 'play';
          street = tag.toLowerCase() as Street;
          const brackets = [...line.matchAll(/\[([^\]]+)\]/g)].map((x) => x[1]);
          const cards = tag === 'FLOP' ? parseCards(brackets[0] ?? '') : parseCards(brackets[brackets.length - 1] ?? '');
          b.events.push({ kind: 'street', street, cards });
        }
      }
      continue;
    }
    if (section === 'summary') {
      if ((m = line.match(/^Total Pot\(\s*\$?([\d.,]+)\)/i))) b.totalPot = parseNumber(m[1]);
      continue;
    }
    if ((m = line.match(/^Seat (\d+): (.+?) \(\s*\$?([\d.,]+) in chips\)/))) {
      const name = clean(m[2]);
      b.seats.push({ seat: parseInt(m[1]), name, stack: parseNumber(m[3]), sittingOut: false });
      if (/\[ME\]/.test(m[2])) b.hero = name;
      continue;
    }
    const am = line.match(/^(.+?)\s*:\s*(.+)$/);
    if (!am) continue;
    const player = clean(am[1]);
    const rest = am[2].trim();
    if ((m = rest.match(/^Set dealer \[(\d+)\]/i))) {
      b.buttonSeat = parseInt(m[1]);
      continue;
    }
    if ((m = rest.match(/^Card dealt to a spot \[([^\]]+)\]/i))) {
      const cards = parseCards(m[1]);
      if (player === b.hero) b.heroCards = cards;
      else if (cards.length === 2) b.shown[player] = cards;
      continue;
    }
    if ((m = rest.match(/^Small Blind\s*\$?([\d.,]+)/i))) {
      const amount = parseNumber(m[1]);
      if (!b.sb) b.sb = amount;
      b.events.push({ kind: 'post', player, post: 'sb', amount });
      continue;
    }
    if ((m = rest.match(/^Big blind\s*\$?([\d.,]+)/i))) {
      const amount = parseNumber(m[1]);
      if (!b.bb) b.bb = amount;
      b.events.push({ kind: 'post', player, post: 'bb', amount });
      continue;
    }
    if ((m = rest.match(/^Posts (?:dead )?chip\s*\$?([\d.,]+)/i))) {
      b.events.push({ kind: 'post', player, post: 'bb', amount: parseNumber(m[1]) });
      continue;
    }
    if ((m = rest.match(/^Ante chip\s*\$?([\d.,]+)/i))) {
      const amount = parseNumber(m[1]);
      if (!b.ante) b.ante = amount;
      b.events.push({ kind: 'post', player, post: 'ante', amount });
      continue;
    }
    if (/^Folds?\b/i.test(rest)) {
      b.events.push({ kind: 'fold', player });
      continue;
    }
    if (/^Checks?\b/i.test(rest)) {
      b.events.push({ kind: 'check', player });
      continue;
    }
    if ((m = rest.match(/^Calls?\s*\$?([\d.,]+)/i))) {
      b.events.push({ kind: 'call', player, amount: parseNumber(m[1]) });
      continue;
    }
    if ((m = rest.match(/^Bets?\s*\$?([\d.,]+)/i))) {
      b.events.push({ kind: 'bet', player, amount: parseNumber(m[1]) });
      continue;
    }
    if ((m = rest.match(/^(?:Raises|All-in\(raise\))\s*\$?([\d.,]+)\s*to\s*\$?([\d.,]+)/i))) {
      b.events.push({ kind: 'raise', player, to: parseNumber(m[2]), allIn: /all-in/i.test(rest) });
      continue;
    }
    if ((m = rest.match(/^All-in\s*\$?([\d.,]+)/i))) {
      b.events.push({ kind: 'allin', player, amount: parseNumber(m[1]) });
      continue;
    }
    if ((m = rest.match(/^Return uncalled portion of bet\s*\$?([\d.,]+)/i))) {
      b.uncalled[player] = (b.uncalled[player] ?? 0) + parseNumber(m[1]);
      continue;
    }
    if ((m = rest.match(/^Hand result(?:-Side pot)?\s*\$?([\d.,]+)/i))) {
      b.addCollected(player, parseNumber(m[1]));
      continue;
    }
    if ((m = rest.match(/^(?:Showdown|Does not show|Mucks)\s*\[([^\]]+)\]/i))) {
      const cards = parseCards(m[1]);
      if (cards.length === 2 && player !== b.hero) b.shown[player] = cards;
      continue;
    }
  }
  if (!b.bb && b.sb) b.bb = b.sb * 2;
  return b;
}
