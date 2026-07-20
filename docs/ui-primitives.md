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
- Resource pages: `PageHeader`, `Toolbar`, `FilterBar`, `DataTable`, `Inspector`,
  `ResourceState` and the compatibility `StatusPill`.

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

## Resource page contract

- `PageHeader` owns breadcrumbs, one H1, a concise description, optional status
  and the page actions. A resource page exposes at most one primary action.
- `Toolbar` groups search, filters, sorting and view controls. Query-backed
  controls use URL state so filtered views remain linkable and recoverable.
- `FilterBar` is the canonical dense resource filter. It keeps the result count
  visible, reports active filters, offers a URL reset and collapses to one
  Radix-backed sequential control on mobile. Media, Playlists and Screens use
  this same contract.
- `DataTable` requires a meaningful caption. Responsive rows require a
  `data-label` on every cell; secondary cells can use
  `data-priority="secondary"` when hiding them below 480 px does not remove the
  primary task or state.
- `Inspector` contains the selected resource detail and secondary actions. On
  mobile it stacks after the resource list or moves to a dedicated detail flow.
- `ResourceState` explicitly distinguishes `loading`, `empty`, `error`,
  `forbidden` and `stale`. Error copy states cause, consequence and a safe
  recovery action; no state exposes raw errors or stack traces.

The Control auditlog is the first production route using this complete shared
table/state contract. Media, Playlist and Screen workspaces adopt it in S24-S27
rather than maintaining local forks.

## Local Checks

```bash
pnpm --filter @veyocast/ui test
pnpm --filter @veyocast/ui storybook
pnpm --filter @veyocast/ui storybook:build
```
