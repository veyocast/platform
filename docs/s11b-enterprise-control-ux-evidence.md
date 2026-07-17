# S11-B Enterprise Control UX Evidence

Status: review

## Canon integrity

- All 16 files listed in `docs/design-canon/v1/SHA256SUMS.txt` were verified
  against their published SHA-256 values.
- `apps/control/public/brand/castivo-official-icon.png` matches the locked
  canonical asset byte-for-byte.
- `packages/tokens/test/canonical-parity.test.ts` verifies the semantic token
  families and dimensions shared by the W3C canon and the runtime projection.

## Product review

- The Control shell now exposes persistent tenant or platform context, a
  command search, action-oriented notifications, desktop collapse and a mobile
  navigation sheet.
- Dashboard, Media, Playlists, Screens, Team, Auditlog, Settings, Platform and
  Tenants use the operational resource patterns defined in Canon v1.0.0.
- Headless Playwright screenshots were reviewed at 1280px desktop for
  `/dashboard` and 390px mobile for `/dashboard/screens`. They confirm readable
  data tables, no overlap and the expected priority-based mobile resource rows.
- The Codex in-app browser was deliberately not opened after the reported crash;
  visual evidence was captured headlessly instead.

## Gates

| Gate | Result |
| --- | --- |
| `pnpm lint` | passed, 11 Turbo tasks |
| `pnpm typecheck` | passed, 11 Turbo tasks |
| `pnpm test` | passed, 11 Turbo tasks |
| `pnpm build` | passed; Control, Marketing and Player production artifacts generated |
| `pnpm test:a11y -- --project=chromium --workers=1` | passed, 7 tests |
| `pnpm test:e2e -- --project=chromium --workers=1 tests/e2e/control-shell.spec.ts` | passed, 3 tests |

## Review artefacts

Headless screenshots are intentionally kept outside the repository:

- `D:\Codex\castivo\artifacts\s11b-enterprise-control-ux\control-dashboard-desktop.png`
- `D:\Codex\castivo\artifacts\s11b-enterprise-control-ux\control-screens-mobile.png`
