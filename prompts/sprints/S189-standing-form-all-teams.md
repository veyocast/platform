# S189 — Vorm voor alle teams in de poulestand

Gebruikersopdracht 10 oktober 2026: toon de vorm ook voor de andere teams in
de standenlijsten. S188 herstelt de vormprojectie, maar een standrij zonder
provider-teamcode draagt een naamhash terwijl een uitslag een echte team-ID
kan bevatten. De bestaande fallback kan deze tegenstander niet herkennen.
Het uitslagenvenster van 14 dagen bevat bovendien niet altijd drie wedstrijden.

## Ownership en uitvoering

- `packages/integrations/src/sportlink-mappers.ts` en de bijbehorende
  `packages/integrations/test/sportlink.test.ts`: pure vormverrijking uit
  maximaal drie voltooide, gedateerde uitslagen in dezelfde poule. Expliciete
  team-ID is leidend; de bestaande naamhash mag alleen via exacte, unieke
  poule-identiteit gekoppeld worden. Provider-vorm blijft leidend.
- `apps/media-worker/src/sportlink-sync-runner.ts` en de bijbehorende
  `apps/media-worker/test/sportlink-sync-runner.test.ts`: ontbrekende vorm
  aanvullen tijdens standen-sync met de bestaande officiële `pouleuitslagen`
  voor eigen én overige wedstrijden, met een begrensd venster van 90 dagen.
  Geen extra calls wanneer alle standrijen al provider-vorm hebben.
- `docs/operations/sportlink-sync.md`, dit promptbestand en `TASK_LEDGER.md`.

De extra uitslagen worden uitsluitend voor de standvorm gebruikt. Ze worden
niet toegevoegd aan de wedstrijdlijsten of de selecteerbare eigen-teamcatalogus.
Geen schema-, RLS-, UI-, Player-, release-, dependency- of locked-assetwijziging.
Een tijdelijke providerfout laat de vorige complete sync behouden. Een expliciet
ontbrekende capability laat de gewone stand en bestaande fallback beschikbaar.

## Verificatie

Gerichte regressies voor alle teams, thuis/uit, chronologische laatste drie,
duplicaten, ontbrekende scores, afgelast/toekomstig, poule/fase/seizoen,
ambiguïteit en conflicterende expliciete IDs. Workerprobes met testresponses
bewijzen de eigen/overige feed, langere historie, capabilityfallback en fouten.
Daarna workspace lint, typecheck, test en relevante builds; PR na groene gates.
Geen productie-uitrol of live Sportlink-bewijs geclaimd zonder uitrol/readback.

Lokaal resultaat: gerichte mapper-/workerregressies 50/50 groen; workspace
`pnpm lint`, `pnpm typecheck` en `pnpm test` ieder 30/30 taken groen;
integrations 124 en worker 168 tests groen. Worker en alle betrokken
dependencies bouwen 7/7 groen. Ongewijzigde taken gebruiken de bestaande
gedeelde Turbo-worktreecache. Geen lockfile- of unrelated diff.
