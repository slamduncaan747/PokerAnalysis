import type { CapacitorConfig } from '@capacitor/cli';

// Native iOS shell around the web app (the built site in dist/ is bundled inside the app,
// so analysis and the GTO solver run fully offline on the phone).
const config: CapacitorConfig = {
  appId: 'io.github.slamduncaan747.leakfinder',
  appName: 'Leakfinder',
  webDir: 'dist',
  backgroundColor: '#0a0b0d',
  ios: {
    contentInset: 'never',
    backgroundColor: '#0a0b0d',
    preferredContentMode: 'mobile',
  },
};

export default config;
