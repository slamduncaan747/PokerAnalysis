import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/inter';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { HashRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { getCloudConfig } from '../cloud/config.ts';
import { useCloud } from '../cloud/state.ts';
import { haptic } from '../feedback.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { useStore } from '../store.ts';
import { ChartNoAxesColumn, CircleUser, Puzzle, Spade, type LucideIcon } from 'lucide-react';
import Today from './Today.tsx';
import Welcome, { needsWelcome } from './Welcome.tsx';

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

const TABS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Today', icon: Spade, end: true },
  { to: '/puzzles', label: 'Puzzles', icon: Puzzle },
  { to: '/game', label: 'My Game', icon: ChartNoAxesColumn },
  { to: '/profile', label: 'Profile', icon: CircleUser },
];

function TabBar() {
  const { pathname } = useLocation();
  // Pushed screens keep their parent tab lit.
  const parent = /^\/(devices|settings)/.test(pathname) ? '/profile' : pathname.startsWith('/hand/') ? '/game' : null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20" aria-label="Tabs" style={{ background: 'rgba(10,11,13,.86)', backdropFilter: 'blur(22px) saturate(1.6)', WebkitBackdropFilter: 'blur(22px) saturate(1.6)', boxShadow: 'inset 0 1px 0 var(--line)' }}>
      <div className="mx-auto flex max-w-[600px] px-2">
        {TABS.map(({ to, label, end, icon: Icon }) => (
          <NavLink key={to} to={to} end={end} replace onClick={() => haptic.tap()} className="flex flex-1 flex-col items-center gap-[5px] pt-2.5 pb-1.5" style={({ isActive }) => ({ color: isActive || parent === to ? 'var(--text)' : 'var(--text-3)' })}>
            {({ isActive: on }) => { const isActive = on || parent === to; return (
              <>
                <Icon size={25} strokeWidth={isActive ? 2.5 : 2.1} fill={isActive && to === '/' ? 'currentColor' : 'none'} />
                <span className="text-[11px] leading-none font-semibold">{label}</span>
              </>
            ); }}
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
    <div ref={ref} className="min-h-[100dvh]" style={{ paddingBottom: 'calc(70px + var(--sab))' }}>
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
  const [welcome, setWelcome] = useState(() => needsWelcome(usePuzzles.getState().profile.games));
  return (
    <div className="m-app">
      <HashRouter>
        {welcome && <Welcome onDone={() => setWelcome(false)} />}
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
