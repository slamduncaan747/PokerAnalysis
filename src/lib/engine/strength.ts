import { COMBOS, RANK_NAMES, RANK_PLURALS, rankOf, suitOf, type Card } from '../cards.ts';
import { categoryOf, evalHole, evaluate } from './evaluator.ts';

export const DRAW_FD = 1;
export const DRAW_OESD = 2;
export const DRAW_GUT = 4;
export const DRAW_OVERS = 8;
export const DRAW_BDFD = 16;

/**
 * Board-relative strength for every combo:
 *  - hs: share of random hands this combo currently beats (0..1)
 *  - ehs: hs adjusted for draw potential on flop/turn
 *  - draws: bitmask of draw types
 */
export interface BoardStrength {
  board: Card[];
  rank: Int32Array;
  hs: Float32Array;
  ehs: Float32Array;
  ppot: Float32Array;
  draws: Uint8Array;
}

const cache = new Map<string, BoardStrength>();

export function boardStrength(board: readonly Card[]): BoardStrength {
  const key = board.join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  const dead = new Uint8Array(52);
  for (const c of board) dead[c] = 1;
  const rank = new Int32Array(1326).fill(-1);
  const valid: number[] = [];
  for (let i = 0; i < 1326; i++) {
    const [a, b] = COMBOS[i];
    if (dead[a] || dead[b]) continue;
    rank[i] = evalHole(a, b, board);
    valid.push(i);
  }
  valid.sort((x, y) => rank[y] - rank[x]); // worst first
  const hs = new Float32Array(1326).fill(NaN);
  const n = valid.length;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && rank[valid[j + 1]] === rank[valid[i]]) j++;
    const ties = j - i;
    const val = (i + ties / 2) / (n - 1);
    for (let k = i; k <= j; k++) hs[valid[k]] = val;
    i = j + 1;
  }
  const ehs = new Float32Array(1326).fill(NaN);
  const ppot = new Float32Array(1326);
  const draws = new Uint8Array(1326);
  const toCome = 5 - board.length;
  for (const idx of valid) {
    const [a, b] = COMBOS[idx];
    let outs = 0;
    if (toCome > 0) {
      const d = drawInfo(a, b, board);
      draws[idx] = d.flags;
      outs = d.outs;
    }
    const p = toCome === 2 ? 1 - (1 - outs / 47) * (1 - outs / 46) : toCome === 1 ? outs / 46 : 0;
    ppot[idx] = p;
    ehs[idx] = hs[idx] + (1 - hs[idx]) * p * 0.85;
  }
  const res: BoardStrength = { board: [...board], rank, hs, ehs, ppot, draws };
  if (cache.size > 64) cache.clear();
  cache.set(key, res);
  return res;
}

function straightMask(mask: number): boolean {
  // mask bits 0..12 = ranks 2..A; ace also plays low.
  const m = (mask << 1) | ((mask >> 12) & 1);
  for (let lo = 0; lo <= 9; lo++) if (((m >> lo) & 0b11111) === 0b11111) return true;
  return false;
}

export function drawInfo(a: Card, b: Card, board: readonly Card[]): { flags: number; outs: number } {
  let flags = 0;
  const all = [a, b, ...board];
  const made = categoryOf(evaluate(all));
  const suitCount = [0, 0, 0, 0];
  for (const c of all) suitCount[suitOf(c)]++;
  let flushOuts = 0;
  if (made !== 'Flush' && made !== 'Straight Flush' && made !== 'Full House' && made !== 'Four of a Kind') {
    for (let s = 0; s < 4; s++) {
      const holeIn = (suitOf(a) === s ? 1 : 0) + (suitOf(b) === s ? 1 : 0);
      if (suitCount[s] === 4 && holeIn > 0) {
        flags |= DRAW_FD;
        flushOuts = holeIn === 2 ? 9 : 7;
      } else if (suitCount[s] === 3 && holeIn === 2 && board.length === 3) {
        flags |= DRAW_BDFD;
      }
    }
  }
  let sdOuts = 0;
  if (made !== 'Straight' && made !== 'Straight Flush' && made !== 'Flush' && made !== 'Full House' && made !== 'Four of a Kind') {
    let mask = 0;
    let bmask = 0;
    for (const c of all) mask |= 1 << rankOf(c);
    for (const c of board) bmask |= 1 << rankOf(c);
    let n = 0;
    for (let r = 0; r < 13; r++) {
      if (mask & (1 << r)) continue;
      if (straightMask(mask | (1 << r)) && !straightMask(bmask | (1 << r))) n++;
    }
    if (n >= 2) {
      flags |= DRAW_OESD;
      sdOuts = 8;
    } else if (n === 1) {
      flags |= DRAW_GUT;
      sdOuts = 4;
    }
  }
  let overOuts = 0;
  const top = Math.max(...board.map(rankOf));
  if (made === 'High Card' && rankOf(a) > top && rankOf(b) > top) {
    flags |= DRAW_OVERS;
    overOuts = 3; // 6 outs, heavily discounted
  }
  let outs = flushOuts + sdOuts + overOuts;
  if (flushOuts && sdOuts) outs -= sdOuts === 8 ? 2 : 1;
  return { flags, outs };
}

export type StrengthBucket = 'nuts' | 'strong' | 'medium' | 'weak' | 'air';
export function bucketOf(hs: number): StrengthBucket {
  if (hs >= 0.97) return 'nuts';
  if (hs >= 0.88) return 'strong';
  if (hs >= 0.72) return 'medium';
  if (hs >= 0.55) return 'weak';
  return 'air';
}

