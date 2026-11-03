import { describe, expect, it } from 'vitest';
import { formatAmount, rewriteAmounts, STAKES, stakeLabel, type Settings } from './settings.ts';

const bb: Settings = { units: 'bb', stake: STAKES[1], currency: '$', handStakes: true, haptics: true, sounds: true };
const money: Settings = { ...bb, units: 'money' };

describe('units', () => {
  it('formats big blinds', () => {
    expect(formatAmount(12.5, bb)).toBe('12.5bb');
    expect(formatAmount(3, bb)).toBe('3bb');
    expect(formatAmount(-2.26, bb)).toBe('−2.3bb');
  });
  it('formats money at the default stake', () => {
    expect(formatAmount(15, money)).toBe('$0.75');
    expect(formatAmount(15, { ...money, stake: STAKES[7], currency: '₮' })).toBe('₮75.00');
    expect(formatAmount(400, { ...money, stake: STAKES[7] })).toBe('$2,000');
  });
  it('uses a hand’s own stakes when asked, and keeps tournament chips in bb', () => {
    expect(formatAmount(10, money, { bb: 0.25, currency: 'USD' })).toBe('$2.50');
    expect(formatAmount(10, money, { bb: 0.25, currency: 'USDT' })).toBe('₮2.50');
    expect(formatAmount(10, { ...money, handStakes: false }, { bb: 0.25, currency: 'USD' })).toBe('$0.50');
    expect(formatAmount(10, money, { bb: 400, currency: '', tournament: true })).toBe('10bb');
  });
  it('rewrites amounts inside text but not rates or positions', () => {
    const t = 'BB bets 6.03bb into 9.2bb; you win 24bb/100 and need 30%.';
    expect(rewriteAmounts(t, bb)).toBe(t);
    expect(rewriteAmounts(t, money)).toBe('BB bets $0.30 into $0.46; you win 24bb/100 and need 30%.');
    expect(rewriteAmounts('Call 2.5 bb', money)).toBe('Call $0.13');
  });
  it('labels stakes', () => {
    expect(stakeLabel(STAKES[1])).toBe('$0.02/$0.05');
    expect(stakeLabel(STAKES[7], '₮')).toBe('₮2/₮5');
  });
});
