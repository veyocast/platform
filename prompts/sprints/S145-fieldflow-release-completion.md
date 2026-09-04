# Sprint S145 — FieldFlow v1.6 releasecompletion

## Doel

Herstel de eerdere, visueel afgekeurde S144-FieldFlow-implementatie
tegen het normatieve unified handoffpakket v1.6. Lever één rustige, consistente
productervaring op en promoveer pas wanneer alle lokale, menselijke en fysieke
releasegates werkelijk groen zijn.

## Normatieve bronnen

1. De actuele expliciete gebruikersinstructie en de vijf laatst aangeleverde
   PNG-referenties zijn leidend voor de zichtbare uitvoering van Overzicht,
   Planning, Schermen, Studio en Marketing. Zij superseden het visuele
   S144-acceptatiebewijs en oudere visuele canon waar die afwijkt.
2. Repo-governance en canons uit `AGENTS.md`, in de verplichte leesvolgorde,
   blijven bindend voor security, RLS, locked assets, toegankelijkheid,
   immutable releases en Player/offlinegedrag.
3. `VEYOCAST-FIELDFLOW-UNIFIED-MASTER-HANDOFF-v1.6.md`.
4. Het checksum-gevalideerde pakket
   `VEYOCAST-FIELDFLOW-UNIFIED-MASTER-HANDOFF-v1.6.zip`.
5. `VEYOCAST-FIELDFLOW-CODEX-MASTER-PROMPT-v1.6.md`.
6. De drie screenshots in `05-assets/evidence-current-problems/platform` zijn
   negatieve regressiebaselines en nooit goedgekeurde goldens.

## Correctiescope

- Verwijder de tweede zwarte “Operational cockpit”-rail en dubbele
  hoofdbestemmingen; behoud één sidebar en één utilityheader.
- Gebruik een standaardwerkvlak van maximaal 1440 px en maximaal 1600 px voor
  data/Studio. Standaardcontrols zijn exact 44 px, compact 36 px en grote CTA’s
  48 px.
- Plaats Schermgroepen als weergave onder Schermen en gebruik canonieke Bronnen-
  en Publicatiesroutes.
- Laat één operationele state machine alle dashboardcopy, waarden, cards en
  acties voeden. Onbekende waarden zijn `—`; `0/0` is nooit gezond.
- Bouw Studio Nieuw als echte vierstapswizard. Required state, validatie,
  samenvatting en CTA gebruiken dezelfde state; geen chipwall, legacy preview
  of overlappende footer.
- Herbouw de marketinghome op één 12-kolomsgrid met enkele tonale hoofdstukken,
  de geleverde generieke verenigingsfotografie en uitsluitend actuele,
  geanonimiseerde productcaptures.
- Behoud alle reeds bewezen slide-, Player-, Static-LG-, RLS- en
  last-known-goodcontracten ongewijzigd.

## Bewijs en releasegates

- Verplichte repo-gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm build`, `pnpm db:reset`, `pnpm test:rls`, Supabase-advisors,
  `pnpm test:a11y`, brede Chromium E2E, `pnpm test:player` en
  `pnpm test:player:offline`.
- `docs/redesign/VISUAL_QA.csv` bevat de negatieve baselines en alle vereiste
  current-state captures. DOM-tests bewijzen geen overflow, 44px-controls,
  geen sticky-overlap, maximaal twee globale shellrijen en geen succes bij
  foutfixtures.
- Nieuwe FieldFlow-goldens en contact sheets vereisen expliciete menselijke
  goedkeuring. Codex mag die goedkeuring niet zelf invullen.
- De finale lokale evidence-set bevat 71 primaire current captures plus twee
  opstellingsdetailcaptures. De gebruiker heeft de negen reviewbladen op
  4 september 2026 expliciet als “Perfect” geaccepteerd; hun status is
  `ACCEPTED_BY_USER_2026-09-04`.
- Ontbrekende exacte locked merkassets worden niet gereconstrueerd. Ontbrekende
  exacte referentiefoto's mogen volgens de expliciete gebruikersbeslissing
  worden vervangen door FF-PHOTO-01/06/05/04; het huidige officiële
  VeyoCast-icon blijft behouden. De vijf historische screenshotdiffs zijn op
  4 september 2026 expliciet geaccepteerd voor opname, maar gelden niet als
  nieuw S145-evidence- of provenancebewijs.
- Fysieke LG 43UL3J-EP-validatie blijft feitelijk `EXTERNAL_UNTESTED`; een
  browseremulator telt niet als hardwarebewijs. De gebruiker heeft uitsluitend
  de S145-releasegate expliciet geaccepteerd als
  `WAIVED_BY_USER_2026-09-04`.
- Push, PR, merge en deployment volgen pas nadat alle toepasselijke gates groen
  zijn. Deployment activeert geen tenantfeature, wijzigt geen productiegegevens
  en herschrijft geen bestaande release of snapshot.

## Branch en ownership

Branch: `veyocast/s145-fieldflow-release-completion`.

Actuele lokale status op 4 september 2026: baseline
`19e665cdcf6a2613f70332cb616e87514938d655`; brede Chromium 192 groen plus 22
conditionele skips in 21,3 minuten; finale evidence 1/1 in 4,2 minuten met 73 current captures.
Alle negen reviewbladen zijn `ACCEPTED_BY_USER_2026-09-04`; het huidige
officiële VeyoCast-icon en de beschikbare FF-PHOTO-01/06/05/04-set zijn
expliciet gekozen. De gebruiker heeft daarna de database-ownership expliciet
uitgebreid om de zes Supabase-linterrors op te lossen. De forward-only
S145-migratie, 38 gerichte pgTAP-asserties, verse reset, volledige suite van 70
bestanden/1.624 assertions en error-level db-lint met nul resultaten zijn
groen. De fysieke LG blijft `EXTERNAL_UNTESTED`, met voor uitsluitend deze
release `WAIVED_BY_USER_2026-09-04`; de vijf historische gewijzigde PNG's zijn
`ACCEPTED_FOR_INCLUSION_BY_USER_2026-09-04` en blijven buiten het
S145-evidencecorpus. De release is door de gebruiker geautoriseerd; PR/CI,
merge en de beschermde staging-/productionreadback staan nog open.

De primaire agent is de enige writer. Ownership omvat de noodzakelijke
Control-, marketing-, test-, bewijs- en sprintdocumentatiepaden plus uitsluitend
`supabase/migrations/20260904190700_s145_supabase_lint_recovery.sql` en
`supabase/tests/rls_s145_supabase_lint_recovery.sql` voor de later expliciet
gevraagde Supabase-reparatie. Andere database-, Player-, service-worker-,
lockfile- en locked-brandwijzigingen blijven stop-and-report.
