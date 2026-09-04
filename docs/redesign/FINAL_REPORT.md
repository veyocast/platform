# S145 FieldFlow v1.6 correctierapport

Datum: 4 september 2026
Branch: `veyocast/s145-fieldflow-release-completion`
Correctiebaseline: `19e665cdcf6a2613f70332cb616e87514938d655`
Implementatiestatus: `VERIFIED_LOCAL_RELEASE_AUTHORIZED`
Releasestatus: `DEPLOYMENT_PENDING`
Commit/PR/deployment: geautoriseerd; feitelijke SHA's en readbacks volgen na
de beschermde GitHub-flow

## S145-uitkomst

De visueel afgekeurde S144-platformuitvoering is voor acceptatie vervangen door
de S145-correctie (`SUPERSEDED_VISUAL`). De vijf laatst aangeleverde referenties
zijn leidend voor de zichtbare uitvoering van Overzicht, Planning, Schermen,
Studio en Marketing; oudere visuele canon en S144-captures verlenen geen
goedkeuring waar zij daarmee conflicteren. De hogere technische grenzen blijven
wel gelden: security en RLS, locked merkassets, toegankelijkheid, immutable
releases en Player/offlinegedrag worden niet afgezwakt. Control heeft één shell
en één operationele state-machine, onbekende waarden worden als `—` getoond en
`0/0` claimt geen gezondheid. Studio Nieuw blijft een echte
vierstapsflow met gedeelde validatie voor invoer, samenvatting en CTA. De
marketinghome gebruikt één redactioneel 12-kolomsgrid en goedgekeurde generieke
fotoassets zonder klantclaims.
De gebruiker heeft de actuele reviewuitvoering op 4 september 2026 expliciet
als “Perfect” geaccepteerd. Daarbij blijft het huidige officiële VeyoCast-icon
behouden en zijn de reeds gebruikte approved assets de definitieve vervangers
voor ontbrekende targetbronnen: FF-PHOTO-01 voor de hero, FF-PHOTO-06 voor
team-/clubmomenten, FF-PHOTO-05 voor het tactiek-/vrijwilligersblok en
FF-PHOTO-04 voor de onderste CTA. Alleen de assetidentiteit is hiermee
gesupersed; targetgeometrie, layering, spacing en hiërarchie blijven leidend.
De na-reviewcorrectie houdt de twee witte herochips en de afspeelbalk vóór de
organisch gemaskeerde foto en reserveert minimaal 32 px tussen de
opstellingsplattegrond en de zonecopy. Beide details hebben een expliciete
browsergeometrieregressie. Marketingafbeeldingen gebruiken daarnaast een
robuuste laad-/foutfallback; native broken-imageglyphs en alternatieve tekst
lekken niet meer als visueel artefact in de pagina.
Bij de synthetische totale afbeeldingsfout blijven image-based header- en
footer-lock-ups daarom schoon onzichtbaar. Er is bewust geen nagemaakte
tekst-/vectorlock-up als tweede fallback: het huidige officiële locked
VeyoCast-icon blijft op expliciete instructie leidend. Deze synthetische
totale-image-failure is als bekende P2-grens menselijk geaccepteerd.
De finale beeldaudit vond daarnaast dat een tenantspecifieke CSS-regel de
labels in de ingeklapte 72px-zijbalk opnieuw zichtbaar maakte. Een
hogere-specifieke collapsed-regel en nieuwe boundsasserties herstellen dit:
labels zijn verborgen en de tenantmarkering blijft volledig binnen de rail.

De finale evidence-run na de laatste codewijziging is technisch groen en maakte
73 actuele captures: 71 primaire state-/routecaptures en twee
opstellingsdetailcaptures. Dat bewijs controleert routecontracten,
runtimefouten, horizontale overflow, shellopbouw en controlhoogtes en maakt
side-by-side reviewbladen. Het voert geen automatische pixelvergelijking uit en
kent daarom niet zelf een acceptatiestatus toe. De gebruiker heeft alle negen
bladen expliciet geaccepteerd als `ACCEPTED_BY_USER_2026-09-04`. Met vijf
targets, drie negatieve baselines en negen contact sheets bestaat de actuele
S145-visual-QA-set uit 90 PNG-bestanden.

De gebruiker heeft daarnaast de vijf reeds gewijzigde historische PNG's
expliciet geaccepteerd voor opname als
`ACCEPTED_FOR_INCLUSION_BY_USER_2026-09-04`. Zij blijven buiten die set van 90
S145-evidencebeelden en krijgen geen nieuwe provenanceclaim. De fysieke LG
43UL3J-EP is niet door Codex of repositorybewijs bediend en blijft
`EXTERNAL_UNTESTED`; uitsluitend de S145-releasegate is door de gebruiker
geaccepteerd als `WAIVED_BY_USER_2026-09-04`. Dit is geen geslaagde
hardwaretestclaim.

