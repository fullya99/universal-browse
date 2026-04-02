#!/usr/bin/env bash
set -euo pipefail

echo "[universal-browse] Installing npm dependencies"
npm install

echo "[universal-browse] Installing Playwright Chromium + Linux deps"
npx playwright install --with-deps chromium

echo "[universal-browse] Optional: install Xvfb for headed VPS runs"
if command -v apt-get >/dev/null 2>&1; then
  echo "  sudo apt-get update && sudo apt-get install -y xvfb"
fi

echo "[universal-browse] Running preflight"
npm run preflight
