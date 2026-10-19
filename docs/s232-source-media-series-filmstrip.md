# S232 — Rawmediareeksen en Source-filmstrip

S232 voegt aan de bestaande rawmedia-editor een volledige Content-filmstrip en
duurzame reeksen toe. `Nog een slide toevoegen` bewaart de actuele invoer en
maakt precies één logische kopie in dezelfde transactie. Het originele bestand
en bestaande plaatsingen, immutable versies en publicaties blijven behouden.

Werkbasis: `46da925b6f0ff5047484c83620fab3e42a11e6a0`, branch
`veyocast/s232-media-series-filmstrip`. De afgebakende ownership en het exacte
RPC-contract staan in [het sprintprompt](../prompts/sprints/S232-source-media-series-filmstrip.md).
Dit document registreert lokale softwareacceptatie; de eigen PR/CI en de
normale staging-/productiepromotie volgen afzonderlijk.

## Gedrag en grenzen

- Beide bestaande media-editorroutes krijgen dezelfde niet-gearchiveerde,
  toegankelijke Content-bibliotheek: media, media-ontwerpen, Studio, dynamische
  content en Studio-reeksen. De bestaande Content-mapper, keys, echte hrefs en
  private previewvalidatie worden gedeeld. Laden gebeurt read-only in pagina's
  van 48; de filmstrip is geen lijst met alleen leden van de huidige reeks.
- De reekstitel hoort bij ieder lid. Bewaren wijzigt uitsluitend dat lid; een
  lege titel behoudt zijn binding. Append gebruikt de ECMAScript-trim van de
  titel, of de genormaliseerde ontwerpnaam als fallback, voor het huidige en
  nieuwe lid. De overige labels blijven behouden. Er is geen limiet van 20
  leden; de database bewijst ook het 21e lid en bewaakt integeroverloop.
- De server maakt een nieuwe reeksidentiteit. Een ongebonden opdracht gebruikt
  `seriesId=null` en `expectedSeriesRevision=null`. Frame- en groepsrevisies
  beschermen tegen gelijktijdige wijzigingen. Het oorspronkelijke receipt
  wordt na actuele autorisatie, maar vóór mutable binding-/CAS-controles gelezen.
- Het browserjournal bewaart vóór POST de volledige oorspronkelijke opdracht
  en nonce. Reload en opnieuw bevestigen herhalen die opdracht. Bestaande
  S231-framecommands blijven hun eigen contract houden onder de v2-omhulling.
  Vuile filmstripnavigatie bewaart lokale invoer zonder impliciete serverwrite.
  Dit is actor-/tenantgebonden `sessionStorage`, geen cloud- of apparaatbreed
  concept. Bij ontbrekend of ongeldig receipt blijft de uitkomst onzeker.
- De bestaande Source-compositie blijft leidend: portretthumbnails van 35 ×
  62 px, desktopfilmstrip en verborgen filmstrip bij 390 px. Reeksbediening
  blijft op mobiel bereikbaar. De gemeten controls zijn minimaal 44 px hoog.
  Geen Player-, serviceworker-, provider-, dependency- of workflowwijziging.

## Database en migratie

De enige nieuwe forwardmigratie is
`20261019000000_sync_media_frame_series.sql` (SHA-256
`cb912b87b3ea2dfa467539ad6a4055f1ffbbd6e00b990a5a5d8892ace3734db3`).
Zij voegt `media_frame_series` en `media_frame_series_items` toe met verplichte
tenantidentiteit, geïndexeerde tenantkeys, tenant-aware composite foreign keys,
RLS en default-deny writes. Alleen bevoegde authenticated lezers krijgen
SELECT; mutaties lopen via de guarded achtargumenten-RPC
`mutate_media_frame_series_v1`. Alle functiegrants zijn expliciet en helpers
staan private met `search_path=''`. De reader is security invoker.

De mutatie hergebruikt de bestaande S231-create/savecommands, broncontrole en
tenantmediamutex. De nieuwe kopie heeft `isPrimary=false`. Dezelfde transactie
omvat huidige opslag, kopie, membership, audit en parentreceipt; een fout laat
geen gedeeltelijke reeks achter. Er is geen backfill of rewrite van oude data.
S231-migratie `20261018200500_sync_media_frames.sql` behoudt SHA-256
`304429f3ba27dfa8b297aa7ecc41f85c841c938a1206e897aaaf320895d887c5`.

De disposable gatedatabase doorliep een verse reset met 197 migraties. Op de
werkelijke lokale QA is uitsluitend deze ene nieuwe migratie atomair toegepast:
177 → 178 historyrecords, exact één nieuw record, 19 bestaande trackinggaten
behouden en alle 15 gecontroleerde oude tenanttabellen bytegelijk. Die forward
wordt niet herhaald; geen reset, `--include-all` of historyrepair op bestaande QA.

Uitrol gebruikt de bestaande migratie-eerst releaseflow en vereist eigen
exact-SHA CI en staging-/productiereadbacks. Een applicatierollback mag het
additieve schema geïnstalleerd laten; er is geen destructieve downmigratie of
verwijdering van gemaakte frames, memberships of receipts. Oude applicatiecode
kan reeksen niet bedienen, maar bestaande frame-/publicatiecontracten blijven
bestaan. Een latere datacorrectie gebeurt forward-only.

## Gecontroleerd bewijs

Alle 24 bevroren product-/testbestanden zijn opnieuw tegen de drie finale
writermanifests gehasht; 24/24 gelijk. De aanvullende releasewrites beperken
zich tot dit document, de eigen S232-ledgerrij en het promptbewijssupplement.
De bekende credentialformaten/private-keyscan van de gewijzigde bestanden
vindt geen match; environmentbestanden of secretwaarden zijn niet gelezen.

