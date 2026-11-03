import { Ban, Coins, DoorOpen, Drama, Hand, Layers, Percent, Shield, ShieldCheck, ShieldHalf, Swords, TrendingUp, Waves, Zap, type LucideIcon } from 'lucide-react';
import type { DrillType } from '../lib/engine/leaks.ts';
import type { Theme } from '../puzzles/types.ts';

/** Every puzzle theme and drill gets one icon and one system colour, used the same way everywhere. */
export const THEME_ORDER: Theme[] = ['value', 'bluff', 'bluffcatch', 'fold', 'check', 'raise', 'preflop', 'potodds'];

export const THEME_META: Record<Theme, { name: string; blurb: string; icon: LucideIcon; color: string }> = {
  value: { name: 'Value Bets', blurb: 'Get paid with strong hands', icon: Coins, color: 'var(--green)' },
  bluff: { name: 'Bluffs', blurb: 'Win pots you can’t win at showdown', icon: Drama, color: 'var(--orange)' },
  bluffcatch: { name: 'Bluff-Catching', blurb: 'Call when they bluff enough', icon: ShieldCheck, color: 'var(--blue)' },
  fold: { name: 'Big Folds', blurb: 'Let go of good-looking hands', icon: Ban, color: 'var(--red)' },
  check: { name: 'Checking', blurb: 'Control the pot, take showdowns', icon: Hand, color: 'var(--gray)' },
  raise: { name: 'Raises', blurb: 'Raise for value or as a bluff', icon: TrendingUp, color: 'var(--purple)' },
  preflop: { name: 'Preflop', blurb: 'Opens, defends and 3-bets', icon: Layers, color: 'var(--indigo)' },
  potodds: { name: 'Pot Odds', blurb: 'Quick maths that wins money', icon: Percent, color: 'var(--teal)' },
};

export const DRILL_ORDER: DrillType[] = ['rfi', 'vs_open', 'bb_defense', 'vs_3bet', 'value', 'bluffcatch', 'bluff', 'draws', 'allin', 'pot_odds'];

export const DRILL_META: Record<DrillType, { icon: LucideIcon; color: string }> = {
  rfi: { icon: DoorOpen, color: 'var(--indigo)' },
  vs_open: { icon: Shield, color: 'var(--blue)' },
  bb_defense: { icon: ShieldHalf, color: 'var(--teal)' },
  vs_3bet: { icon: Swords, color: 'var(--purple)' },
  vs_limp: { icon: Hand, color: 'var(--brown)' },
  value: { icon: Coins, color: 'var(--green)' },
  bluffcatch: { icon: ShieldCheck, color: 'var(--blue)' },
  bluff: { icon: Drama, color: 'var(--orange)' },
  draws: { icon: Waves, color: 'var(--mint)' },
  allin: { icon: Zap, color: 'var(--pink)' },
  pot_odds: { icon: Percent, color: 'var(--teal)' },
};

/** A rounded-square icon tile, like the ones in Settings. */
export function IconTile({ icon: Icon, color, size = 30 }: { icon: LucideIcon; color: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center text-white" style={{ width: size, height: size, borderRadius: size * 0.23, background: color }}>
      <Icon size={Math.round(size * 0.58)} strokeWidth={2.2} />
    </span>
  );
}

export const ThemeTile = ({ theme, size = 30 }: { theme: Theme; size?: number }) => <IconTile icon={THEME_META[theme].icon} color={THEME_META[theme].color} size={size} />;
export const DrillTile = ({ drill, size = 30 }: { drill: DrillType; size?: number }) => <IconTile icon={DRILL_META[drill].icon} color={DRILL_META[drill].color} size={size} />;
