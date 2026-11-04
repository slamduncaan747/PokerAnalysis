import '@fontsource-variable/rubik';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { HashRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { getCloudConfig } from '../cloud/config.ts';
import { useCloud } from '../cloud/state.ts';
import { haptic } from '../feedback.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { useStore } from '../store.ts';
import { Chip, TierChip } from './ui.tsx';
import Today from './Today.tsx';

const PuzzlesTab = lazy(() => import('./PuzzlesTab.tsx'));
const MyGame = lazy(() => import('./MyGame.tsx'));
const Profile = lazy(() => import('./Profile.tsx'));
const SettingsSelect = lazy(() => import('./Profile.tsx').then((m) => ({ default: m.SettingsSelect })));
const Devices = lazy(() => import('./Devices.tsx'));
const MobileHand = lazy(() => import('./MobileHand.tsx'));
const RatedRun = lazy(() => import('./runs.tsx').then((m) => ({ default: m.RatedRun })));
const DailyRun = lazy(() => import('./runs.tsx').then((m) => ({ default: m.DailyRun })));
const PracticeRun = lazy(() => import('./runs.tsx').then((m) => ({ default: m.PracticeRun })));
const PuzzleReview = lazy(() => import('./runs.tsx').then((m) => ({ default: m.PuzzleReview })));

/* Tab icons are poker objects, in colour when selected: a card back, a chip, two cards, your rank chip. */
function CardBackIcon({ on }: { on: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26">
      <rect x="6" y="2" width="14" height="22" rx="3" fill={on ? '#c8343c' : '#2a3150'} stroke={on ? '#fff' : '#5d6580'} strokeWidth="2" />
      <path d="M13 7l3.5 6-3.5 6-3.5-6z" fill={on ? 'rgba(255,255,255,.55)' : '#5d6580'} />
    </svg>
  );
}
function TwoCardsIcon({ on }: { on: boolean }) {
  return (
    <svg width="28" height="26" viewBox="0 0 28 26">
      <rect x="3" y="4" width="13" height="18" rx="2.5" transform="rotate(-10 9.5 13)" fill={on ? '#ffffff' : '#2a3150'} stroke={on ? '#0b0e17' : '#5d6580'} strokeWidth="1.5" />
      <rect x="11" y="3" width="13" height="18" rx="2.5" transform="rotate(8 17.5 12)" fill={on ? '#ffffff' : '#2a3150'} stroke={on ? '#0b0e17' : '#5d6580'} strokeWidth="1.5" />
      <text x="18" y="16" textAnchor="middle" fontSize="9" fontWeight="800" fill={on ? '#e5323b' : '#5d6580'}>♥</text>
    </svg>
  );
}

function TabIcon({ tab, on }: { tab: string; on: boolean }) {
  const rating = usePuzzles((s) => s.profile.rating);
  if (tab === '/') return <CardBackIcon on={on} />;
  if (tab === '/game') return <TwoCardsIcon on={on} />;
  const dim = on ? undefined : { filter: 'grayscale(1) brightness(.55)' };
  if (tab === '/puzzles')
    return (
      <span style={dim}>
        <Chip color="green" size={26} lip={false}>
          <span style={{ fontSize: 11 }}>♠</span>
        </Chip>
      </span>
    );
  return (
    <span style={dim}>
      <TierChip rating={rating} size={26} />
    </span>
  );
}

const TABS = [
  { to: '/', label: 'Today', end: true },
  { to: '/puzzles', label: 'Puzzles' },
  { to: '/game', label: 'My Game' },
  { to: '/profile', label: 'Profile' },
];

function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20" style={{ background: 'var(--bg)', boxShadow: 'inset 0 1px 0 var(--line)' }}>
      <div className="mx-auto flex max-w-[600px] px-2">
        {TABS.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} replace onClick={() => haptic.tap()} className="flex flex-1 flex-col items-center gap-1 pt-2.5 pb-1.5">
            {({ isActive }) => (
              <>
                <span className="grid h-7 place-items-center transition-transform duration-200" style={{ transform: isActive ? 'scale(1.08)' : 'none' }}>
                  <TabIcon tab={to} on={isActive} />
                </span>
                <span className="text-[11px] leading-none font-semibold" style={{ color: isActive ? 'var(--text)' : 'var(--text-3)' }}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
      <div className="m-safe-bottom" />
    </nav>
  );
}

function Tabs() {
  const loc = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <div ref={ref} className="min-h-[100dvh]" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="mx-auto max-w-[600px]">
        <Suspense fallback={<div className="h-[60vh]" />}>
          <Outlet />
        </Suspense>
      </div>
      <TabBar />
    </div>
  );
}

const Blank = () => <div className="m-app fixed inset-0" />;

/** The phone app: puzzles first, your own hands second. Fully usable without ever importing a hand. */
export default function MobileApp() {
  const init = useStore((s) => s.init);
  const ensureBank = usePuzzles((s) => s.ensureBank);
  useEffect(() => {
    document.documentElement.classList.add('mobile-ui');
    void init().then(() => {
      if (getCloudConfig()) import('../cloud/cloud.ts').then((m) => m.initCloud());
      else useCloud.setState({ configured: false, ready: true });
    });
    // Warm the puzzle bank so the first puzzle opens instantly.
    const t = setTimeout(() => void ensureBank(), 400);
    return () => clearTimeout(t);
  }, [init, ensureBank]);
  return (
    <div className="m-app">
      <HashRouter>
        <Routes>
          <Route element={<Tabs />}>
            <Route path="/" element={<Today />} />
            <Route path="/puzzles" element={<PuzzlesTab />} />
            <Route path="/game" element={<MyGame />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/hand/:id" element={<MobileHand />} />
            <Route path="/settings/:key" element={<SettingsSelect />} />
          </Route>
          <Route
            path="/play"
            element={
              <Suspense fallback={<Blank />}>
                <RatedRun />
              </Suspense>
            }
          />
          <Route
            path="/daily"
            element={
              <Suspense fallback={<Blank />}>
                <DailyRun />
              </Suspense>
            }
          />
          <Route
            path="/practice"
            element={
              <Suspense fallback={<Blank />}>
                <PracticeRun />
              </Suspense>
            }
          />
          <Route
            path="/review/:id"
            element={
              <Suspense fallback={<Blank />}>
                <PuzzleReview />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </div>
  );
}
