# S161 — Royal Current / Navy Glass v8

## Doel

Vervang voor nieuwe en opnieuw bewerkte broadcastcontent de zichtbare
FieldFlow-uitvoering door één versieerbare presentatie: **Royal Current** in
lichte modus en **Navy Glass** in donkere modus. Modern Player, Static LG,
Control-preview, workerthumbnail, poster/fallback, live-uitvoer en de
Studio-systeemtemplates interpreteren daarvoor dezelfde bevroren
`themePresentation`.

Normatieve visuele bron is prototype v8, commit
`f0e001f1f9af25d62e475226707863fd44a3795d`. De overdracht bevat 92 HTML-cases,
64 historische surface-rijen, 50 configuratietraces en 101 eisen. De historische
productie-audit van 1 september 2026 is alleen een zoekroute; de actuele
implementatiebaseline voor S161 is `e11140c99dffdc6a2f3272ae8af4439446c91538`.

## Presentatiecontract

- `fieldflow` blijft de enige publieke authoring-ID; tien historische IDs
  blijven uitsluitend decodeerbaar voor bestaande immutable content.
- Nieuwe presentatie gebruikt `snapshotVersion: 2`, appearance
  `schemaVersion: 2` en `designRevision: royal-current-v8`.
- Eén clubstijlconfiguratie bevat primaire 3/6-cijferige HEX, achtergrond
  `club|neutral`, optioneel tweede accent, motion en Roboto als standaard.
- Zes presets zijn blauw `#2459ED`, rood `#BF263B`, groen `#08734D`, oranje
  `#E06A14`, paars `#713DC2` en antraciet `#343A46`.
- Eén pure generator materialiseert de 21 normatieve CSS-rollen voor beide
  modi. QR blijft zwart op wit; statuskleuren, foto's en logo's behouden hun
  functionele kleur.
- Logische canvassen zijn 1920 × 1080 en 1080 × 1920. Schaling is proportioneel.
  De exacte shellassen, absolute footer, familygeometrie en motionwaarden komen
  uit de finale prototype-v8-cascade.
- Roboto 400, 500, 700 en 900 is lokaal en hashvast. Een gevraagde weight 800
  resolveert deterministisch naar de meegeleverde 900-face.

## Inhoudsdekking

- Alle 18 prototypefamilies, met vier nieuwsvarianten en vaste welkomstcapaciteit
  1/2/3, in beide modi en oriëntaties.
- De actuele extra productieoppervlakken: raw media, volledig Menu Document v2,
  vijf getypeerde/dormante sporttypes, Engage, YouTube-status/fallback, beide
  LED-liveviews, acht LED-momenten, zes sponsorposities, 22
  Studio-systeemtemplates en Player-systeemstaten.
- Programma/uitslagen behouden de bestaande club-/poulescope, filters en alle
  afzonderlijke displayflags. `Afgelast` vervangt het tijdstip en blijft
  zichtbaar als tijd is uitgeschakeld; een onbekende score blijft leeg.
- Stand behoudt alle statistieken, het echte eigen team als pinned rij én als
  gewone rij in bronvolgorde, plus de 3 s / 34 px/s / 3 s motionpolicy.
- Nieuws toont één hoofdtitel en QR-only. Welkom gebruikt echte bezoekerslogo's,
  30% watermark en gekozen lege slots. Engage gebruikt 2/3 resultaten en 1/3
  oproep met 1400 ms `scaleX`-bars.

## Opslag, compatibiliteit en security

- Nieuwe tenantprofielen krijgen appearance v2; bestaande profielen worden niet
  stil omgezet.
- `private.build_dynamic_snapshot_data(public.dynamic_slides)` voegt de geldige
  v2-tenantauthority alleen aan nieuw gebouwde snapshots toe. Bestaande
  snapshots, releases en Player-LKG blijven byte-ongewijzigd.
- De owner-only operatie
  `private.reset_tenant_fieldflow_royal_v2(text,text,text,text)` zet exact één
  gekozen tenant op het Royal Current v8-profiel, bouwt uitsluitend immutable
  opvolgers en schrijft auditactie `tenant.theme.royal_current_reset`; de
  beschermde workflow blijft exact-SHA-, environment- en readback-gebonden.
