"use client";

import { Button, ResourceState } from "@veyocast/ui";

export default function ShellError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ResourceState
      action={<Button onClick={reset}>Opnieuw proberen</Button>}
      kind="error"
      title="Dit onderdeel kon niet worden geladen"
    >
      De gegevens zijn niet gewijzigd. Probeer het opnieuw; blijft het probleem bestaan, neem dan
      contact op met een beheerder.
    </ResourceState>
  );
}
