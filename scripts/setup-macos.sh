#!/usr/bin/env bash
set -euo pipefail

echo "[universal-browse] Installing npm dependencies"
npm install

echo "[universal-browse] Installing Playwright Chromium"
npx playwright install chromium

echo "[universal-browse] Running preflight"
npm run preflight
