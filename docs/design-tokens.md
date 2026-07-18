# Design Tokens

`tokens/veyocast-design-tokens.json` is the canonical S01 token source.

Run:

```bash
pnpm tokens:build
```

This generates:

- `tokens/veyocast-design-tokens.css`;
- `tokens/veyocast-tailwind-preset.ts`;
- `packages/tokens/src/generated/tokens.ts`;
- `packages/tokens/src/generated/tailwind-preset.ts`.

The Tailwind preset intentionally references CSS variables instead of raw brand
hex values. Product code should consume `vc.*` Tailwind tokens or `--vc-*` CSS
variables, not hardcoded VeyoCast colors.

The current logo assets are build-pack placeholders and remain temporary until
official locked assets replace them.
