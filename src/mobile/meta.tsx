import { Ban, Coins, DoorOpen, Drama, Hand, Layers, Percent, Shield, ShieldCheck, ShieldHalf, Swords, TrendingUp, Waves, Zap, type LucideIcon } from 'lucide-react';
import type { DrillType } from '../lib/engine/leaks.ts';
import type { ChipColor } from '../puzzles/ranks.ts';
import type { Theme } from '../puzzles/types.ts';
import { IconBadge } from './ui.tsx';

/** Every theme and drill has one accent colour and one icon. */
export const THEME_ORDER: Theme[] = ['value', 'bluff', 'bluffcatch', 'fold', 'check', 'raise', 'preflop', 'potodds'];

export const THEME_META: Record<Theme, { name: string; blurb: string; icon: LucideIcon; chip: ChipColor }> = {
  value: { name: 'Value bets', blurb: 'Get paid with the goods', icon: Coins, chip: 'green' },
  bluff: { name: 'Bluffs', blurb: 'Take pots you can’t win', icon: Drama, chip: 'purple' },
  bluffcatch: { name: 'Hero calls', blurb: 'Catch them bluffing', icon: ShieldCheck, chip: 'blue' },
  fold: { name: 'Big folds', blurb: 'Let good hands go', icon: Ban, chip: 'red' },
  check: { name: 'Pot control', blurb: 'When to just check', icon: Hand, chip: 'teal' },
  raise: { name: 'Raises', blurb: 'For value or as a bluff', icon: TrendingUp, chip: 'pink' },
  preflop: { name: 'Preflop', blurb: 'Opens, defends and 3‑bets', icon: Layers, chip: 'orange' },
  potodds: { name: 'Pot odds', blurb: 'Fast maths, real money', icon: Percent, chip: 'gold' },
};

export const DRILL_ORDER: DrillType[] = ['rfi', 'vs_open', 'bb_defense', 'vs_3bet', 'value', 'bluffcatch', 'bluff', 'draws', 'allin', 'pot_odds'];

export const DRILL_META: Record<DrillType, { icon: LucideIcon; chip: ChipColor }> = {
  rfi: { icon: DoorOpen, chip: 'orange' },
  vs_open: { icon: Shield, chip: 'blue' },
  bb_defense: { icon: ShieldHalf, chip: 'teal' },
  vs_3bet: { icon: Swords, chip: 'purple' },
  vs_limp: { icon: Hand, chip: 'teal' },
  value: { icon: Coins, chip: 'green' },
  bluffcatch: { icon: ShieldCheck, chip: 'blue' },
  bluff: { icon: Drama, chip: 'purple' },
  draws: { icon: Waves, chip: 'pink' },
  allin: { icon: Zap, chip: 'red' },
  pot_odds: { icon: Percent, chip: 'gold' },
};

export function ThemeChip({ theme, size = 44 }: { theme: Theme; size?: number }) {
  const m = THEME_META[theme];
  const Icon = m.icon;
  return (
    <IconBadge color={m.chip} size={size}>
      <Icon size={Math.round(size * 0.5)} strokeWidth={2.5} />
    </IconBadge>
  );
}

export function DrillChip({ drill, size = 40 }: { drill: DrillType; size?: number }) {
  const m = DRILL_META[drill];
  const Icon = m.icon;
  return (
    <IconBadge color={m.chip} size={size}>
      <Icon size={Math.round(size * 0.5)} strokeWidth={2.5} />
    </IconBadge>
  );
}
