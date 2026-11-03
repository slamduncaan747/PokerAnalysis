import type { Theme } from '../puzzles/types.ts';

/**
 * The house motif: streets and puzzle themes as NYC subway bullets.
 * F and R ride their real line colours (orange B/D/F/M, yellow N/Q/R/W).
 */
export const STREET_LINE: Record<string, { letter: string; bg: string; fg: string; name: string }> = {
  preflop: { letter: 'P', bg: '#a7a9ac', fg: '#0d0d0b', name: 'Preflop' },
  flop: { letter: 'F', bg: '#ff6319', fg: '#ffffff', name: 'Flop' },
  turn: { letter: 'T', bg: '#00add0', fg: '#ffffff', name: 'Turn' },
  river: { letter: 'R', bg: '#fccc0a', fg: '#0d0d0b', name: 'River' },
};

export const THEME_ORDER: Theme[] = ['value', 'bluff', 'bluffcatch', 'fold', 'check', 'raise', 'preflop', 'potodds'];

export const THEME_LINE: Record<Theme, { letter: string; bg: string; fg: string; name: string; blurb: string }> = {
  value: { letter: 'V', bg: '#00933c', fg: '#fff', name: 'Value bets', blurb: 'Get paid with the goods' },
  bluff: { letter: 'B', bg: '#ff6319', fg: '#fff', name: 'Bluffs', blurb: 'Take pots you can’t win' },
  bluffcatch: { letter: 'C', bg: '#0039a6', fg: '#fff', name: 'Bluff-catching', blurb: 'Call when they’re lying' },
  fold: { letter: 'F', bg: '#ee352e', fg: '#fff', name: 'Big folds', blurb: 'Let pretty hands go' },
  check: { letter: 'X', bg: '#808183', fg: '#fff', name: 'Checking', blurb: 'Pot control, free cards' },
  raise: { letter: 'R', bg: '#fccc0a', fg: '#0d0d0b', name: 'Raises', blurb: 'For value or as a bluff' },
  preflop: { letter: 'P', bg: '#b933ad', fg: '#fff', name: 'Preflop', blurb: 'Opens, defends, 3-bets' },
  potodds: { letter: '%', bg: '#6cbe45', fg: '#0d0d0b', name: 'Pot odds', blurb: 'Fast maths, real money' },
};

export function Bullet({ letter, bg, fg, size = 22, className = '' }: { letter: string; bg: string; fg: string; size?: number; className?: string }) {
  return (
    <span className={`m-bullet ${className}`} style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.58) }}>
      {letter}
    </span>
  );
}

export const StreetBullet = ({ street, size = 20 }: { street: string; size?: number }) => {
  const l = STREET_LINE[street.toLowerCase()] ?? STREET_LINE.preflop;
  return <Bullet letter={l.letter} bg={l.bg} fg={l.fg} size={size} />;
};

export const ThemeBullet = ({ theme, size = 30 }: { theme: Theme; size?: number }) => {
  const l = THEME_LINE[theme];
  return <Bullet letter={l.letter} bg={l.bg} fg={l.fg} size={size} />;
};
