import { Capacitor } from '@capacitor/core';
import { Check, Flame } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { haptic } from '../feedback.ts';
import { liveStreak, ratingSeries } from '../puzzles/engine.ts';
import { tierOf } from '../puzzles/ranks.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { CURRENCIES, STAKES, stakeLabel, useSettings, type Currency } from '../settings.ts';
import { THEME_META, THEME_ORDER, ThemeChip } from './meta.tsx';
import { setUiMode, WEB_URL } from './mode.ts';
import { Bar, Btn, List, PushScreen, RatingChart, Row, Section, TabScreen, TierChip, Toggle } from './ui.tsx';

const CURRENCY_NAME: Record<Currency, string> = { $: 'US dollar  $', '€': 'Euro  €', '£': 'Pound  £', '₮': 'Tether  ₮ (USDT)' };

/** Settings detail screen: pick one, with a check. */
export function SettingsSelect() {
  const { key } = useParams();
  const s = useSettings();
  const pick = (patch: Parameters<typeof s.set>[0]) => {
    haptic.tap();
    s.set(patch);
  };
  const tick = (on: boolean) => (on ? <Check size={20} strokeWidth={3} className="c-go shrink-0" /> : null);
  if (key === 'units')
    return (
      <PushScreen title="Show amounts in">
        <Section note="Money uses your default stake. Your own hands can use their real stakes instead.">
          <List>
            <Row title="Big blinds" sub="A bet shows as 12.5bb" right={tick(s.units === 'bb')} onClick={() => pick({ units: 'bb' })} chevron={false} />
            <Row title="Money" sub={`A bet shows as ${s.currency}${(12.5 * s.stake.bb).toFixed(2)} at ${stakeLabel(s.stake, s.currency)}`} right={tick(s.units === 'money')} onClick={() => pick({ units: 'money' })} chevron={false} />
          </List>
        </Section>
      </PushScreen>
    );
  if (key === 'stake')
    return (
      <PushScreen title="Default stake">
        <List>
          {STAKES.map((st) => (
            <Row key={st.bb} title={stakeLabel(st, s.currency)} right={tick(st.bb === s.stake.bb)} onClick={() => pick({ stake: st })} chevron={false} />
          ))}
        </List>
      </PushScreen>
    );
  return (
    <PushScreen title="Currency">
      <List>
        {CURRENCIES.map((c) => (
          <Row key={c} title={CURRENCY_NAME[c]} right={tick(c === s.currency)} onClick={() => pick({ currency: c })} chevron={false} />
        ))}
      </List>
    </PushScreen>
  );
}

