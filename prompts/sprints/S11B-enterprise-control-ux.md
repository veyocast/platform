# S11-B - Enterprise Control UX

## Goal

Bring VeyoCast Control to the normative enterprise SaaS standard in VeyoCast Bold
Design & Product Canon v1.0.0. This is a corrective product-quality sprint
before S12-A, not a cosmetic pass.

## Required reading

- `AGENTS.md`
- `PLANS.md`
- `TASK_LEDGER.md`
- `docs/technical-canon.md`
- `docs/design-implementation-canon.md`
- `docs/control-enterprise-ux-checklist.md`
- `docs/design-canon/v1/VEYOCAST_DESIGN_CANON_v2.0.md`
- `docs/design-canon/v1/veyocast-design-tokens.json`
- `docs/design-canon/v1/veyocast-component-inventory.csv`
- `docs/design-canon/v1/veyocast-page-template-inventory.csv`

## Scope

- Version the entire approved Design Canon v1.0.0 package, including locked
  official C-icon, tokens, inventories, references and checksums.
- Rebuild the Control shell as a compact operational application: sidebar,
  tenant or platform context, topbar, command search, notifications and
  responsive navigation sheet.
- Rebuild Dashboard, Media, Playlists, Screens, Team, Auditlog, Settings and
  platform tenant views around resource toolbars, tables, inspectors and
  understandable system state.
- Apply token-only colour, typography, spacing, surface, status, responsive and
  accessibility rules from the complete canon.
- Add regression and visual QA evidence for changed layouts.

## Acceptance criteria

- Control reads as calm, information-rich operational SaaS rather than a
  marketing dashboard or sprint demo.
- Current tenant or platform context is always visible.
- Primary resources use toolbars and dense, accessible tables on desktop, with
  priority-based mobile rows below 768 px.
- Media, playlist and screen flows expose readiness, permissions, failure
  recovery and last-known-good release behaviour in plain Dutch.
- The official C-icon is rendered from the approved binary asset.
- No generic gradients, re-created logo marks, raw stack traces or hardcoded
  component-level brand colours are introduced.
- Lint, typecheck, test, build, accessibility, Control e2e and desktop/mobile
  screenshot review are green.

## Stop and report if

- the supplied canonical package fails integrity verification;
- a logo lock-up must be recreated from a screenshot;
- a required server mutation cannot truthfully be represented as read-only or
  permission-gated;
- a change needs a token or asset decision beyond canon v1.0.0;
- visual QA finds clipping, overlap or an unreadable mobile task flow.
