# S188 — Poule-standlogo, gespeeld en vorm

Gebruikersopdracht 27 september 2026: herstel poule-standslides waarop het
teamlogo, het aantal gespeelde wedstrijden en de laatste vorm ontbreken. De
oplossing moet gelden voor de React Player en Static LG en via de bestaande
beschermde flow naar staging en productie.

## Oorzaak en contract

S178 herbouwde de historische `sportlink.pool_standings`-projectie om de echte
teamidentiteit veilig te herkennen. Die kopie nam de oudere verrijking van
`form` en `logoMediaAssetId` niet mee. `played` werd uitsluitend rechtstreeks
uit de providerregel gelezen, terwijl W/G/V al voldoende bewijs kunnen geven
voor een ontbrekend totaal. Beide renderers kunnen deze velden al tonen; de
immutable snapshot bevat ze niet betrouwbaar.

## Implementatie

- Laat de Sportlink-mapper `played` uit W/G/V afleiden wanneer geen expliciet
  totaal aanwezig is; een expliciete providerwaarde blijft leidend.
- Voeg een forward-only private eindprojectie toe rond de actuele
  snapshotbuilder. Die herstelt het canonieke teamlogo en provider-vorm, leidt
  gespeeld veilig af en gebruikt alleen bij ontbrekende vorm de laatste drie
  gepubliceerde uitslagen uit dezelfde bron, competitie en poule.
- Queue uitsluitend immutable opvolgsnapshots voor gepubliceerde
  `latest`-versies. Geen bestaand snapshot, release, concept of Player-LKG wordt
  gemuteerd.
- Houd de private `security definer`-grens gesloten voor `anon`,
  `authenticated` en `service_role`; voeg geen publieke RPC toe.
- Bewijs in React en Static LG expliciet dat logo, gespeeld en W/G/V zichtbaar
  blijven en voeg pgTAP-dekking toe voor provider- én fallbackdata.

Ownership: `packages/integrations`, de gedeelde content-templatecontracttests,
`apps/player/app/_lib/lg-legacy-page.ts`, de gerichte Playertest, één nieuwe
Supabase-migratie en pgTAP-test, dit promptbestand en `TASK_LEDGER.md`.

## Verificatie en uitrol

Minimaal gerichte mapper-, content-template-, LG- en pgTAPtests, daarna
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:reset`,
`pnpm test:rls`, `pnpm test:player`, `pnpm test:player:offline` en relevante
a11y/Chromiumchecks. Na groene gates: commit, push, PR naar `main`, beschermde
stagingpromotie en exact-SHA productiepromotie met health- en migratiereadback.
