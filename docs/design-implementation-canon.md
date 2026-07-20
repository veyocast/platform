# Design Implementation Canon

## Source order

1. Approved logo/icon master assets, once supplied.
2. `docs/design-canon/v1/VEYOCAST_DESIGN_CANON_v2.0.md`.
3. `docs/design-canon/v1/veyocast-design-tokens.json`.
4. Shared component library.
5. Product-specific implementation.

The VeyoCast Bold Design & Product Canon v2.1.0 is versioned in
`docs/design-canon/v1/`. Its Markdown source, W3C-format tokens, Tailwind
preset, component inventory, page-template inventory and asset checksums are
one governed package. The root `tokens/` files
are the existing runtime-compatible projection of that source: its semantic
values are contract-tested against the canonical package while preserving the
variable names and spacing API already used by the applications.

## Environments

- Marketing: expressive, dark editorial, conversion-oriented.
- Control: calm, operational, information-rich.
- Player: clubcontent-first, VeyoCast visible only in setup/startup/diagnostics.

Control is an operational SaaS application. It uses a 248 px desktop sidebar,
64 px topbar, 32 px desktop gutter, visible tenant or platform context, a
single clear primary action per page and resource-oriented tables. It does not
use marketing-style hero sections, soft dashboard card mosaics, decorative
charts or technical implementation copy as primary interface content.

## Officiële merkassets

De door Danny Goldenbelt ontworpen en goedgekeurde VeyoCast SVG-masters staan
byte-ongewijzigd in `assets/brand/`. De v1.0-set bevat uitsluitend de masters en
technische afgeleiden die daar in `README.md` zijn beschreven. Masters worden
ongewijzigd naar app-publicmappen gekopieerd; ze worden nooit opnieuw getekend,
gerecolourd, uitgesneden of gereconstrueerd. Nieuwe varianten vereisen expliciete
goedkeuring van de merkeigenaar.

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
