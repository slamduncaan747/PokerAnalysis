#!/usr/bin/env bash
# Pulls the latest app and puts it in the Xcode project: `npm run phone`.
# Wrapped in main() so bash reads the whole script before `git pull` can replace it.
set -euo pipefail
main() {
  cd "$(dirname "$0")/.."
  local branch=claude/confident-volta-9ayi4l
  if [ -n "$(git status --porcelain)" ]; then
    git stash push -u -m "update-phone $(date +%Y-%m-%d_%H%M)" >/dev/null
    echo "• Set aside local changes (they're in 'git stash list' if you ever need them)"
  fi
  git checkout -q "$branch"
  git pull -q --ff-only origin "$branch"
  echo "• Code: $(git log --oneline -1)"
  npm install --no-audit --no-fund --loglevel=error
  npm run -s ios:sync
  test -f ios/App/App/public/puzzles/bank.json || { echo "✗ The iOS project didn't get the new build"; exit 1; }
  echo "• iOS project updated"
  npx cap open ios
  echo "• In Xcode: Product → Clean Build Folder (⇧⌘K), then Run (⌘R)"
}
main "$@"