Na expliciete gebruikersopdracht is de S145-ownership begrensd uitgebreid met
één forward-only Supabase-migratie en één pgTAP-bestand. De reparatie wijzigt
geen tabel, RLS-policy, Player, service worker, lockfile, locked merkasset,
historische release of compatibility-golden. Zij herdefinieert uitsluitend zes
bestaande functies met dezelfde signatures en expliciet herbevestigde ACL's.

## Actuele lokale verificatie

| Gate | Uitkomst |
|---|---|
| `pnpm lint` | 30/30 taken groen |
| `pnpm typecheck` | 30/30 taken groen |
| `pnpm test` | 30/30 taken groen; Control 309/309 en Player 246/246 |
| `pnpm build` | 18/18 taken groen |
| `pnpm db:reset` | 108 forward-migraties vanaf nul toegepast, inclusief S145 |
| gerichte S145-pgTAP | 38/38 assertions groen |
| `pnpm test:rls` | 70 pgTAP-bestanden, 1.624 assertions groen |
| `supabase db lint --local --level error --fail-on error --output-format json` | exit 0; `results: []`, dus 0 error-level bevindingen |
| `pnpm test:a11y` | 36 groen, 1 live-only fixture bewust overgeslagen, 0 rood in 5,9 minuten |
| `pnpm test:e2e -- --project=chromium` | 192 groen, 22 conditionele live/opt-in skips, 0 rood in 21,3 minuten |
| Gewijzigde marketing-/Control-/Studio-slices | marketing 5/5 en Control/Studio 24/24 groen na de detailcorrecties |
| `pnpm test:player` | 117/117 groen |
| `pnpm test:player:offline` | 7/7 groen |
| FieldFlow evidence-run | 1/1 groen in 4,2 minuten na de laatste codewijziging; 73 current captures: 71 primaire state-/routebeelden plus 2 opstellingsdetailcaptures met contract-, overflow-, runtime-, shell-, controlhoogte- en afstandsasserties |
| LG bronvalidatie/tests | 33 productie- en 5 smoketestbestanden geldig; 14/14 tests groen |
| LG smoketest-IPK | inspectie en checksum groen; SHA-256 `634500c35699524e90d7de87cd82655b49360154a1e02ada37659d00660c763b` |

## Herstel van de zes Supabase-linterrors

De meldingen waren echte PL/pgSQL-/schemacontrolefouten. De gebruiker heeft
database-ownership daarna expliciet aan S145 toegevoegd. Migratie
`20260904190700_s145_supabase_lint_recovery.sql` herstelt ze zonder oude
constraints terug te brengen of API-signatures te wijzigen:

1. `create_platform_support_role_v1`, `assign_platform_support_role_v1` en
   `review_data_deletion_v1` gebruiken nu de bestaande canonieke
   `private.require_platform_owner_aal2()`-grens. Owner-only en AAL2 blijven
   beide verplicht.
2. `run_retention_maintenance_v1` controleert de oorspronkelijke requestrol in
   plaats van `current_user` binnen een `SECURITY DEFINER`-functie. Alleen de
   reeds geautoriseerde `service_role` kan uitvoeren en iedere run registreert
   `scheduled_worker` als actor.
3. `complete_scheduled_rss_sync_v1` behoudt het pre-v2 payloadcontract en de
   rollbackcompatibiliteit, maar verwijdert de redundante verouderde
   snapshot-upsert. De bronrevisie activeert de actuele versiegebonden queue,
   zodat open drafts en immutable historie veilig blijven.
4. `complete_sportlink_sync_before_standing_history_v1` behoudt de interne
   completionketen, maar accepteert alleen een lege standingsarray. Niet-lege
   legacywrites falen expliciet met SQLSTATE `22023`; de actuele v1/v4-route
   verwerkt seizoenstanden via de vierdelige sleutel.

Alle zes functies behouden `SECURITY DEFINER`, `search_path = ''` en expliciet
beoordeelde rechten voor `PUBLIC`, `anon`, `authenticated` en `service_role`.
De nieuwe 38-assertie regressietest bewijst de volledige Data API-ACL-matrix,
owner+AAL2 inclusief negatieve AAL1-/adminpaden, een echte retention-dry-run
met behoud van het eligible record, legacy RSS inclusief no-op, leasebehoud,
versieprovenance en een open v2-draft die niet wordt gerenderd, plus
fail-closed Sportlinkgedrag. Na een verse reset zijn alle 70
pgTAP-bestanden/1.624 assertions groen en levert error-level db-lint geen
resultaten meer.

