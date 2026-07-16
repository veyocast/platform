# Design Implementation Canon

## Source order

1. Official logo/icon assets.
2. `tokens/castivo-design-tokens.json`.
3. Castivo design canon.
4. Shared component library.
5. Product-specific implementation.

## Environments

- Marketing: expressive, dark editorial, conversion-oriented.
- Control: calm, operational, information-rich.
- Player: clubcontent-first, Castivo visible only in setup/startup/diagnostics.

## Placeholder assets

This pack contains placeholder logo files. They are temporary build assets only and must be replaced by official locked assets before public release.

## Tokens

Do not hardcode brand colors in components. Use CSS variables and Tailwind tokens.

## Component rules

- Build primitives first.
- Use semantic props.
- Avoid local forks.
- Storybook must show light/dark, responsive and states.
- Every important pattern has loading, empty, ready, error and permission states.

## Accessibility

- WCAG 2.2 AA for website and Control.
- Full keyboard flow for dashboard tasks.
- Touch target min 44 px.
- Player readability tested at distance.
- Reduced motion respected.