export const BUCKET_LABEL: Record<StrengthBucket, string> = {
  nuts: 'near-nut hands',
  strong: 'strong value hands',
  medium: 'medium-strength hands',
  weak: 'weak made hands',
  air: 'air / missed hands',
};

/** Human description of a holding, e.g. "Top pair, good kicker + flush draw". */
export function describeHand(hole: readonly [Card, Card], board: readonly Card[]): string {
  const [a, b] = hole;
  const r1 = Math.max(rankOf(a), rankOf(b));
  const r2 = Math.min(rankOf(a), rankOf(b));
  if (board.length < 3) {
    if (r1 === r2) return `Pocket ${RANK_PLURALS[r1]}`;
    return `${RANK_NAMES[r1]}-${RANK_NAMES[r2]} ${suitOf(a) === suitOf(b) ? 'suited' : 'offsuit'}`;
  }
  const rank = evalHole(a, b, board);
  const cat = categoryOf(rank);
  const boardRanks = [...new Set(board.map(rankOf))].sort((x, y) => y - x);
  const boardCat = board.length >= 5 ? categoryOf(evaluate(board)) : null;
  const boardCounts = new Map<number, number>();
  for (const c of board) boardCounts.set(rankOf(c), (boardCounts.get(rankOf(c)) ?? 0) + 1);
  let label: string;
  switch (cat) {
    case 'One Pair': {
      if (r1 === r2) {
        if (r1 > boardRanks[0]) label = `Overpair (${RANK_PLURALS[r1]})`;
        else if (r1 < boardRanks[boardRanks.length - 1]) label = `Underpair (${RANK_PLURALS[r1]})`;
        else label = `Pocket ${RANK_PLURALS[r1]} (middle pair)`;
      } else {
        const paired = boardCounts.has(r1) ? r1 : boardCounts.has(r2) ? r2 : -1;
        if (paired < 0) {
          label = `${RANK_NAMES[r1]} high (pair on board)`;
        } else {
          const kicker = paired === r1 ? r2 : r1;
          const pos = boardRanks.indexOf(paired);
          const which = pos === 0 ? 'Top pair' : pos === 1 ? 'Second pair' : pos === boardRanks.length - 1 ? 'Bottom pair' : 'Third pair';
          let kick = '';
          if (pos === 0) {
            const best = [12, 11, 10, 9].find((k) => k !== paired && !boardCounts.has(k)) ?? 12;
            kick = kicker >= best ? ', top kicker' : kicker >= 8 ? ', good kicker' : ', weak kicker';
          }
          label = `${which}${kick}`;
        }
      }
      break;
    }
    case 'Two Pair': {
      const holeOnBoard = [r1, r2].filter((r) => boardCounts.has(r));
      if (r1 !== r2 && holeOnBoard.length === 2) label = 'Two pair';
      else if (r1 === r2) label = 'Two pair (pocket pair + board pair)';
      else if (holeOnBoard.length === 1) label = 'Two pair (one pair on board)';
      else label = 'Two pair on board';
      break;
    }
    case 'Three of a Kind':
      if (r1 === r2 && boardCounts.get(r1) === 1) label = `Set of ${RANK_PLURALS[r1]}`;
      else if ([r1, r2].some((r) => boardCounts.get(r) === 2)) label = 'Trips';
      else label = 'Trips on board';
      break;
    case 'High Card':
      label = `${RANK_NAMES[r1]} high`;
      break;
    default:
      label = cat;
  }
  if (boardCat && boardCat === cat && evaluate(board) <= rank && cat !== 'High Card' && cat !== 'One Pair') label += ' (playing the board)';
  if (board.length < 5) {
    const { flags } = drawInfo(a, b, board);
    const extras: string[] = [];
    if (flags & DRAW_FD) extras.push('flush draw');
    if (flags & DRAW_OESD) extras.push('open-ended straight draw');
    else if (flags & DRAW_GUT) extras.push('gutshot');
    if (!extras.length && flags & DRAW_BDFD) extras.push('backdoor flush draw');
    if (extras.length) label += ' + ' + extras.join(' + ');
  }
  return label;
}

/** Board texture summary for explanations. */
export function describeBoard(board: readonly Card[]): string {
  if (board.length < 3) return '';
  const suits = [0, 0, 0, 0];
  for (const c of board) suits[suitOf(c)]++;
  const maxSuit = Math.max(...suits);
  const ranks = board.map(rankOf).sort((x, y) => y - x);
  const paired = new Set(ranks).size < ranks.length;
  const parts: string[] = [];
  if (maxSuit >= 4) parts.push('four-flush');
  else if (maxSuit === 3) parts.push(board.length === 3 ? 'monotone' : 'three-flush');
  else if (maxSuit === 2 && board.length === 3) parts.push('two-tone');
  else if (board.length === 3) parts.push('rainbow');
  if (paired) parts.push('paired');
  const uniq = [...new Set(ranks)];
  let mask = 0;
  for (const r of uniq) mask |= 1 << r;
  let connected = 0;
  for (let lo = -1; lo <= 8; lo++) {
    let cnt = 0;
    for (let k = 0; k < 5; k++) {
      const r = lo + k;
      if (r === -1 ? mask & (1 << 12) : mask & (1 << r)) cnt++;
    }
    connected = Math.max(connected, cnt);
  }
  if (connected >= 3) parts.push('connected');
  else if (ranks[0] >= 10 && !paired) parts.push(ranks[1] >= 9 ? 'high' : 'dry');
  else parts.push('dry');
  return parts.join(', ');
}
