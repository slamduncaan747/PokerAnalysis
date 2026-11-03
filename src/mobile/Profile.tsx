import { Capacitor } from '@capacitor/core';
import { BookOpen, Laptop, Monitor, RotateCcw, Shield, Volume2, Vibrate } from 'lucide-react';
import { useState } from 'react';
import { haptic } from '../feedback.ts';
import { liveStreak, ratingSeries } from '../puzzles/engine.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { CURRENCIES, STAKES, stakeLabel, useSettings, type Currency } from '../settings.ts';
import { THEME_LINE, THEME_ORDER, ThemeBullet } from './lines.tsx';
import { setUiMode, WEB_URL } from './mode.ts';
import { Bar, Group, Mark, RatingChart, Row, Screen, Section, Segmented, Toggle } from './ui.tsx';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-3 py-3.5">
      <div className="m-num text-[24px] leading-none font-medium">{value}</div>
      <div className="m-label mt-1.5 !text-[9.5px]">{label}</div>
    </div>
  );
}

export function UnitsSettings() {
  const s = useSettings();
  return (
    <div className="m-card flex flex-col gap-5 p-4">
      <div>
        <div className="m-label mb-2">Show amounts in</div>
        <Segmented
          value={s.units}
          onChange={(units) => s.set({ units })}
          options={[
            { value: 'bb', label: 'Big blinds' },
            { value: 'money', label: 'Money' },
          ]}
        />
      </div>
      {s.units === 'money' && (
        <div className="m-fade flex flex-col gap-5">
          <div>
            <div className="m-label mb-2">Default stake</div>
            <div className="m-hscroll -mx-4 flex gap-2 px-4">
              {STAKES.map((st) => {
                const on = st.bb === s.stake.bb;
                return (
                  <button
                    key={st.bb}
                    className={`m-tap m-num shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-semibold ${on ? 'border-[var(--paper)] bg-[var(--paper)] text-[var(--ink)]' : 'border-[var(--line-2)] text-[var(--text)]'}`}
                    onClick={() => {
                      haptic.tap();
                      s.set({ stake: st });
                    }}
                  >
                    {stakeLabel(st, s.currency)}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="m-label mb-2">Currency</div>
            <Segmented<Currency> value={s.currency} onChange={(currency) => s.set({ currency })} options={CURRENCIES.map((c) => ({ value: c, label: c === '₮' ? '₮ USDT' : c }))} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[15px] font-medium">Use each hand’s real stakes</div>
              <div className="text-[13px] text-[var(--mute)]">For your imported hands. Puzzles use the default.</div>
            </div>
            <Toggle label="Use real stakes" checked={s.handStakes} onChange={(handStakes) => s.set({ handStakes })} />
          </div>
          <div className="m-mono rounded-[10px] border border-dashed border-[var(--line-2)] px-3 py-2.5 text-[12px] text-[var(--mute)]">
            A 15bb bet → <span className="text-[var(--text)]">{s.currency}{(15 * s.stake.bb).toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const profile = usePuzzles((s) => s.profile);
  const resetProfile = usePuzzles((s) => s.resetProfile);
  const settings = useSettings();
  const [confirmReset, setConfirmReset] = useState(false);
  const series = ratingSeries(profile);
  const acc = profile.games ? Math.round((profile.solved / profile.games) * 100) : 0;
  const themes = THEME_ORDER.map((t) => ({ t, ...(profile.themes[t] ?? { n: 0, ok: 0 }) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.ok / b.n - a.ok / a.n);
  const native = Capacitor.isNativePlatform();
  return (
    <Screen eyebrow="Profile" title={<>Your <em className="text-[var(--signal)]">game.</em></>}>
      <div className="m-card m-in overflow-hidden">
        <div className="p-5 pb-3">
          <div className="m-label">Puzzle rating</div>
          <div className="m-num mt-1 text-[60px] leading-[.85] font-medium tracking-[-.05em]">{profile.rating.toLocaleString()}</div>
          <div className="mt-5">
            <RatingChart data={series.slice(-120)} h={110} />
          </div>
        </div>
        <div className="grid grid-cols-3 border-t border-[var(--line)] [&>*+*]:border-l [&>*+*]:border-[var(--line)]">
          <Stat label="Best" value={profile.peak} />
          <Stat label="Played" value={profile.games} />
          <Stat label="Hit rate" value={`${acc}%`} />
        </div>
        <div className="grid grid-cols-3 border-t border-[var(--line)] [&>*+*]:border-l [&>*+*]:border-[var(--line)]">
          <Stat label="Streak" value={liveStreak(profile)} />
          <Stat label="Best streak" value={profile.bestStreak} />
          <Stat label="Best run" value={profile.bestRun} />
        </div>
      </div>

      {themes.length > 0 && (
        <Section kicker="By line" title="Strengths & leaks">
          <div className="m-card flex flex-col gap-4 p-4">
            {themes.map(({ t, n, ok }) => (
              <div key={t} className="flex items-center gap-3">
                <ThemeBullet theme={t} size={24} />
                <div className="flex-1">
                  <div className="mb-1.5 flex justify-between text-[14px]">
                    <span className="font-medium">{THEME_LINE[t].name}</span>
                    <span className="m-num text-[12px] text-[var(--mute)]">
                      {Math.round((ok / n) * 100)}% · {n}
                    </span>
                  </div>
                  <Bar value={ok / n} h={3} color={ok / n >= 0.7 ? 'var(--win)' : ok / n >= 0.5 ? 'var(--gold)' : 'var(--loss)'} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section kicker="Settings" title="Amounts">
        <UnitsSettings />
      </Section>

      <Section kicker="Settings" title="Feel">
        <Group>
          <Row icon={<Vibrate size={18} />} title="Haptics" right={<Toggle label="Haptics" checked={settings.haptics} onChange={(haptics) => settings.set({ haptics })} />} />
          <Row icon={<Volume2 size={18} />} title="Sounds" right={<Toggle label="Sounds" checked={settings.sounds} onChange={(sounds) => settings.set({ sounds })} />} />
        </Group>
      </Section>

      <Section kicker="Your hands" title="Devices">
        <Group>
          <Row icon={<Laptop size={18} />} title="Sync & devices" sub="Pair with your computer, backups" to="/devices" />
          {native ? (
            <Row icon={<Monitor size={18} />} title="Full analytics on the web" sub="Import, stats, replayer, GTO solver" href={WEB_URL} />
          ) : (
            <Row icon={<Monitor size={18} />} title="Switch to the web version" sub="Import, stats, replayer, GTO solver" onClick={() => setUiMode('web')} />
          )}
        </Group>
      </Section>

      <Section kicker="The fine print" title="About">
        <Group>
          <Row icon={<Shield size={18} />} title="Privacy" sub="Everything stays on your device" href="privacy.html" />
          <Row icon={<BookOpen size={18} />} title="Open source · AGPL-3.0" sub="Solver: postflop-solver by Wataru Inariba" href="https://github.com/slamduncaan747/PokerAnalysis" />
          {!confirmReset ? (
            <Row icon={<RotateCcw size={18} />} title="Reset puzzle progress" danger onClick={() => setConfirmReset(true)} />
          ) : (
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="flex-1 text-[14px] text-[var(--mute)]">Reset rating, history and streaks?</span>
              <button className="m-tap rounded-full border border-[var(--line-2)] px-3 py-1.5 text-[13px] font-semibold" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button
                className="m-tap rounded-full bg-[var(--loss)] px-3 py-1.5 text-[13px] font-semibold text-white"
                onClick={() => {
                  haptic.error();
                  resetProfile();
                  setConfirmReset(false);
                }}
              >
                Reset
              </button>
            </div>
          )}
        </Group>
      </Section>

      <div className="flex flex-col items-center gap-2 pt-4 pb-2">
        <Mark size={26} />
        <div className="m-serif text-[22px] italic">Made after hours in New York.</div>
        <div className="m-mono text-[10.5px] tracking-wider text-[var(--dim)] uppercase">Leakfinder {__APP_VERSION__}</div>
      </div>
    </Screen>
  );
}