| Gate | Lokaal resultaat |
|---|---|
| Foundation | `pnpm lint --concurrency=2`, `pnpm typecheck --concurrency=2`, `pnpm test --concurrency=2` serieel: elk 30/30; respectievelijk 29/29/28 cachehits. Control 1.194 PASS / 34 bestaande SKIP. |
| Servercontracten | 119/119 gerichte units; scoped lint/typecheck groen. |
| UI | 18 nieuwe state-units en 28 bestaande presenter-units groen; volledige Control-typecheck en spec-/lintchecks groen. |
| Chromium/a11y | 24/24 cases: 15 bestaande editorcases en 9 nieuwe reeks-/filmstripcases, één worker, geen retry/skip; aXe en documentoverflow nul bij 390/1440. |
| Database | 132 RLS-bestanden / 3.876 assertions, waarvan 102 nieuw; zeven echte sessieraces groen; publieke/private error-level db-lint nul. |
| Werkelijke AAL2-journey | Atomair append, verloren eerste antwoord, reload/replay, vuile navigatie, onafhankelijke lidtitel en lege titel met behouden binding: PASS. |

De werkelijke lokale journey gebruikt eigen nieuwe primary
`8ba27c1f-55e2-4da0-a8c6-b1af9fc764d3`, kopie
`d209406e-7779-4699-b180-060a4d5d11cd` en reeks
`49feb902-bce9-42c9-91a1-027da8adfd22`. Vóór het gecontroleerde verlies van het
eerste antwoord waren de commit, twee frames, twee memberships en één
parentreceipt al onafhankelijk gelezen. Dezelfde levende browsercontext laadde
opnieuw en verstuurde exact dezelfde Flightbody en nonce. Er ontstond geen
tweede reeks, kopie of parentreceipt. Daarna behield een lege titel de binding
en bleef het label van het andere lid gelijk; de groepsrevisie eindigt op 3.

Alle oude rijen in 162 tenanttabellen bleven behouden; 155 tabellen waren
volledig exact gelijk. De zeven overige tabellen bevatten uitsluitend de
toegestane nieuwe eigen acceptatierijen. Storage-rijen, migratiehistorie,
freeze-manifests en producthashes bleven exact gelijk. Er waren geen pageerrors
of geblokkeerde requests in de geslaagde journey. Screenshots en geometrie/aXe
zijn per 390/1440 vastgelegd, vóór en na de mutaties.

De onderstaande manifests zijn lokaal bewaard, niet als credentials of ruwe
browserauth in de repository opgenomen. SHA-256 bindt iedere samenvatting aan
het oorspronkelijke bewijs.

| Manifest | SHA-256 |
|---|---|
| `/tmp/veyocast-s232-db-final-proof.json` | `43c4e4435cb106996b0363c063bb623e1fb78fc19d40c99da265d481a0a0db43` |
| `/tmp/veyocast-s232-server-final-readback.json` | `4045eb874cf3917a445a7c8a3abe3c671c1cfdffe7ac8ae1bcadb8ec7ab577b5` |
| `/tmp/veyocast-s232-ui-release-evidence/final.json` | `1cf9fe446b29aaa1ff4a5b84294e408d6c6351c2a97777f16201dd2b0f7b7e80` |
| `/home/codex/.local/state/veyocast-s226/release-evidence/s232-single-local-forward.json` | `b68c937b2986f398f285baa2bb07fe24278976819898f35c483883a86e0526b9` |
| `/tmp/veyocast-s232-actual-acceptance-final.json` | `c17554894a5912b957de680effce21e1a7be443459622295fe0aa2ea59633832` |
| `s232-series-real/ef7bf7d3-e0bf-464a-b6b4-3419673e4795/checkpoint.json` onder dezelfde release-evidencemap | `b734620f679a133ac2073b61c6ca6556563480fc3080937178c34186868dc49d` |
| `/tmp/veyocast-s232-release-foundation.json` | `111f4069145fe9bb2028d4804a65ab8c1e462a98d5e418212e78a2d19dc75d6d` |

## Behouden beperkingen en eerste fouten

De eerste werkelijke koude editor-GET gaf vóór enig command HTTP 500 met een
SSR-rollenfout `PGRST303`. De oorzaak blijft onverklaard; het originele
`STOPPED_FOR_REVIEW`-checkpoint en de veilige screenshot blijven behouden
(checkpoint-SHA `00f905675981b7ee974ef55c4a6d4b18209ef479029b611645201ae638f5d904`).
Twee latere onafhankelijke read-only editor-GETs waren HTTP 200 en behielden
alle 162 tabellen exact (checkpoint-SHA
`cbee0e86c907d15c7b8d04afa2e1c228b540cd02cab4793891712bacf48eb285`).
Die readbacks en de geslaagde nieuwe journey verklaren de oorspronkelijke fout
niet en bewijzen geen algemeen SSR-herstel.

Ook de eerdere SQLsyntax-/fixturefouten en de gecontroleerde browserfixture
zonder UTF-8-charset blijven in de writermanifests bewaard. Hun gerichte
correcties verzwakken geen productguard, assertion, deadline of skipbeleid.

De componentcases gebruiken gecontroleerde transporten; de afzonderlijke AAL2-
journey bewijst de echte lokale mutatie. Geen van beide levert een algemene
pixel-/V1-pariteitsclaim, nieuwe provideracceptatie, upload-/publicatie- of
Playeracceptatie op. Playercode en offline-invarianten zijn ongewijzigd.
Fysieke Android/LG en 24-uurs soak, SendGrid-keys en YouTube-/Mollieaccounts
blijven volgens de gebruikersopdracht uitgesteld. Hosted CI, integratie en
exacte staging-/productiepromotie worden door root afzonderlijk afgerond.