function ConfirmSheet({ title, action, onConfirm, onCancel }: { title: string; action: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="m-fade fixed inset-0 z-50 flex items-end bg-black/60" onClick={onCancel}>
      <div className="m-up m-safe-bottom mx-auto w-full max-w-[600px] rounded-t-[26px] px-5 pt-6 pb-4" style={{ background: 'var(--s1)' }} onClick={(e) => e.stopPropagation()}>
        <div className="f-head text-center">{action}?</div>
        <p className="f-ui t2 mt-2 text-center font-normal">{title}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Btn tone="bad" onClick={onConfirm}>
            {action}
          </Btn>
          <Btn tone="ghost" onClick={onCancel}>
            Cancel
          </Btn>
        </div>
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
  const { tier, next, progress, toNext } = tierOf(profile.rating);
  const themes = THEME_ORDER.map((t) => ({ t, ...(profile.themes[t] ?? { n: 0, ok: 0 }) })).filter((x) => x.n > 0);
  const native = Capacitor.isNativePlatform();
  const streak = liveStreak(profile);
  const money = settings.units === 'money';
  return (
    <TabScreen title="Profile">
      <div className="m-tile m-in flex flex-col items-center px-5 pt-6 pb-5 text-center">
        <TierChip rating={profile.rating} size={92} />
        <div className="f-title mt-3 font-extrabold">{tier.name}</div>
        <div className="f-hero f-num mt-1">{profile.rating.toLocaleString()}</div>
        {next && (
          <div className="mt-4 w-full">
            <Bar value={progress} color="var(--gold)" h={12} />
            <div className="f-small t2 mt-2">
              <span className="f-num font-bold" style={{ color: 'var(--text)' }}>{toNext}</span> points to {next.name}
            </div>
          </div>
        )}
        <div className="f-ui t2 mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span>{acc}% solved</span>
          <span className="inline-flex items-center gap-1" style={{ color: streak ? 'var(--gold)' : undefined }}>
            <Flame size={15} fill={streak ? 'currentColor' : 'none'} /> {streak}-day streak
          </span>
          <span>Best {profile.peak.toLocaleString()}</span>
        </div>
        {profile.games >= 10 && (
          <div className="mt-5 w-full">
            <RatingChart data={series.slice(-120)} h={96} />
          </div>
        )}
      </div>

      {themes.length > 0 && (
        <Section title="By theme">
          <div className="m-tile-flat flex flex-col gap-4 p-4">
            {themes.map(({ t, n, ok }) => (
              <div key={t} className="flex items-center gap-3">
                <ThemeChip theme={t} size={34} />
                <div className="flex-1">
                  <div className="mb-1.5 flex justify-between">
                    <span className="f-ui font-semibold">{THEME_META[t].name}</span>
                    <span className="f-ui f-num t2">
                      {Math.round((ok / n) * 100)}% <span className="t3">· {n}</span>
                    </span>
                  </div>
                  <Bar value={ok / n} h={8} color={ok / n >= 0.7 ? 'var(--go)' : ok / n >= 0.5 ? 'var(--gold)' : 'var(--bad)'} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Settings" note={money ? `A 15bb bet shows as ${settings.currency}${(15 * settings.stake.bb).toFixed(2)}.` : undefined}>
        <List>
          <Row title="Show amounts in" value={money ? 'Money' : 'Big blinds'} to="/settings/units" />
          {money && <Row title="Default stake" value={stakeLabel(settings.stake, settings.currency)} to="/settings/stake" />}
          {money && <Row title="Currency" value={settings.currency} to="/settings/currency" />}
          {money && <Row title="Use each hand’s real stakes" right={<Toggle label="Use each hand’s real stakes" checked={settings.handStakes} onChange={(handStakes) => settings.set({ handStakes })} />} />}
          <Row title="Haptics" right={<Toggle label="Haptics" checked={settings.haptics} onChange={(haptics) => settings.set({ haptics })} />} />
          <Row title="Sounds" right={<Toggle label="Sounds" checked={settings.sounds} onChange={(sounds) => settings.set({ sounds })} />} />
        </List>
      </Section>

      <Section title="Your hands">
        <List>
          <Row title="Sync & devices" sub="Pair with your computer, backups" to="/devices" />
          {native ? <Row title="Full analysis on the web" sub="Import, stats, replayer, GTO solver" href={WEB_URL} /> : <Row title="Switch to the web version" sub="Import, stats, replayer, GTO solver" onClick={() => setUiMode('web')} />}
        </List>
      </Section>

      <Section title="About" note={`Leakfinder ${__APP_VERSION__} · free and open source (AGPL-3.0) · GTO solver by Wataru Inariba`}>
        <List>
          <Row title="Privacy" sub="Everything stays on this device" href="privacy.html" />
          <Row title="Source code" href="https://github.com/slamduncaan747/PokerAnalysis" />
          <Row title="Reset puzzle progress" danger onClick={() => setConfirmReset(true)} chevron={false} />
        </List>
      </Section>

      {confirmReset && (
        <ConfirmSheet
          title="Your rating, history and streaks go back to the start. This can’t be undone."
          action="Reset progress"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            haptic.error();
            resetProfile();
            setConfirmReset(false);
          }}
        />
      )}
    </TabScreen>
  );
}
