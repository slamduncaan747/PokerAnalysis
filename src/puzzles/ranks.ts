/**
 * Ranks: your puzzle rating as a casino chip. Colours follow real chip denominations
 * (white $1, red $5, green $25, black $100, purple $500, gold $1K).
 */
export type ChipColor = 'white' | 'red' | 'green' | 'black' | 'purple' | 'gold' | 'blue' | 'orange' | 'teal' | 'pink' | 'slate';

export interface Tier {
  name: string;
  min: number;
  denom: string;
  color: ChipColor;
  blurb: string;
}

export const TIERS: Tier[] = [
  { name: 'Fish', min: 0, denom: '1', color: 'white', blurb: 'Everyone starts somewhere' },
  { name: 'Rec', min: 900, denom: '5', color: 'red', blurb: 'Knows the basics' },
  { name: 'Grinder', min: 1150, denom: '25', color: 'green', blurb: 'Solid and getting sharper' },
  { name: 'Reg', min: 1400, denom: '100', color: 'black', blurb: 'Tough to play against' },
  { name: 'Shark', min: 1700, denom: '500', color: 'purple', blurb: 'Finds the hard plays' },
  { name: 'Crusher', min: 2000, denom: '1K', color: 'gold', blurb: 'Elite decisions' },
];

export function tierOf(rating: number): { tier: Tier; next?: Tier; progress: number; toNext: number } {
  let i = 0;
  while (i + 1 < TIERS.length && rating >= TIERS[i + 1].min) i++;
  const tier = TIERS[i];
  const next = TIERS[i + 1];
  if (!next) return { tier, progress: 1, toNext: 0 };
  return { tier, next, progress: Math.max(0, Math.min(1, (rating - tier.min) / (next.min - tier.min))), toNext: next.min - rating };
}
