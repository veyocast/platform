# UI Primitives

`@veyocast/ui` is the shared React component package for VeyoCast surfaces. It
imports the generated design-token CSS and exposes low-level primitives for
Control, Marketing and Player setup states.

## Scope

- Layout: `Box`, `Stack`, `Grid`, `Container`, `AspectRatio`, `Divider`,
  `VisuallyHidden`.
- Actions: `Button`, `IconButton`, `Link`.
- Forms: `Field`, `TextInput`, `Textarea`, `Select`, `Checkbox`, `Switch`.
- Feedback: `Badge`, `StatusDot`, `Alert`, `Progress`, `Skeleton`,
  `EmptyState`, `ErrorState`.
- Surfaces: `Card`, `CardHeader`, `CardTitle`, `CardDescription`,
  `CardContent`.

## Usage

Import component styles once at the application boundary:

```tsx
import "@veyocast/ui/styles.css";
```

Use semantic props for variants and status instead of local color classes:

```tsx
import { Badge, Button, Field, TextInput } from "@veyocast/ui";

export function PublishForm() {
  return (
    <Field label="Venue" id="venue">
      {({ controlProps }) => <TextInput {...controlProps} />}
    </Field>
  );
}
```

Icon-only buttons require `aria-label` or `aria-labelledby`. Badges include text
because color and dots must never be the only status signal.

## Local Checks

```bash
pnpm --filter @veyocast/ui test
pnpm --filter @veyocast/ui storybook
pnpm --filter @veyocast/ui storybook:build
```
