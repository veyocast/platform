# S11-B Enterprise Control UX Evidence

Status: review

## Canon integrity

- All files listed in `docs/design-canon/v1/SHA256SUMS.txt` were verified
  against their published SHA-256 values.
- The current VeyoCast icon is an explicitly temporary development placeholder;
  an approved master remains a public-release requirement.
- `packages/tokens/test/canonical-parity.test.ts` verifies the semantic token
  families and dimensions shared by the W3C canon and the runtime projection.

## Product review

- The Control shell now exposes persistent tenant or platform context, a
  command search, action-oriented notifications, desktop collapse and a mobile
  navigation sheet.
- Dashboard, Media, Playlists, Screens, Team, Auditlog, Settings, Platform and
  Tenants use the operational resource patterns defined in the design canon.
- Headless Playwright screenshots were reviewed at 1280px desktop for
  `/dashboard` and 390px mobile for `/dashboard/screens`. They confirm readable
  data tables, no overlap and the expected priority-based mobile resource rows.
- A follow-up responsive pass keeps the Control topbar to one 64px row at 390px
  and 320px: context remains on the left, while search, action points and the
  create action remain visible as right-aligned icon controls. Mobile table
  actions now use full-width 44px touch targets.
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
| `PLAYWRIGHT_CONTROL_ONLY=1 pnpm exec playwright test tests/a11y/control-shell.spec.ts --project=chromium --workers=1` | passed, 5 Control tests |

## Review artefacts

Headless screenshots are intentionally kept outside the repository:

- `D:\Codex\veyocast\artifacts\s11b-enterprise-control-ux\control-dashboard-desktop.png`
- `D:\Codex\veyocast\artifacts\s11b-enterprise-control-ux\control-screens-mobile.png`
- `D:\Codex\veyocast\artifacts\s11b-enterprise-control-ux\control-screens-mobile-refined-390.png`
- `D:\Codex\veyocast\artifacts\s11b-enterprise-control-ux\control-screens-mobile-refined-320.png`
