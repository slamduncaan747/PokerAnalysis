import { Ban, Coins, DoorOpen, Drama, Hand, Layers, Percent, Shield, ShieldCheck, ShieldHalf, Swords, TrendingUp, Waves, Zap, type LucideIcon } from 'lucide-react';
import type { DrillType } from '../lib/engine/leaks.ts';
import type { ChipColor } from '../puzzles/ranks.ts';
import type { Theme } from '../puzzles/types.ts';
import { Chip } from './ui.tsx';

/** Every theme and drill is a chip with one colour and one icon, used the same way everywhere. */
export const THEME_ORDER: Theme[] = ['value', 'bluff', 'bluffcatch', 'fold', 'check', 'raise', 'preflop', 'potodds'];

export const THEME_META: Record<Theme, { name: string; blurb: string; icon: LucideIcon; chip: ChipColor }> = {
  value: { name: 'Value Bets', blurb: 'Get paid with the goods', icon: Coins, chip: 'green' },
  bluff: { name: 'Bluffs', blurb: 'Take pots you can’t win', icon: Drama, chip: 'orange' },
  bluffcatch: { name: 'Hero Calls', blurb: 'Catch them bluffing', icon: ShieldCheck, chip: 'blue' },
  fold: { name: 'Big Folds', blurb: 'Let good hands go', icon: Ban, chip: 'red' },
  check: { name: 'Pot Control', blurb: 'When to just check', icon: Hand, chip: 'slate' },
  raise: { name: 'Raises', blurb: 'For value or as a bluff', icon: TrendingUp, chip: 'purple' },
  preflop: { name: 'Preflop', blurb: 'Opens, defends, 3-bets', icon: Layers, chip: 'pink' },
  potodds: { name: 'Pot Odds', blurb: 'Fast maths, real money', icon: Percent, chip: 'teal' },
};

export const DRILL_ORDER: DrillType[] = ['rfi', 'vs_open', 'bb_defense', 'vs_3bet', 'value', 'bluffcatch', 'bluff', 'draws', 'allin', 'pot_odds'];

export const DRILL_META: Record<DrillType, { icon: LucideIcon; chip: ChipColor }> = {
  rfi: { icon: DoorOpen, chip: 'pink' },
  vs_open: { icon: Shield, chip: 'blue' },
  bb_defense: { icon: ShieldHalf, chip: 'teal' },
  vs_3bet: { icon: Swords, chip: 'purple' },
  vs_limp: { icon: Hand, chip: 'slate' },
  value: { icon: Coins, chip: 'green' },
  bluffcatch: { icon: ShieldCheck, chip: 'blue' },
  bluff: { icon: Drama, chip: 'orange' },
  draws: { icon: Waves, chip: 'teal' },
  allin: { icon: Zap, chip: 'gold' },
  pot_odds: { icon: Percent, chip: 'teal' },
};

export function ThemeChip({ theme, size = 44 }: { theme: Theme; size?: number }) {
  const m = THEME_META[theme];
  const Icon = m.icon;
  return (
    <Chip color={m.chip} size={size}>
      <Icon size={Math.round(size * 0.34)} strokeWidth={2.6} />
    </Chip>
  );
}

export function DrillChip({ drill, size = 40 }: { drill: DrillType; size?: number }) {
  const m = DRILL_META[drill];
  const Icon = m.icon;
  return (
    <Chip color={m.chip} size={size}>
      <Icon size={Math.round(size * 0.34)} strokeWidth={2.6} />
    </Chip>
  );
}
