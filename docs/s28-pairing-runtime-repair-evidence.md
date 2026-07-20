# S28 — Pairing-runtimecorrectie

## Oorzaak

De database kon een device correct koppelen terwijl een scherm nog geen release
had. De Player gebruikte echter een succesvol manifest als enig bewijs van die
claim. Zonder `desired_release_id` gaf de manifestroute daarom een foutstatus,
bleef het pairingscherm staan en startte geen reguliere heartbeat. De bestaande
live pilot publiceerde altijd vóór pairing en dekte deze geldige onboardingroute
niet af.

## Gerepareerde flow

1. De Player maakt een tijdelijke code en bewaart het ruwe pending token alleen
   lokaal.
2. Tijdens pairing probeert de Player direct en daarna iedere twee seconden een
   `READY`-heartbeat met dat token.
3. Vóór claim faalt deze gesloten. Na de databaseclaim slaagt dezelfde
   deviceboundary, waarna alleen de tijdelijke code- en expirymetadata worden
   verwijderd.
4. Een gekoppeld scherm zonder release krijgt een succesvolle
   `READY`-bootstrap en toont `Wachten op content`.
5. Vanuit die status stuurt de Player heartbeat en controleert hij iedere vijf
   seconden op de eerste immutable release.
6. Zodra content beschikbaar is, doorloopt die dezelfde download-, hashcheck-,
   activatie- en last-known-goodregels als iedere andere release.
7. Tijdens normale playback blijft de manifestcontrole iedere zestig seconden
   lopen; heartbeat wordt iedere dertig seconden verzonden.

## Herstelgedrag

- expiry wist uitsluitend de ongeclaimde identiteit en maakt automatisch een
  nieuwe code;
- een online ingetrokken device faalt gesloten, wist zijn ingetrokken token en
  start automatisch opnieuw in pairing;
- Control ververst de onboardingstatus iedere drie seconden zolang de eerste
  heartbeat nog ontbreekt;
- offline last-known-goodgedrag en immutable releaseactivatie zijn niet
  versoepeld.

## Regressiedekking

- pairing zonder vooraf toegewezen content;
- eerste `READY`-heartbeat als onafhankelijk claimbewijs;
- eerste content die later beschikbaar komt;
- automatische coderotatie na expiry;
- automatische nieuwe pairingsessie na online revoke;
- bestaande playback-, atomic update-, offline- en accessibilitysuites.

Er zijn geen nieuwe dependencies, migraties, serviceroletokens in browsercode of
wijzigingen aan de locked merkassets toegevoegd.

## Verificatie

- `pnpm db:reset`: alle bestaande migraties en seed opnieuw toegepast;
- `pnpm test:rls`: 16 bestanden en 279 assertions geslaagd;
- `pnpm lint`, `pnpm typecheck`, `pnpm test` en `pnpm build`: volledige
  workspace groen;
- `pnpm test:a11y`: 19/19, inclusief de gekoppelde wachtstatus;
- Chromium E2E: 52 geslaagd en alleen de twee bewust opt-in live-tests
  overgeslagen;
- `pnpm test:player`: 23/23;
- `pnpm test:player:offline`: 7/7;
- opt-in live-pilot tegen geresette lokale Supabase: login, authoring,
  publicatie, echte codeclaim, verified playback, heartbeat en schermdiagnose
  geslaagd.