- V1-appearance en historische thema-ID's blijven in de rendercompatibiliteitslaag
  geldig. Nieuwe/muteerbare authoring blijft fail-closed `fieldflow`.
- De snapshotbuilder en validator blijven buiten de Data API: geen `EXECUTE`
  voor `PUBLIC`, `anon`, `authenticated` of `service_role`.
- Usermedia, vrije Studio-ontwerpen en sponsorcreatives worden niet gerecolourd,
  gecropt of overschreven. Automatische logo-transparantie is expliciet buiten
  scope.
- Een renderer- of assetfout gebruikt de checksum-geverifieerde poster van
  dezelfde snapshot; een incomplete pending release activeert nooit en de
  actieve LKG blijft spelen.

## Acceptatie en bewijs

- Pakketverifier: 161 bestanden/hashregels, 64 surfaces, 101 eisen, 50 traces,
  92 referentiecases en 973 lokale HTML/CSS-links moeten slagen.
- Iedere referentiecase krijgt dezelfde fixture, Roboto, logische canvasmaat,
  mode en orientation. Vaste geometry mag maximaal 2 logische pixels afwijken.
- Aanvullende productieoppervlakken zonder pixelreferentie krijgen eigen
  reviewed goldens; zij worden niet als prototype-pixelmatch gepresenteerd.
- Verplicht: workspace lint/typecheck/test/build, verse database-reset, volledige
  RLS, Control a11y/Chromium, Player/Player-offline, modern/LG/preview/poster-
  pariteit, QR-decode en visuele 92-case-review.
- Commit, CI, exact-SHA staging- en productionreadback worden pas als geslaagd
  vastgelegd wanneer werkelijk uitgevoerd.

## Rollback

Pauzeer bij regressie eerst nieuwe publicatie/uitrol; actieve LKG-releases blijven
staan. Revert applicatiecode alleen met een decoder die appearance v1 én v2 kan
lezen. Schakel het nieuwe snapshotgedrag zo nodig uit met een nieuwe
forward-only migratie die de wrapper weer naar de bewaarde S160-builder laat
delegeren. Verwijder of herschrijf geen v2-snapshots en herstel nooit door
historische releases mutable te maken.

## Huidige bewijsstatus

Dit sprintbestand registreert de werkende S161-branch, niet de finale
releaseverklaring. Workspace lint/typecheck/test zijn elk 30/30 groen, build
18/18; content-templates is 13 bestanden/109 tests en Control 71/391. Een
verse database-reset, S161-pgTAP 62/62, de volledige RLS-suite 78 bestanden/
2.009 tests en lokale DB-lint op errorniveau zijn groen.

De 92 bronreferenties zijn 92/92 renderbaar. Los daarvan is de echte
productie-implementatie 92/92 gedekt: 80 cases via de productie-`/thumbnail`-
route en 12 via de normale Player-runtime. Dat is implementation coverage en
geen prototype-pixelmatch of ref/new/diff. De moderne visualspec is 4/4 groen
met een 64/64 goldenmatrix die is gereviewd en vernieuwd; ook de twee liggende twee-kolomsgoldens zijn
groen. De browser assert de optionele wedstrijdvelden en vaste uitlijning;
sponsor spotlight is 4/4 groen. De Sportlink Control-preview gebruikt dezelfde
draft/displayconfig zonder fictieve providerdata en heeft 3/3 componenttests.

Control a11y is 36/36 groen met één expliciete live-skip. De volledige Player-
browserrun is 128/128 groen met twee bewuste handover/coverage-skips; de
Player-offlinesuite is 7/7 groen. Resterende modern/LG/preview/posterpariteit,
prototype-pixelreview, CI en deployment blijven `PENDING`. Fysieke LG blijft
`EXTERNAL_UNTESTED`; de hosted Auth-redirectallowlist is externe
omgevingsconfiguratie.
