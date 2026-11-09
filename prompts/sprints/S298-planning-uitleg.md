# S298 · Nu, Hierna en Waarom

Voer fase B1 van de VeyoCast-overdracht van 9 november 2026 uit. Startbasis is
main `da3d1242c92beedee3e8d8d8d2c8d35404ab4ae6` na S295. De gebruiker heeft
implementatie en normale staging-/productiepromotie expliciet aangevraagd.

Ownership root: `dashboard/planning/**`, een eigen effectieve-planningcomponent
in de bestaande playlistpublicatiepreflight, eigen gedeelde query/helper en
tests, `packages/contracts/src/effective-planning.ts` en diens afzonderlijke
index-export (ownershipuitbreiding gemeld na de eerste typecheck; geen nieuwe
dependency), één nieuwe forwardmigratie na vrijgave van de exclusieve S299-writer,
eigen SQL/RLS-tests, dit prompt, eigen bewijsdoc en het centrale plan/ledger.
De bestaande actieve resolver blijft de enige bron van rangschikking. Vooruitblik
en conceptpreflight zijn read-only en mogen geen assignment of render starten.

Toon per toegestaan scherm de winnaar, publicatie, eerste beslissende regel,
relevante verliezers, eerstvolgende werkelijke uitkomstwisseling binnen een
begrensde horizon en bekende hervatting. Houd door de player bevestigde inhoud
apart. Hergebruik exacte target-snapshots, tenanttijdzone en bestaande
recurrence-/DST-semantiek. Bestaande mutatie- en publicatiecontroles blijven staan.

Acceptatie: PLN-01..04, INT-05/10; twee tenants, overlappende bron/specificiteit/
prioriteit, verliezende tussenliggende regel, fallback, recurring/middernacht/
DST, gewijzigde groepsleden, verschillende gewenste/bevestigde release en
controle dat preview niets schrijft. UI op 320 px en desktop, toetsenbord/a11y.
Forwardmigratie uitsluitend eerst geïsoleerd testen; normale lint/typecheck/
test/build/SQL/RLS/Playwright-gates voor review. Documenteer precieze grenzen.

Root is tevens integratie-/uitrolowner van de gehele opdracht: de afzonderlijke
`scripts/probe-staging-canary-player.mts` en bijbehorend sanitized stagingbewijs
horen bij die operationele scope. Alleen de expliciete staginghost en een aparte
interne fixturetenant; normale authoring-, worker- en publicatiecommando's.
Geen providercredentials, devicetokens, signed URLs of raw payloads in bewijs.

Root autoriseert na concrete brede CI-analyse uitsluitend de bestaande
`tests/player/dynamic-activation-refresh.spec.ts` voor één ontbrekende
`await staged()` vóór de correctiegrens en de bestaande lokale
`sync-create-wizard.module.css` voor herstel van haar bedoelde48pxtouchhoogte.
Geen productie-Playergedrag, timeout,44pxgrens, globale shell of tokens wijzigen.
Bewaar eerdere rode bewijzen en onderscheid de gerichte cross-branch-runtimeproef
van de eigen normale CI/build.
