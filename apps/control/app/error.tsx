"use client";

import { Button, ResourceState } from "@veyocast/ui";

export default function ControlError({ reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ResourceState
      action={<Button onClick={reset}>Opnieuw proberen</Button>}
      kind="error"
      title="Je toegang kon niet worden gecontroleerd"
    >
      De aanmelddienst of je toegangsgegevens zijn tijdelijk niet beschikbaar.
      Dit onderdeel is daarom niet geopend. Probeer opnieuw; blijft dit gebeuren,
      neem dan contact op met een beheerder.
    </ResourceState>
  );
}
