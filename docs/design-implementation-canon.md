# Design Implementation Canon

## Source order

1. Official logo/icon assets in `docs/design-canon/v1/assets/`.
2. `docs/design-canon/v1/CASTIVO_DESIGN_CANON_v1.0.md`.
3. `docs/design-canon/v1/castivo-design-tokens.json`.
4. Shared component library.
5. Product-specific implementation.

The complete Castivo Bold Design & Product Canon v1.0.0 is versioned in
`docs/design-canon/v1/`. Its PDF, DOCX, Markdown source, W3C-format tokens,
Tailwind preset, component inventory, page-template inventory, reference
images and asset checksums are one governed package. The root `tokens/` files
are the existing runtime-compatible projection of that source: its semantic
values are contract-tested against the canonical package while preserving the
variable names and spacing API already used by the applications.

## Environments

- Marketing: expressive, dark editorial, conversion-oriented.
- Control: calm, operational, information-rich.
- Player: clubcontent-first, Castivo visible only in setup/startup/diagnostics.

Control is an operational SaaS application. It uses a 248 px desktop sidebar,
64 px topbar, 32 px desktop gutter, visible tenant or platform context, a
single clear primary action per page and resource-oriented tables. It does not
use marketing-style hero sections, soft dashboard card mosaics, decorative
charts or technical implementation copy as primary interface content.

## Placeholder assets

The official compact C-icon in `docs/design-canon/v1/assets/` is a locked
asset. It is copied unchanged to the Control public brand map for application
use. No logo or icon is redrawn, recoloured, cropped or reconstructed. The
horizontal lock-ups still require separately approved masters before use.

## Tokens

Do not hardcode brand colors in components. Use CSS variables and Tailwind tokens.

## Component rules

- Build primitives first.
- Use semantic props.
- Avoid local forks.
- Storybook must show light/dark, responsive and states.
- Every important pattern has loading, empty, ready, error and permission states.
- Status has a text label and a non-colour cue.
- Tables expose meaningful column headers, named actions and a mobile card
  transformation where a horizontal table stops being legible.
- Dense data belongs in a table, list or inspector; a card is reserved for a
  repeated item, modal or genuinely framed tool.
- Mobile is a task flow with its own hierarchy, not a shrunken desktop shell.

## Accessibility

- WCAG 2.2 AA for website and Control.
- Full keyboard flow for dashboard tasks.
- Touch target min 44 px.
- Player readability tested at distance.
- Reduced motion respected.

## Control quality gate

Every Control UI PR must complete
`docs/control-enterprise-ux-checklist.md`, render the relevant desktop and
mobile routes, and include an accessibility test for changed flows. The
checklist is a concise execution guide; the complete canon remains normative.