## Open releasegates

1. De branch moet via PR en de verplichte GitHub CI-gates naar `main` worden
   gemerged.
2. Staging moet de uiteindelijke merge-SHA, vier immutable image-digests,
   migrationhistory, health en pairing/recovery-smoke teruglezen.
3. Productie vereist daarna een expliciete workflowdispatch en moet exact
   dezelfde merge-SHA en image-digests plus migration-, health- en
   pairing/recoveryreadback bevestigen.

Push en deployment zijn op 4 september 2026 expliciet door de gebruiker
geautoriseerd. Tot de feitelijke workflowreadbacks zijn ingevuld, zijn er nog
geen tenantflags geactiveerd en geen productiegegevens door S145 gewijzigd.

## S144 historisch rapport

Dit deel bewaart uitsluitend het technische S144-spoor. De gebruiker heeft de
zichtbare uitvoering later afgekeurd; voor visuele acceptatie is S144 door S145
vervangen en geen van de onderstaande historische claims keurt S145 goed.

Datum: 2 september 2026
Branch: `veyocast/s144-fieldflow-platform-redesign`
Nulmeting: `6fe477a332ab6565a6bb3205959ebfe7766e9a2c`
Implementatiestatus: `VERIFIED_LOCAL`
Releasestatus: `BLOCKED_EXTERNAL`
Implementatiecommit: `f277e5d4488ee6b7b2db44162c67751955eb1ae7`
Pull request: `https://github.com/veyocast/platform/pull/163`

## Uitkomst

De twee aangeleverde opdrachten zijn als één samenhangend programma verwerkt:
FieldFlow v3 is de zichtbare producttaal voor marketing, Control, mobile en
devicebeheer én de authoring-/outputtaal voor dynamische slides. De bestaande
security-, tenant-, immutable-release- en offlinegrenzen zijn niet afgezwakt.

Nieuwe of muteerbare slidecontent gebruikt uitsluitend `fieldflow`. De tien
historische theme-ID's blijven verborgen rendercompatibiliteit voor reeds
bevroren snapshots. Modern Player, preview/capture en de zelfstandige
Chrome-79-veilige Static-LG-renderer consumeren dezelfde gevalideerde
displayconfig; onbekende typen krijgen geen generieke stille fallback.

De repositorywijziging omvat daarnaast de nieuwe informatiearchitectuur en
één-hop redirects, account/MFA-herstelroutes, FieldFlow tokens en componenten,
lokale Manrope/Inter-fonts, 23 byte-identieke aangeleverde beeldderivatives,
22 Studio-systeemtemplates, alle vier nieuwscomposities, alle zeven Menu
Document v2-blocks, expliciete sportfamilies, dubbele teamlogo's,
arrival-/sponsorassets, Player/LG/Android-beheerchrome, drie forward-only
Supabase-migraties en machineleesbare governance- en coverageregisters.
Het exacte padmanifest bevat 271 gewijzigde, toegevoegde of verwijderde
bestanden en staat in `CHANGED_FILES.md`.

## Verificatie

| Gate | Uitkomst |
|---|---|
| `pnpm lint` | 30/30 taken groen |
| `pnpm typecheck` | 30/30 taken groen |
| `pnpm test` | 30/30 taken groen; onder meer Control 304/304 en Player 246/246 |
| `pnpm build` | 18/18 taken groen; Next-productiebundels, Expo Android-export, auth-/secret- en webOS-guards inbegrepen |
| `pnpm db:reset` | 107 forward-migraties toegepast |
| `pnpm test:rls` | 69 pgTAP-bestanden, 1.586 assertions groen |
| `pnpm exec supabase db lint --level warning` | exit 0; uitsluitend vooraf bestaande waarschuwingen, hieronder benoemd |
| `pnpm test:a11y` | 36 groen, 1 live-fixturecheck bewust overgeslagen |
| `pnpm test:e2e -- --project=chromium` | 191 groen, 21 conditionele live/evidence-skips, 0 rood; 212 totaal in 20,2 minuten |
| `pnpm test:player` | 117/117 groen, inclusief 64 moderne, 44 Menu Studio- en 16 nieuwe Static-LG-goldens |
| `pnpm test:player:offline` | 7/7 groen |
| LG bronvalidatie | 33 productie- en 5 smoketestbronbestanden geldig |
| LG wrappertests | 14/14 groen |
| LG IPK | gebouwd; SHA-256 `283ce09de38474e511d728cba313f9ad4155a1649e1265bab4fdb35c71947323` |
| Android statisch | shellsyntax groen; 11 XML-resources geldig |
| Android Gradle | `EXTERNAL_BLOCKED`: Java/JAVA_HOME en Android SDK ontbreken op deze host |

