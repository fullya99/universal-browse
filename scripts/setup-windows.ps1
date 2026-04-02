Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "[universal-browse] Installing npm dependencies"
npm install

Write-Host "[universal-browse] Installing Playwright Chromium"
npx playwright install chromium

Write-Host "[universal-browse] Running preflight"
npm run preflight
