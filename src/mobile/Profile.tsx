import { Capacitor } from '@capacitor/core';
import { BookOpen, Check, Coins, Globe, Laptop, Lock, Monitor, Vibrate, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { haptic } from '../feedback.ts';
import { liveStreak, ratingSeries } from '../puzzles/engine.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { CURRENCIES, STAKES, stakeLabel, useSettings, type Currency } from '../settings.ts';
import { IconTile, THEME_META, THEME_ORDER, ThemeTile } from './meta.tsx';
import { setUiMode, WEB_URL } from './mode.ts';
import { Bar, Group, RatingChart, Row, Screen, Section, Toggle } from './ui.tsx';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-4 py-3">
      <div className="t-rounded t-num text-[22px] leading-tight font-bold">{value}</div>
      <div className="t-foot c-2">{label}</div>
    </div>
  );
}

const CURRENCY_NAME: Record<Currency, string> = { $: 'US Dollar ($)', '€': 'Euro (€)', '£': 'Pound (£)', '₮': 'Tether (₮ USDT)' };

/** Settings detail screen: a list with a checkmark, like Settings › Display & Brightness. */
export function SettingsSelect() {
  const { key } = useParams();
  const s = useSettings();
  const pick = (patch: Parameters<typeof s.set>[0]) => {
    haptic.tap();
    s.set(patch);
  };
  const check = (on: boolean) => (on ? <Check size={20} strokeWidth={2.6} className="c-tint shrink-0" /> : null);
  if (key === 'units')
    return (
      <Screen title="Amounts" back backLabel="Profile">
        <Section footer="Money uses your default stake. Your own hands can use their real stakes instead.">
          <Group>
            <Row title="Big Blinds" sub="12.5 bb" right={check(s.units === 'bb')} onClick={() => pick({ units: 'bb' })} chevron={false} />
            <Row title="Money" sub={`${s.currency}${(12.5 * s.stake.bb).toFixed(2)} at ${stakeLabel(s.stake, s.currency)}`} right={check(s.units === 'money')} onClick={() => pick({ units: 'money' })} chevron={false} />
          </Group>
        </Section>
      </Screen>
    );
  if (key === 'stake')
    return (
      <Screen title="Default Stake" back backLabel="Profile">
        <Group>
          {STAKES.map((st) => (
            <Row key={st.bb} title={stakeLabel(st, s.currency)} right={check(st.bb === s.stake.bb)} onClick={() => pick({ stake: st })} chevron={false} />
          ))}
        </Group>
      </Screen>
    );
  return (
    <Screen title="Currency" back backLabel="Profile">
      <Group>
        {CURRENCIES.map((c) => (
          <Row key={c} title={CURRENCY_NAME[c]} right={check(c === s.currency)} onClick={() => pick({ currency: c })} chevron={false} />
        ))}
      </Group>
    </Screen>
  );
}

