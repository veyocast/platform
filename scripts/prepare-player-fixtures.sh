#!/usr/bin/env bash
set -Eeuo pipefail
export PLAYWRIGHT_FIXTURE_ROOT="$RUNNER_TEMP/player-fixtures"
export S238_BACKGROUND_BINARIES="$PLAYWRIGHT_FIXTURE_ROOT/backgrounds"
export S285_ONZETROTS_BINARIES="$PLAYWRIGHT_FIXTURE_ROOT/onzetrots-v1"
export S286_ONZETROTS_BINARIES="$PLAYWRIGHT_FIXTURE_ROOT/onzetrots-v9"
if ! command -v ffmpeg > /dev/null || ! command -v ffprobe > /dev/null; then
  sudo apt-get update
  sudo apt-get install --yes --no-install-recommends ffmpeg
fi
ffmpeg -version
ffprobe -version
export SITES_CAPTURE_TEST_CHROMIUM
SITES_CAPTURE_TEST_CHROMIUM=$(node --input-type=module -e 'import {chromium} from "@playwright/test"; process.stdout.write(chromium.executablePath())')
test -x "$SITES_CAPTURE_TEST_CHROMIUM"
pnpm exec tsx tests/helpers/sync-background-binary.ts
pnpm exec tsx tests/helpers/sync-onzetrots-export.ts "$S285_ONZETROTS_BINARIES" "$SITES_CAPTURE_TEST_CHROMIUM"
pnpm exec tsx tests/helpers/sync-onzetrots-export.ts "$S286_ONZETROTS_BINARIES" "$SITES_CAPTURE_TEST_CHROMIUM" sync-onzetrots-v9
node scripts/player-fixtures.mjs seal
