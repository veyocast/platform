# Design Tokens

`tokens/castivo-design-tokens.json` is the canonical S01 token source.

Run:

```bash
pnpm tokens:build
```

This generates:

- `tokens/castivo-design-tokens.css`;
- `tokens/castivo-tailwind-preset.ts`;
- `packages/tokens/src/generated/tokens.ts`;
- `packages/tokens/src/generated/tailwind-preset.ts`.

The Tailwind preset intentionally references CSS variables instead of raw brand
hex values. Product code should consume `cv.*` Tailwind tokens or `--cv-*` CSS
variables, not hardcoded Castivo colors.

The current logo assets are build-pack placeholders and remain temporary until
official locked assets replace them.
