import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import Dashboard from './pages/Dashboard.tsx';
import { getCloudConfig } from './cloud/config.ts';
import { useCloud } from './cloud/state.ts';
import { useStore } from './store.ts';

const Import = lazy(() => import('./pages/Import.tsx'));
const Hands = lazy(() => import('./pages/Hands.tsx'));
const HandReview = lazy(() => import('./pages/HandReview.tsx'));
const Leaks = lazy(() => import('./pages/Leaks.tsx'));
const Train = lazy(() => import('./pages/Train.tsx'));
const TrainSession = lazy(() => import('./pages/TrainSession.tsx'));
const SolverPage = lazy(() => import('./pages/SolverPage.tsx'));
const Account = lazy(() => import('./pages/Account.tsx'));

const Loading = () => <div className="text-sm text-mute">Loading…</div>;

export default function App() {
  const init = useStore((s) => s.init);
  useEffect(() => {
    init().then(() => {
      // Load the Supabase client only when cloud sync is configured.
      if (getCloudConfig()) import('./cloud/cloud.ts').then((m) => m.initCloud());
      else useCloud.setState({ configured: false, ready: true });
    });
  }, [init]);
  return (
    <HashRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/import" element={<Import />} />
            <Route path="/hands" element={<Hands />} />
            <Route path="/hand/:id" element={<HandReview />} />
            <Route path="/leaks" element={<Leaks />} />
            <Route path="/train" element={<Train />} />
            <Route path="/train/session" element={<TrainSession />} />
            <Route path="/solver" element={<SolverPage />} />
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
