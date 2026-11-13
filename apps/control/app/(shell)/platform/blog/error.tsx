"use client";

import {Button} from "@veyocast/ui";

export default function BlogError({reset}: {reset: () => void}) {
  return <section>
    <h1>Blogbeheer kon niet worden geladen</h1>
    <p>De verbinding met de redactie is onderbroken. Controleer na het herstellen de actuele concept- en publicatierevisie voordat je opnieuw publiceert.</p>
    <Button variant="primary" onClick={reset}>Opnieuw laden</Button>
  </section>;
}
