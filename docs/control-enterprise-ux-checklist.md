# Control Enterprise UX Checklist

This checklist applies the normative Control sections of
`docs/design-canon/v1/VEYOCAST_DESIGN_CANON_v2.0.md` to implementation and PR
review. It does not replace the full design canon.

## Shell and context

- [ ] Use the official C-icon asset without alteration where compact branding is needed.
- [ ] Keep tenant or platform context visible in the shell and page hierarchy.
- [ ] Use the 248 px expanded sidebar, 64 px topbar and token-based gutters on desktop.
- [ ] Provide a keyboard-accessible mobile navigation sheet below 1024 px.
- [ ] Provide global search and action-oriented notifications without fabricating activity.
- [ ] Keep one unambiguous primary action per resource page.

## Resource workflows

- [ ] Start resource pages with breadcrumb, H1, concise status and clear actions.
- [ ] Use toolbars for search, filters, sort or view controls when the data supports them.
- [ ] Use tables for fleet, media, playlist, team, audit and tenant data.
- [ ] Show name, status, latest relevant state and named action in each primary row.
- [ ] Put selected-item detail in an inspector or a separate detail view.
- [ ] Explain publish targets, version, progress and last-known-good behaviour.
- [ ] Keep technical identifiers secondary and never expose secrets or raw stack traces.

## Visual system

- [ ] Use semantic CSS tokens; do not add component-level brand hex values.
- [ ] Keep Control 70-90% neutral surfaces; Orange is primary action or explicit attention only.
- [ ] Use Blue for focus, selection and system information; semantic colours describe state.
- [ ] Use 8 px maximum card radius and no generic gradients, glass or decorative orb effects.
- [ ] Prefer data density and clear scanning boundaries over decorative metric grids.
- [ ] Use the dashboard type scale: 32/40 H1, 20/28 H2, 16/24 H3, 14/20 body.

## Responsive and accessibility

- [ ] Transform changed data tables into priority-based card rows below 768 px.
- [ ] Keep touch targets at least 44 px on mobile.
- [ ] Provide a visible focus state, skip link, landmarks and keyboard flow.
- [ ] Do not rely on colour alone for status or validation.
- [ ] Verify reflow at 320 px and desktop at 1280 px or wider.
- [ ] Respect `prefers-reduced-motion`.

## Evidence

- [ ] Capture desktop and mobile screenshots of each changed primary route.
- [ ] Run lint, typecheck, unit tests, build, a11y and Control e2e tests.
- [ ] Record any incomplete server integration as a visible permission or read-only state.
