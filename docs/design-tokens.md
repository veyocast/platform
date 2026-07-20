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

De officiële locked merkassets staan in `assets/brand/`. Hun intern vastgelegde
kleuren blijven byte-ongewijzigd en zijn geen vervanging voor de semantische
UI-kleurtokens in dit pakket.
