# S23 Control UX-fundering — evidence

Status: implementation review

## Delivered contract

- Control navigation is capability-filtered and divided into `Overzicht`,
  `Content`, `Distributie` and `Organisatie`.
- Platform and association scope have their own labelled navigation context.
  The topbar names the active scope and context; the tenant switcher remains
  keyboard reachable.
- Pilotflow is absent from production navigation. Its diagnostic route remains
  directly available while later feature sprints replace the old pilot path.
- The shell contains no fabricated live notification counter and no global
  create button. Search-like navigation is truthfully named `Snel naar`; real
  cross-resource search and an action inbox remain S28 scope.
- `@veyocast/ui` owns `PageHeader`, `Toolbar`, `DataTable`, `Inspector`,
  `StatusPill` and explicit resource states. Auditlog is the first Control route
  using the shared table, mobile rows, empty and recoverable error patterns.
- Shell-level loading and runtime errors use the same resource-state contract.
  Errors expose consequence and recovery without showing a stack trace.
- Component CSS contains no hardcoded hex colours; all new visual decisions use
  semantic VeyoCast tokens.

## Role journey review

This is deterministic capability and flow validation, not claimed external user
research. Navigation unit tests construct each role separately; Playwright
validates the rendered platform-plus-tenant demo session.

| Role | Critical destination | Before S23 | After S23 | Steps | Prevented ambiguity / recovery question |
| --- | --- | --- | --- | ---: | --- |
| Platform admin | Tenant management | Link under generic Platform group | `Platformcontext` → `Organisatie` → `Tenants` | 1 navigation activation | Tenant and platform routes no longer appear as one undifferentiated list. |
| Tenant admin | Screen distribution | Link under generic Tenant group | `Verenigingscontext` → `Distributie` → `Schermen` | 1 navigation activation | Active association stays visible; no question whether a screen action is platform-wide. |
| Tenant editor | Media and playlists | Links under generic Tenant group | `Verenigingscontext` → `Content` → resource | 1 navigation activation | Capability filtering keeps platform controls out and removes the obsolete Pilotflow choice. |

Automated role runs expect zero out-of-scope navigation groups and zero
Pilotflow links. Human moderated usability sessions remain appropriate after
S24-S27 expose the complete critical workflows; S23 does not fabricate error or
recovery-question counts from users who were not recruited.

## Responsive and keyboard evidence

The automated matrix covers 320, 390, 768 and 1280 CSS pixels. It verifies:

- no page-level horizontal overflow;
- 44 × 44 px minimum mobile shell controls;
- the mobile navigation sheet exposes scope and section labels;
- the desktop rail remains keyboard collapsible and restorable;
- skip link, main landmark, navigation landmark and explicit active context;
- Auditlog table cells become labelled mobile rows at 320 px.

Headless screenshots are generated during review at:

- `/dashboard` — 1280 × 900 desktop;
- `/dashboard` — 768 × 1024 tablet;
- `/dashboard` — 390 × 844 mobile;
- `/dashboard/auditlog` — 320 × 844 mobile resource rows.

The review files are stored outside the repository in
`/home/codex/.codex/visualizations/2026/07/18/019f7474-b697-7183-a3b7-ac62b9bab678/s23-control-ux/`.

Screenshots are review artefacts and are not product assets or visual-regression
baselines. The assertions in `tests/a11y/control-shell.spec.ts` are the
reproducible evidence.

## Verification

Results are recorded after the complete branch gates have run.

| Gate | Result |
| --- | --- |
| UI lint, typecheck and component tests | passed; 8 component tests |
| Storybook production build | passed; resource contract story generated |
| Control lint, typecheck and unit tests | passed; 41 unit tests |
| Repository lint, typecheck, test and build | passed; 12 workspace projects |
| Accessibility, keyboard and responsive suite | passed; 17 Playwright tests |
| Full end-to-end suite | passed; 45 tests, 1 hosted live-pilot test skipped by environment gate |
| `git diff --check` and hardcoded-colour scan | passed; no hardcoded hex in Control or UI source |

Database migrations, RLS policies and Player runtime are untouched by S23.
