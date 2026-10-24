# S290 — Actuele menu’s, oorspronkelijke Marker-headers en echte versiecontrole

De gebruiker meldt een oude Twelve/Menu Studio-layout, vraagt het oorspronkelijke
handgeschreven headerfont terug en ziet geen effect na ‘Nieuwste Studio-versie’.
De screenshots zijn de specifieke visuele opdracht; deze expliciete fontkeuze
vervangt de eerdere Rubik-keuze voor nieuwe en bewust bewerkte ontwerpen.

## Oorzaken en verandering

Menu Studio gebruikte nog de zelfstandige v17-canvas. Een expliciet opgeslagen
`onzeTrotsStyle` kiest nu het gedeelde v9-frame met de bestaande widgets erin.
Licht/donker, categorieën, productkolommen, subregels, prijsoverschrijvingen,
pagina’s, fotoverhouding, achtergrondpassing en contrastlaag blijven bedienbaar.
Een donkere categorie krijgt geen oud wit binnenvlak. Een eigen accent krijgt
een leesbare tint op het bijbehorende goedgekeurde paneel.

Het oorspronkelijke bestand `club-font-9.ttf` is Permanent Marker, bevestigd
met fontmetadata en de bestaande checksums. Sync slaat hiervoor de reeds
bestaande keuze `style.font=Brush`, `fontChanged=true` op. Alle 36 families
krijgen dezelfde headerkeuze. De contextregel blijft 14,3 in plaats van 11
logische pixels. Ongetagde historische v9-documenten blijven Rubik gebruiken.
De Marker-face wordt alleen bij een expliciete keuze gedeclareerd en als
geverifieerde rendererafhankelijkheid aangeboden; oude Player-documenten krijgen
geen onverwachte of ontbrekende fontreferentie.

De playlistknop gebruikte de bij het openen geladen bibliotheek. Nu leest hij
de exacte eigen bron opnieuw, onafhankelijk van de eerste acht ontwerpen,
en onderscheidt dezelfde versie, verwerking, ontbrekende uitvoer en een
onvoorbereid opgeslagen concept. Een read-only productiecontrole vond bij twee
menu’s documentrevisie 2 naast voorbereide revisie 1 en oudere renderfouten.
Er zijn geen productiegegevens gewijzigd.

Bij een opgeslagen gewijzigd menu kan een bevoegde gebruiker nu vanuit dezelfde
playlist bewust ‘Gewijzigd menu voorbereiden’ kiezen. De bestaande bewaakte
Menu Studio-commando’s bewaren alleen de actuele stijlkeuze, behouden de
opgeslagen prijzen en maken dezelfde versie volledig gereed. Een verloren
respons gebruikt dezelfde opdracht; afronding wordt opnieuw gelezen. Pas een
geverifieerde nieuwe snapshot komt in het playlistconcept. Naam, schermthema en
seconden per pagina blijven behouden. Publiceren naar schermen blijft afzonderlijk.
Een fout of nog lopende render vervangt nooit de huidige geldige plaatsing.

## Beveiliging, data en terugkeer

GET blijft capability- en tenantgebonden. De expliciete POST controleert
same-origin, actieve tenant, playlistschrijfrecht en dynamisch schrijfrecht;
de bestaande RLS/RPC-grenzen controleren bron, revisie en rechten opnieuw.
Geen service-role-client, catalogusprijsinvoer of browser-HTML wordt toegevoegd.

De forwardmigratie accepteert uitsluitend twee getypeerde stijlen voor
menuwidgets en delegeert alle bestaande validatie. Zowel de wrapper als de
oude helper zijn gesloten voor PUBLIC/anon/authenticated/service_role en hebben
een lege search_path. De migratie herschrijft geen rijen of bestaande releases.
Bij een appterugkeer blijft de additieve validator staan; oude ongetagde
documenten blijven werken. Een oudere renderer behoudt zijn bestaande
geverifieerde PNG-fallback voor een niet ondersteunde nieuwe presentatie.

Tien bestaande, byte-gecontroleerde afhankelijkheden zijn toegevoegd aan het
Sites-assetmanifest. Het totaal blijft 46.500.697 bytes binnen het bestaande
64 MiB-budget. Geen merkasset, dependency, lockfile of offline-state-machine is
gewijzigd. Voorbereiding en cacheverificatie blijven verplicht.

## Bewijs en vijf controles

1. Opdracht/bron: de drie screenshots zijn vergeleken met beide renderpaden,
   het originele font en de actuele databaseversies; de oude snapshotkeuze is
   gereproduceerd met bewust verouderde browserprops.
2. Data/rechten: verse geïsoleerde reset, alle 141 SQL-bestanden / 4.667
   assertions groen; database-lint zonder fouten. De echte menucommando-keten
   is daarnaast met de nieuwe stijl uitgevoerd: 29 assertions, inclusief
   prijsoverschrijving 375, ongewijzigde catalogus 250, revisie, replay en
   vreemde tenant. Zeven API-cases bewaken authenticatie, beide schrijfrechten,
   origin, tenant, conflicts, originele stijl en onzekere fouten.
3. UI: 36 × 2 oriëntaties × 2 modi controleren de echte Marker-face, headerfit
   en de grotere contextregel. De vier nieuwe menuvarianten, historische
   Rubik-weergave, tien historische pixel-/fitcases, playlist-, wizard-,
   fout-/herstel- en a11y-cases zijn uitgevoerd. De drie widgetbewerkproeven
   lezen de echte v9-achtergrond-pseudo-elementen; zij vonden en verifieerden
   het herstel van de eerder overschreven contrastlaag.
4. Render/Player: de Worker-gate heeft 35 groene tests, met echte Chromium-captures van twee menu­pagina’s
   in beide modi/oriëntaties. De volledige gewijzigde productie­documentinhoud
   is uitsluitend lokaal door de echte native capture gerenderd. 26 bestaande
   Player/offline-cases en vier nieuwe koude offline-herstartcases zijn groen.
   De oorspronkelijke font-/assetguard, CSP, fallback en LKG blijven behouden.
   De vier referentiebeelden gebruiken duidelijk gecontroleerde testinhoud.
5. Uitrol: exacte PR-commit en alle normale CI-checks moeten groen zijn vóór
   merge. Daarna staging en expliciete productiepromotie met dezelfde images,
   SHA-/healthchecks en controle van de werkelijk aangeboden assets. De actuele
   PR/workflowregistratie bevat dit laatste uitrolbewijs.

Workspace lint/typecheck/unit is groen (68 taken); de gerichte browser-specs
zijn ook afzonderlijk gelint. De browser- en servergrenzen bewijzen verschillende
delen van de keten: de browserfixtures vervangen HTTP, terwijl de echte lokale
databaseproeven de guarded commando’s uitvoeren. Geen fysieke LG-/Android-
apparaatproef wordt geclaimd; die is volgens de bestaande afspraak uitgesteld.

De enterprise-UX-checklist is toegepast op deze delta: bestaande shell/context,
zichtbare oorzaak/gevolg/herstel, keyboardfocus, mobiele bedienbaarheid,
contrast, a11y en expliciete opslag/publicatie. De globale shell wordt niet
opnieuw ontworpen.

## Beelden met gecontroleerde testinhoud

- [Liggend, licht](implementation/s290-studio-templates-refresh/landscape-light.png)
- [Liggend, donker](implementation/s290-studio-templates-refresh/landscape-dark.png)
- [Staand, licht](implementation/s290-studio-templates-refresh/portrait-light.png)
- [Staand, donker](implementation/s290-studio-templates-refresh/portrait-dark.png)
