export function sourceCommandError(code: string) {
  const reasons: Record<string, string> = {
    SOURCE_INPUT_INVALID: "Een invoerveld is onvolledig. Er is niets opgeslagen. Controleer de gemarkeerde velden en probeer opnieuw.",
    SOURCE_CONFIGURATION_UNAVAILABLE: "De beveiligde koppeling is nog niet beschikbaar. Je concept blijft behouden. Vraag je beheerder de koppeling te controleren en probeer opnieuw.",
    SOURCE_PROVIDER_UNAVAILABLE: "De provider kon de verbinding niet bevestigen. Je concept blijft behouden. Controleer de gegevens en probeer opnieuw.",
    SOURCE_CLUB_OR_TEAMS_UNCONFIRMED: "De opgegeven vereniging of teams komen niet overeen met de provider. Er is niets opgeslagen. Gebruik de verenigingsnaam die bij deze Client ID hoort.",
    SOURCE_PERMISSION_REQUIRED: "Je mag deze bron niet aanpassen. Bestaande gegevens blijven behouden. Vraag een beheerder van deze vereniging om de koppeling op te slaan.",
    SOURCE_VALIDATION_EXPIRED: "De providercontrole is verlopen. Je concept blijft behouden. Ga terug naar de eerste stap, controleer de bron opnieuw en probeer daarna op te slaan.",
    SOURCE_REVISION_CONFLICT: "Iemand heeft deze bron intussen gewijzigd. Je concept blijft behouden. Herlaad de nieuwste instellingen voordat je opnieuw opslaat.",
    SOURCE_SAVE_UNCONFIRMED: "Opslaan is nog niet bevestigd. Je concept blijft behouden. Probeer dezelfde opslag opnieuw; een bevestigde opdracht wordt slechts één keer toegepast."
  };
  return reasons[code] ?? reasons.SOURCE_SAVE_UNCONFIRMED!;
}
export async function boundedSourceCommand<T>(command: Promise<T>, timeoutMs = 30_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([command, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("SOURCE_SAVE_UNCONFIRMED")), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
