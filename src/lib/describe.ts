import { cardsToString } from './cards.ts';
import type { Action, Hand, Street } from './types.ts';

const fmt = (x: number) => `${Math.round(x * 100) / 100}bb`;

export function actorLabel(hand: Hand, name: string): string {
  if (name === hand.hero) return 'you';
  return hand.players.find((p) => p.name === name)?.position ?? name;
}

function verb(a: Action, bb: number, isHero: boolean): string {
  const s = isHero ? '' : 's';
  switch (a.type) {
    case 'fold':
      return `fold${s}`;
    case 'check':
      return `check${s}`;
    case 'call':
      return `call${s} ${fmt(a.amount / bb)}${a.allIn ? ' (all-in)' : ''}`;
    case 'bet':
      return `bet${s} ${fmt(a.toAmount / bb)}${a.allIn ? ' (all-in)' : ''}`;
    case 'raise':
      return `raise${s} to ${fmt(a.toAmount / bb)}${a.allIn ? ' (all-in)' : ''}`;
    default:
      return '';
  }
}

/** One readable line per street for the actions before `uptoIndex` (exclusive). */
export function describeActions(hand: Hand, uptoIndex: number): { street: Street; text: string }[] {
  const out: { street: Street; text: string }[] = [];
  const byStreet = new Map<Street, Action[]>();
  hand.actions.slice(0, uptoIndex).forEach((a) => {
    if (a.type === 'post') return;
    if (!byStreet.has(a.street)) byStreet.set(a.street, []);
    byStreet.get(a.street)!.push(a);
  });
  const heroPos = hand.players.find((p) => p.isHero)?.position;
  for (const street of ['preflop', 'flop', 'turn', 'river'] as Street[]) {
    const acts = byStreet.get(street) ?? [];
    const target = hand.actions[uptoIndex];
    const boardCount = street === 'flop' ? 3 : street === 'turn' ? 4 : street === 'river' ? 5 : 0;
    if (!acts.length && !(target && target.street === street)) continue;
    const parts: string[] = [];
    let i = 0;
    let folds = 0;
    while (i < acts.length && acts[i].type === 'fold' && acts[i].player !== hand.hero) {
      folds++;
      i++;
    }
    if (folds >= 2 && street === 'preflop') {
      const next = acts[i] ?? target;
      parts.push(`folds to ${next ? actorLabel(hand, next.player) : '…'}`);
    } else i = 0;
    for (; i < acts.length; i++) {
      const a = acts[i];
      const who = actorLabel(hand, a.player);
      if (a.type === 'fold' && a.player !== hand.hero && street === 'preflop' && acts.slice(i + 1).every((x) => x.type === 'fold')) {
        // trailing folds preflop are noise
        const rest = acts.length - i;
        parts.push(rest > 1 ? 'others fold' : `${who} folds`);
        break;
      }
      parts.push(`${who} ${verb(a, hand.bb, a.player === hand.hero)}`);
    }
    const label = street === 'preflop' ? `Preflop (you're ${heroPos})` : `${street[0].toUpperCase()}${street.slice(1)} ${cardsToString(hand.board.slice(0, boardCount))}`;
    out.push({ street, text: `${label}: ${parts.join(', ') || '—'}` });
  }
  return out;
}