/** iOS-style confirmation sheet. */
function ConfirmSheet({ title, action, onConfirm, onCancel }: { title: string; action: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="m-fade fixed inset-0 z-50 flex items-end" style={{ background: 'var(--sheet-dim)' }} onClick={onCancel}>
      <div className="m-sheet-in m-safe-bottom mx-auto w-full max-w-[600px] px-2 pb-2" onClick={(e) => e.stopPropagation()}>
        <div className="overflow-hidden rounded-[14px]" style={{ background: 'var(--elev)' }}>
          <div className="t-foot c-2 px-4 py-3.5 text-center">{title}</div>
          <button className="t-body m-row-press h-[57px] w-full text-[20px] c-red" style={{ boxShadow: 'inset 0 .5px 0 var(--sep)' }} onClick={onConfirm}>
            {action}
          </button>
        </div>
        <button className="m-row-press mt-2 h-[57px] w-full rounded-[14px] text-[20px] font-semibold c-tint" style={{ background: 'var(--elev)' }} onClick={onCancel}>
          Cancel
        </button>
      </div>
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
  const themes = THEME_ORDER.map((t) => ({ t, ...(profile.themes[t] ?? { n: 0, ok: 0 }) })).filter((x) => x.n > 0);
  const native = Capacitor.isNativePlatform();
  const money = settings.units === 'money';
  return (
    <Screen title="Profile">
      <div className="m-card m-in overflow-hidden">
        <div className="p-4 pb-2">
          <div className="t-sub c-2">Puzzle Rating</div>
          <div className="t-rounded t-num text-[44px] leading-[1.05] font-bold">{profile.rating.toLocaleString()}</div>
          <div className="mt-3">
            <RatingChart data={series.slice(-120)} h={100} />
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3" style={{ boxShadow: 'inset 0 .5px 0 var(--sep)' }}>
          <Stat label="Best" value={profile.peak.toLocaleString()} />
          <Stat label="Played" value={profile.games} />
          <Stat label="Solved" value={`${acc}%`} />
          <Stat label="Day Streak" value={liveStreak(profile)} />
          <Stat label="Best Streak" value={profile.bestStreak} />
          <Stat label="Best Run" value={profile.bestRun} />
        </div>
      </div>

      {themes.length > 0 && (
        <Section title="By Theme">
          <Group inset={58}>
            {themes.map(({ t, n, ok }) => (
              <div key={t} className="flex items-center gap-3 px-4 py-2.5">
                <ThemeTile theme={t} />
                <div className="flex-1">
                  <div className="mb-1.5 flex justify-between">
                    <span className="t-body">{THEME_META[t].name}</span>
                    <span className="t-body c-2 t-num">{Math.round((ok / n) * 100)}%</span>
                  </div>
                  <Bar value={ok / n} color={ok / n >= 0.7 ? 'var(--green)' : ok / n >= 0.5 ? 'var(--orange)' : 'var(--red)'} />
                </div>
              </div>
            ))}
          </Group>
        </Section>
      )}

      <Section title="Display" small footer={money ? `A 15 bb bet shows as ${settings.currency}${(15 * settings.stake.bb).toFixed(2)}.` : undefined}>
        <Group inset={58}>
          <Row icon={<IconTile icon={Coins} color="var(--green)" />} title="Amounts" value={money ? 'Money' : 'Big Blinds'} to="/settings/units" />
          {money && <Row icon={<IconTile icon={Coins} color="var(--teal)" />} title="Default Stake" value={stakeLabel(settings.stake, settings.currency)} to="/settings/stake" />}
          {money && <Row icon={<IconTile icon={Globe} color="var(--blue)" />} title="Currency" value={settings.currency} to="/settings/currency" />}
          {money && <Row icon={<IconTile icon={Check} color="var(--gray)" />} title="Use Each Hand’s Stakes" right={<Toggle label="Use each hand’s stakes" checked={settings.handStakes} onChange={(handStakes) => settings.set({ handStakes })} />} />}
        </Group>
      </Section>

      <Section title="Feedback" small>
        <Group inset={58}>
          <Row icon={<IconTile icon={Vibrate} color="var(--pink)" />} title="Haptics" right={<Toggle label="Haptics" checked={settings.haptics} onChange={(haptics) => settings.set({ haptics })} />} />
          <Row icon={<IconTile icon={Volume2} color="var(--red)" />} title="Sounds" right={<Toggle label="Sounds" checked={settings.sounds} onChange={(sounds) => settings.set({ sounds })} />} />
        </Group>
      </Section>

      <Section title="Your Hands" small>
        <Group inset={58}>
          <Row icon={<IconTile icon={Laptop} color="var(--blue)" />} title="Sync & Devices" to="/devices" />
          {native ? (
            <Row icon={<IconTile icon={Monitor} color="var(--indigo)" />} title="Full Analysis on the Web" href={WEB_URL} />
          ) : (
            <Row icon={<IconTile icon={Monitor} color="var(--indigo)" />} title="Switch to Web Version" onClick={() => setUiMode('web')} />
          )}
        </Group>
      </Section>

      <Section title="About" small footer={`Leakfinder ${__APP_VERSION__} · Free and open source (AGPL-3.0). GTO solver: postflop-solver by Wataru Inariba.`}>
        <Group inset={58}>
          <Row icon={<IconTile icon={Lock} color="var(--gray)" />} title="Privacy" sub="Your data stays on this device" href="privacy.html" />
          <Row icon={<IconTile icon={BookOpen} color="var(--gray)" />} title="Source Code" href="https://github.com/slamduncaan747/PokerAnalysis" />
        </Group>
      </Section>

      <Group>
        <Row title="Reset Puzzle Progress" danger center onClick={() => setConfirmReset(true)} />
      </Group>

      {confirmReset && (
        <ConfirmSheet
          title="Your rating, history and streaks will be reset. This can’t be undone."
          action="Reset Puzzle Progress"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            haptic.error();
            resetProfile();
            setConfirmReset(false);
          }}
        />
      )}
    </Screen>
  );
}
