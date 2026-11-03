# Shipping Leakfinder to your iPhone and the App Store

Everything in the repo is ready; these are the steps that need your Mac and Apple developer account.
Bundle ID: `io.github.slamduncaan747.leakfinder` (change it in Xcode if you prefer, before the first upload).

## 1. Run it on your iPhone (≈5 minutes)

Requirements: macOS with Xcode 16 or newer, Node 22, your iPhone with Developer Mode on
(Settings → Privacy & Security → Developer Mode).

```bash
git clone https://github.com/slamduncaan747/PokerAnalysis.git
```

```bash
cd PokerAnalysis && git checkout claude/confident-volta-9ayi4l
```

```bash
npm install
```

```bash
npm run ios:sync
```

```bash
npm run ios:open
```

In Xcode:

1. Select the **App** project → **App** target → **Signing & Capabilities**.
2. Tick **Automatically manage signing** and pick your **Team**.
3. Plug in the iPhone (or pick it over Wi-Fi), choose it as the run destination, press **Run** (⌘R).

Re-run `npm run ios:sync` whenever the web code changes, then Run again.

## 2. Create the app in App Store Connect (one time)

1. [App Store Connect](https://appstoreconnect.apple.com) → Apps → **+** → New App.
2. Platform iOS · Name **Leakfinder: Poker Hand Review** · Language English (U.S.) ·
   Bundle ID **io.github.slamduncaan747.leakfinder** (Xcode registers it the first time you
   archive with automatic signing; if it's not in the list yet, do step 3 first and come back) · SKU `leakfinder-ios`.

## 3. Upload a build to TestFlight

Pick one of these:

**A. From Xcode (simplest)**
1. Destination: **Any iOS Device (arm64)**.
2. Product → **Archive**.
3. In the Organizer: **Distribute App** → **App Store Connect** → **Upload**.

**B. One command on your Mac**

```bash
APPLE_TEAM_ID=YOURTEAMID ./scripts/ios-testflight.sh 1.0.0
```

It uses the Apple ID signed into Xcode. Add `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_PATH`
to use an App Store Connect API key instead.

**C. From GitHub Actions (no Mac needed after setup)**
1. App Store Connect → Users and Access → Integrations → **App Store Connect API** → generate a key with
   the **Admin** role (needed for cloud signing). Download the `.p8` once.
2. GitHub repo → Settings → Secrets and variables → Actions → add secrets
   `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (paste the whole .p8 file).
3. Actions → **iOS → TestFlight** → Run workflow → enter the version (e.g. `1.0.0`).
   The build number is the workflow run number, so every run is a new build.

After Apple processes the build (5–15 minutes) it appears under **TestFlight**. Add yourself as an
internal tester and install it with the TestFlight app.

## 4. Submit to the App Store

Everything to paste is in [`appstore/metadata.md`](appstore/metadata.md):

- Name, subtitle, promotional text, description, keywords, categories, URLs.
- App Review notes (no login needed; use the demo hands).
- App Privacy answers ("Data Not Collected" for this version).
- Age rating guidance.
- Screenshots in [`appstore/screenshots/`](appstore/screenshots) for the 6.9" iPhone and 13" iPad sizes.

Then pick the TestFlight build on the version page → **Add for Review** → **Submit**.

## Regenerating screenshots

With the app built and served (`npm run build && npx vite preview --port 4173`), the Playwright
script used to make them loads the demo hands and captures each screen at 1320×2868 and 2064×2752.
Retake them whenever the UI changes noticeably.

## Cloud accounts later

The app ships with device-pairing sync and backup files, which need no server. When you're ready
for background sync with accounts, create the Supabase project, apply
`supabase/migrations/20261103000000_leakfinder_sync.sql`, and put the URL + publishable key in
`.env.production` (see README → Accounts & sync). Update the App Privacy answers as described in
`appstore/metadata.md`.