De database-linter meldt nog dezelfde historische repositoryproblemen buiten
de S144-migraties: ontbrekende `private.require_platform_roles`-referenties in
retention/supportfuncties, legacy RSS-/Sportlink-`ON CONFLICT`-analyse en enkele
type-/unused-adviezen. De schone reset en volledige RLS-suite zijn wel groen;
deze waarschuwingen zijn niet onderdrukt of als S144-regressie voorgesteld.

## Visueel en assets

- 64 moderne FieldFlow-goldens: 16 representatieve varianten × twee
  oriëntaties × light/dark.
- 44 Menu Studio-goldens: tien legacy theme-ID's blijven pixelcompatibel;
  vier FieldFlow-cellen zijn toegevoegd.
- 16 nieuwe Static-LG-goldens voor team, sponsor, training en vrijwilligers,
  bovenop de bestaande LG-regressies voor nieuws, sport, menu, arrivals,
  live/LED en recovery.
- `SLIDE_COVERAGE.csv` bevat exact 64 functionele rijen;
  `CONFIG_TO_RENDER_TRACE.csv` sluit zichtbare orphan-controls uit.
- Alle 23 aangeleverde WebP-derivatives zijn met identieke SHA-256 overgenomen;
  producent, consumer, fallback en bewijs staan in de assetregisters.

Zie `GOLDEN_INDEX.md`, `VISUAL_QA.md`, `ASSET_MANIFEST.csv`,
`CHANGED_FILES.md` en `ACCEPTANCE_CHECKLIST.md` voor het volledige reviewspoor.

## Niet omzeilde externe gates

1. GitHub Actions weigert alle vijf PR-workflows vóór de eerste stap. De
   check-annotations melden expliciet dat het account wegens een billingissue
   is geblokkeerd. Bewijs op de implementatiecommit:
   - PR Gates: `https://github.com/veyocast/platform/actions/runs/33647096532`
   - Database/RLS: `https://github.com/veyocast/platform/actions/runs/33647096531`
   - Android Player: `https://github.com/veyocast/platform/actions/runs/33647096541`
   - LG webOS: `https://github.com/veyocast/platform/actions/runs/33647096808`
   - Control Mobile: `https://github.com/veyocast/platform/actions/runs/33647096743`
2. De twee self-hosted runners zijn online, maar kunnen door die GitHub-gate
   geen officiële preflight of deployjob ontvangen.
3. Deze host heeft geen deploy-user, `/srv/apps/veyocast`, SSH-private key,
   agentcredential of staging-/productionsecrets. Een handmatige VPS-bypass is
   daarom zowel onmogelijk als verboden.
4. Production heeft een vereiste reviewer en main-only bescherming. Er is niet
   self-approved, admin-gemerged of buiten de officiële workflow gepromoveerd.
5. Fysieke LG 43UL3J-EP- en Android telefoon/tablet/TV-acceptatie blijven
   `EXTERNAL_UNTESTED`; een browseremulator of statische parse wordt niet als
   toestelbewijs gepresenteerd.
6. De beschikbare Supabase-connector toont uitsluitend niet-VeyoCast-projecten;
   daaraan is bewust niets gewijzigd.

## Herstelactie en releasepad

De GitHub-organisatie-eigenaar moet de Actions-billing/spending limit
herstellen. Daarna moet de officiële PR-gate op exact de branch-SHA opnieuw
draaien. Alleen een volledig groene merge-SHA mag via de bestaande immutable
main → staging → production-workflow worden gepromoveerd, met environmentreview
en health/worker/pairing/release-readback. De rollbackstrategie staat in
`ROLLBACK.md`; schemawijzigingen worden niet teruggedraaid en een Player behoudt
altijd zijn geldige last-known-good release.

## Bekende grenzen

- Geen fysieke LG-, Android- of langdurige soakmeting kon op deze host worden
  uitgevoerd.
- Live-fixturetests blijven conditioneel overgeslagen wanneer de vereiste
  staging-/tenantcredentials ontbreken; mocks, contracttests en lokale
  end-to-endpaden zijn wel groen.
- De capabilitygaps in `CAPABILITY_GAPS.md` zijn bewust niet met nep-CRUD
  gevuld. Alleen werkelijk bestaande read-/writecontracten worden getoond.
- Productie is niet gewijzigd zolang de beschermde externe gates rood of
  onbeschikbaar zijn.
