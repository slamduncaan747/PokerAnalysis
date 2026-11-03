#!/usr/bin/env bash
# Archive + upload to TestFlight from your Mac in one command (same steps as the CI workflow).
# Usage: APPLE_TEAM_ID=ABCDE12345 ASC_KEY_ID=XXXX ASC_ISSUER_ID=xxxx-... ASC_KEY_PATH=~/AuthKey_XXXX.p8 \
#        ./scripts/ios-testflight.sh 1.0.0 [build-number]
# Without the ASC_* variables it uses the Apple ID signed into Xcode (Xcode → Settings → Accounts).
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="${1:-1.0.0}"
BUILD="${2:-$(date +%Y%m%d%H%M)}"
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID to your 10-character Team ID}"
AUTH=()
if [[ -n "${ASC_KEY_ID:-}" ]]; then
  AUTH=(-authenticationKeyPath "${ASC_KEY_PATH:?}" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "${ASC_ISSUER_ID:?}")
fi
npm run ios:sync
OUT="$(mktemp -d)"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$OUT/App.xcarchive" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic \
  MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD" \
  -allowProvisioningUpdates "${AUTH[@]}" archive
sed "s/__TEAM_ID__/$APPLE_TEAM_ID/" ios/ExportOptions.plist > "$OUT/ExportOptions.plist"
xcodebuild -exportArchive -archivePath "$OUT/App.xcarchive" -exportOptionsPlist "$OUT/ExportOptions.plist" \
  -exportPath "$OUT/export" -allowProvisioningUpdates "${AUTH[@]}"
echo "Uploaded Leakfinder $VERSION ($BUILD). Check App Store Connect → TestFlight in a few minutes."
