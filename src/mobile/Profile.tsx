import { Capacitor } from '@capacitor/core';
import { BookOpen, Laptop, Monitor, RotateCcw, Shield, Smartphone, Volume2, Vibrate } from 'lucide-react';
import { useState } from 'react';
import { haptic } from '../feedback.ts';
import { liveStreak, ratingSeries } from '../puzzles/engine.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { THEMES, type Theme } from '../puzzles/types.ts';
import { CURRENCIES, STAKES, stakeLabel, useSettings, type Currency } from '../settings.ts';
import { Bar, Group, RatingChart, Row, Screen, Section, Segmented, Toggle } from './ui.tsx';
import { setUiMode, WEB_URL } from './mode.ts';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="m-card-2 px-3 py-3">
      <div className="m-num text-[22px] leading-none font-extrabold">{value}</div>
      <div className="mt-1 text-[12px] font-semibold text-dim">{label}</div>
    </div>
  );
}

export function UnitsSettings() {
  const s = useSettings();
  return (
    <div className="m-card flex flex-col gap-4 p-4">
      <div>
        <div className="mb-2 text-[15px] font-semibold">Show amounts in</div>
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
        <div className="m-fade flex flex-col gap-4">
          <div>
            <div className="mb-2 text-[15px] font-semibold">Default stake</div>
            <div className="m-hscroll -mx-4 flex gap-2 px-4">
              {STAKES.map((st) => {
                const on = st.bb === s.stake.bb;
                return (
                  <button
                    key={st.bb}
                    className={`m-tap m-num shrink-0 rounded-full px-3.5 py-2 text-[14px] font-bold ${on ? 'bg-accent text-[#03140b]' : 'bg-white/[.07] text-ink'}`}
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
            <div className="mb-2 text-[15px] font-semibold">Currency</div>
            <Segmented<Currency> value={s.currency} onChange={(currency) => s.set({ currency })} options={CURRENCIES.map((c) => ({ value: c, label: c === '₮' ? '₮ USDT' : c }))} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[15px] font-semibold">Use each hand’s real stakes</div>
              <div className="text-[13px] text-mute">For your imported hands; puzzles use the default stake.</div>
            </div>
            <Toggle label="Use real stakes" checked={s.handStakes} onChange={(handStakes) => s.set({ handStakes })} />
          </div>
          <div className="rounded-[12px] bg-white/[.04] px-3 py-2 text-[13px] text-mute">
            Example: a 15bb bet shows as <b className="text-ink">{s.currency}{(15 * s.stake.bb).toFixed(2)}</b>
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
  const themes = (Object.keys(THEMES) as Theme[])
    .map((t) => ({ t, ...(profile.themes[t] ?? { n: 0, ok: 0 }) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.ok / b.n - a.ok / a.n);
  const native = Capacitor.isNativePlatform();
  return (
    <Screen title="Profile">
      <div className="m-card m-in p-4">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-[30px]" style={{ background: 'linear-gradient(135deg,#3ecf8e,#1c6fd1)' }}>
            ♠
          </div>
          <div>
            <div className="m-label">Puzzle rating</div>
            <div className="m-num text-[36px] leading-none font-black">{profile.rating.toLocaleString()}</div>
          </div>
        </div>
        <div className="mt-4">
          <RatingChart data={series.slice(-120)} h={120} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Best rating" value={profile.peak} />
          <Stat label="Played" value={profile.games} />
          <Stat label="Solved" value={`${acc}%`} />
          <Stat label="Daily streak" value={liveStreak(profile)} />
          <Stat label="Best streak" value={profile.bestStreak} />
          <Stat label="Best run" value={profile.bestRun} />
        </div>
      </div>

      {themes.length > 0 && (
        <Section title="Strengths & weaknesses">
          <div className="m-card flex flex-col gap-3 p-4">
            {themes.map(({ t, n, ok }) => (
              <div key={t}>
                <div className="mb-1 flex justify-between text-[14px]">
                  <span className="font-semibold">
                    {THEMES[t].emoji} {THEMES[t].label}
                  </span>
                  <span className="m-num text-mute">
                    {Math.round((ok / n) * 100)}% · {n}
                  </span>
                </div>
                <Bar value={ok / n} color={ok / n >= 0.7 ? 'var(--color-accent)' : ok / n >= 0.5 ? '#f3c23a' : 'var(--color-loss)'} />
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Amounts">
        <UnitsSettings />
      </Section>

      <Section title="Feel">
        <Group>
          <Row icon={<Vibrate size={18} />} title="Haptics" right={<Toggle label="Haptics" checked={settings.haptics} onChange={(haptics) => settings.set({ haptics })} />} />
          <Row icon={<Volume2 size={18} />} title="Sounds" right={<Toggle label="Sounds" checked={settings.sounds} onChange={(sounds) => settings.set({ sounds })} />} />
        </Group>
      </Section>

      <Section title="Your hands">
        <Group>
          <Row icon={<Laptop size={18} />} title="Sync & devices" sub="Pair with your computer, backups" to="/devices" />
          {native ? (
            <Row icon={<Monitor size={18} />} title="Full analytics on the web" sub="Import, stats, replayer, GTO solver" href={WEB_URL} />
          ) : (
            <Row icon={<Monitor size={18} />} title="Switch to the full web version" sub="Import, stats, replayer, GTO solver" onClick={() => setUiMode('web')} />
          )}
        </Group>
      </Section>

      <Section title="About">
        <Group>
          <Row icon={<Shield size={18} />} title="Privacy" sub="Everything stays on your device" href="privacy.html" />
          <Row icon={<BookOpen size={18} />} title="Open source (AGPL-3.0)" sub="Solver: postflop-solver by Wataru Inariba" href="https://github.com/slamduncaan747/PokerAnalysis" />
          {!confirmReset ? (
            <Row icon={<RotateCcw size={18} />} title="Reset puzzle progress" danger onClick={() => setConfirmReset(true)} />
          ) : (
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="flex-1 text-[14px] text-mute">Reset rating, history and streaks?</span>
              <button className="m-tap rounded-full bg-white/10 px-3 py-1.5 text-[14px] font-semibold" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button
                className="m-tap rounded-full bg-loss px-3 py-1.5 text-[14px] font-bold text-white"
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
      <div className="flex items-center justify-center gap-1.5 pb-2 text-[12px] text-dim">
        <Smartphone size={13} /> Leakfinder {__APP_VERSION__}
      </div>
    </Screen>
  );
}
