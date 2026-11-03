import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { uiMode } from './mobile/mode.ts';
import './index.css';

if (Capacitor.isNativePlatform()) {
  // iOS app: light status-bar text over the dark UI.
  document.documentElement.classList.add('native');
  import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: Style.Dark }))
    .catch(() => {});
}

// Two different apps share the engine: a consumer puzzle/training app for phones and the full
// analytics site for computers. Each is its own chunk, so neither downloads the other.
const mode = uiMode();
const Root = mode === 'mobile' ? lazy(() => import('./mobile/MobileApp.tsx')) : lazy(() => import('./App.tsx'));
if (mode === 'mobile') {
  document.documentElement.style.background = '#08090c';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#08090c');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
);
