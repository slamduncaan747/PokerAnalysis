import { Capacitor } from '@capacitor/core';
import { useSettings } from './settings.ts';

/**
 * Haptics and sounds. On iOS the Taptic Engine is driven by @capacitor/haptics; in browsers we fall
 * back to navigator.vibrate (Android) and quietly do nothing elsewhere. Sounds are synthesized with
 * Web Audio so there are no audio files to ship.
 */
type HapticsMod = typeof import('@capacitor/haptics');
let mod: Promise<HapticsMod | null> | null = null;
const native = () => Capacitor.isNativePlatform();
function haptics(): Promise<HapticsMod | null> {
  mod ??= native() ? import('@capacitor/haptics').catch(() => null) : Promise.resolve(null);
  return mod;
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

const on = () => useSettings.getState().haptics;

export const haptic = {
  /** Light tick for taps and selections. */
  tap() {
    if (!on()) return;
    if (native()) void haptics().then((h) => h?.Haptics.selectionChanged().catch(() => {}));
    else vibrate(8);
  },
  /** Medium thump for a confirmed choice. */
  press() {
    if (!on()) return;
    if (native()) void haptics().then((h) => h?.Haptics.impact({ style: h.ImpactStyle.Medium }).catch(() => {}));
    else vibrate(14);
  },
  success() {
    if (!on()) return;
    if (native()) void haptics().then((h) => h?.Haptics.notification({ type: h.NotificationType.Success }).catch(() => {}));
    else vibrate([12, 60, 18]);
  },
  error() {
    if (!on()) return;
    if (native()) void haptics().then((h) => h?.Haptics.notification({ type: h.NotificationType.Error }).catch(() => {}));
    else vibrate([30, 50, 30]);
  },
  /** Big moment: streak, new best rating. */
  celebrate() {
    if (!on()) return;
    if (native())
      void haptics().then(async (h) => {
        if (!h) return;
        for (const style of [h.ImpactStyle.Light, h.ImpactStyle.Medium, h.ImpactStyle.Heavy]) {
          await h.Haptics.impact({ style }).catch(() => {});
          await new Promise((r) => setTimeout(r, 70));
        }
      });
    else vibrate([10, 40, 14, 40, 24]);
  },
};

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = a.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const soundOn = () => useSettings.getState().sounds;

export const sound = {
  correct() {
    if (!soundOn()) return;
    tone(660, 0, 0.16, 'sine', 0.18);
    tone(990, 0.08, 0.24, 'sine', 0.16);
  },
  wrong() {
    if (!soundOn()) return;
    tone(220, 0, 0.22, 'triangle', 0.16);
    tone(165, 0.1, 0.26, 'triangle', 0.14);
  },
  deal() {
    if (!soundOn()) return;
    tone(1800, 0, 0.04, 'square', 0.025);
  },
  fanfare() {
    if (!soundOn()) return;
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.28, 'sine', 0.14));
  },
};
