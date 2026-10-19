# S240 — Publieke opstelling en demoaanvraag

`/#opstelling` verwijst nog steeds naar `/opstelling#opstelling`. De doelroute
toont nu één gekozen Sync-header en footer met de bestaande echte
`VenueSetupBuilder`, in plaats van een volledige oude homepage binnen een
tweede header en footer. De route bevat één h1: “Bouw je VeyoCast-opstelling.”

## Bron en aanpassing

De header/footer volgen de bestaande `_sync/Marketing.tsx`-markup, navigatie,
`Brand`/`Icon`-componenten en locked SVG-assets. Die immutable component
exporteert geen afzonderlijke chrome. `setup-workspace.tsx` hergebruikt daarom
de publieke Source-classes voor alleen deze compatibiliteitsroute. Er wordt
geen extra homepage gerenderd of met CSS verborgen. Het responsieve menu opent
met focus op Platform; Escape sluit eerst een open submenu, daarna het menu en
geeft de focus terug. De links verwijzen naar bestaande publieke routes.

`setup-workspace.module.css` koppelt de bestaande configuratorpresentatie aan
Source-tokens, Manrope, rustige oppervlakken en leesbare tekst. De echte
locatiekeuze, zones, aantallen, doelen, bronnen en samenvatting blijven dezelfde
component. Op mobiel blijft de bestaande sequentiële flow Locatie → Schermen →
Bronnen bestaan. Interactieve elementen hebben een doelgebied van minimaal
44 × 44 px. De diagram- en zonekolom behouden op desktop minimaal 32 px afstand.

`accessibility.css` wordt na de immutable runtime geladen en richt zich alleen
op de echte demoaanvraag: labels, velden, uitleg, toestemming, privacy en
herstelinformatie zijn minimaal 14 px. Formuliervelden en acties hebben minimaal
44 px hoogte. Het 24 px toestemmingsvakje heeft een aanklikbaar label van
minimaal 44 px; privacylinks hebben eveneens een 44 px hoog doelgebied.
Miniaturen, productvoorbeelden en previewcaptions krijgen geen tekstvloer.

## Ongewijzigde contracten

De enige wijzigingen in `venue-setup-builder.tsx` zijn de hoofdtitel h2 → h1 en
de samenvattingskop h3 → h2. Terugnormalisatie van die tags levert byte-identiek
de oorspronkelijke component op. Alle state,
keuzes, prijsberekeningen, zone-ID's, disabled condities, de `setup`-FormData en
de native `continueWithSetup`-actie blijven bestaan.

De Source-runtime, `Marketing.tsx`, `inquiry-form.tsx`, setup-intentimplementatie
en beide serveracties zijn byte-identiek aan de oorspronkelijke hashes.
Er zijn geen nieuwe intent-, HMAC-, nonce-, autorisatie-, aanvraag- of
providerimplementaties. De bestaande aanvraagactie blijft een ontvangst alleen
bevestigen na de bestaande serverbevestiging; zonder configuratie blijft die
gesloten. Deze wijziging configureert geen mail, opslag, account of provider.

## Bewijs en grenzen

De oorspronkelijke statische fout is vóór edits vastgelegd in
`/tmp/veyocast-s240-static-first-red.log`; het voor-hashmanifest staat in
`/tmp/veyocast-s240-before.json`. Dit is een statisch bronbewijs, geen
oorspronkelijke browsermeting. De oorspronkelijke marketing-home-spec is
bewaard in `/tmp/veyocast-s240-marketing-home-original.spec.ts`.

De tweede bestaande marketing-home-case verwachtte de verwijderde oude
homepagehero. Met expliciete extra ownership is alleen die case gemapt naar
één echte Source-chrome, één h1, twee werkelijk gescheiden configuratorkolommen,
positieve kolombreedtes, dezelfde 32 px afstand, 44 px controls en geen overflow.
De drie overige bestaande cases zijn byte-identiek; hun gezamenlijke SHA-256 is
`f8314de2d78ef8dc33c1b945f92d0a0f91c6051d8c38d754cb48502d7e9922fc`.
Er zijn geen skips, deadlinewijzigingen of tolerantieruimingen toegevoegd.

De eerste browsercohorts zijn afzonderlijk bewaard: bestaande cases 3 PASS /
1 FAIL in `/tmp/veyocast-s240-existing-first.log`; nieuwe cases 2 PASS / 4 FAIL
in `/tmp/veyocast-s240-new-first.log`, inclusief oorspronkelijke traces onder
de gelijknamige `/dev/shm/`-directories. De werkelijke fouten waren een diagram
dat door aspect-ratio/min-height buiten zijn gridkolom groeide, een algemene
header-ankerregel die de mobiele login-hide overruled en daardoor de menuknop
buiten beeld drukte, en h1 → h3-headingvolgorde. Die zijn in de scoped breedte,
selectorspecificiteit en kopsemantiek gecorrigeerd. Twee nieuwe intentcases
bereikten de echte ondertekende demohandoff maar gebruikten een onjuiste
exacte labelselector voor een bestaand genest selectlabel; die selecteren nu
de bestaande name-attributen en eisen dezelfde exacte waarden Horeca / 1–3.
Geen aXe-regel, waardeassertie, afstand of doelgebied is afgezwakt.

De zes nieuwe cases gebruiken de werkelijke marketingroutes en product-CSS op
390 en 1440 px in `tests/e2e/marketing-sync-setup-compatibility.spec.ts`.
Ze dekken de oude hashhandoff, enkele landmarks/locked assets,
menu en Escape/focus, echte locatie- en bronkeuzes, disabled opties, complete
setup-payload, prijs, bestaande ondertekende serverhandoff en meegedragen
demovelden. Ongeldige intents tonen de echte herstelmelding; native
formuliercontrole houdt invoer vast en verstuurt geen aanvraag. Leesbaarheid,
44 px doelgebieden, controlbounds/documentoverflow en aXe worden gemeten.
Er wordt geen servercontract in een fixture opnieuw geïmplementeerd.

Scoped ESLint en de volledige marketing-TypeScriptcontrole zijn groen; beide
specs slagen ook voor een strikte losse TypeScriptcontrole. De bestaande
marketingunits slagen: 20 tests in 4 bestanden, maximaal twee workers,
inclusief intentvalidatie/handtekening/prijs en de gesloten aanvraagactie.
Playwright registreert precies 10 cases: vier bestaande en zes nieuwe.

De geïsoleerde lokale productionbuild is groen met één buildworker en een
2048 MB Node-heap. De tijdelijke signingsecret staat alleen in een eigen
0600-bestand/geheugen; de omgeving bevat geen aanvraagproviderconfiguratie.
De RAM-output en metadata staan buiten de bronbestanden. De eerste tijdelijke
helper startte door `node -e`-overerving herhaaldelijke buildworkers en is met
alleen de eigen procesboom gestopt. De tweede build compileerde, maar kon bij
page-data geen React vanaf de fysieke RAM-output vinden. Beide logs/outputs
zijn bewaard. De derde build gebruikt een echt helperbestand en bestaande
node_modules via NODE_PATH en slaagt; alle zestien bewaakte source/config-hashes
bleven gelijk. Dit zijn lokale runtimevoorbereidingsfouten, geen productfouten.

`http://127.0.0.1:3400/api/health`, `/opstelling` en
`/demo?setup=invalid.intent` geven 200. De serverrender bewijst één header,
footer en h1 op de opstelling en de bestaande ongeldige-intentmelding op demo.
Dit is HTTP-readiness, geen browser- of interactiebewijs.

De correctieve gebouwde versie slaagt voor exact dezelfde cohorts: bestaande
4/4 PASS in 3,8 s en nieuwe 6/6 PASS in 13,4 s, elk één worker, nul retries en
nul skips. Logs staan in `/tmp/veyocast-s240-existing-corrective.log` en
`/tmp/veyocast-s240-new-corrective.log`. De bijbehorende `/dev/shm/`-directories
bevatten vier onbewerkte productcaptures: opstelling en demo op 390 en 1440 px.
Die zijn visueel bekeken: één rustige Source-werkruimte, leesbare echte
formulierinhoud, bereikbare mobiele menuknop en gescheiden desktopkolommen.
De democaptures tonen de echte ongeldige-intent/native-validatietoestand.
Er is geen beeldvergelijking met een verzonnen referentie gebruikt.
Beide runners zijn exit 0; de browserqueue is vrijgegeven met nul actieve
Chromiumprocessen. Het lokale eindbewijs staat in
`/tmp/veyocast-s240-final-proof.json`.

De volledige gecombineerde foundationgates slagen na de normale integratie:
lint, typecheck en test ieder 30/30 taken, CPU6,7 en concurrency1. Respectievelijk
29, 29 en 28 taken gebruiken een geldige Turbocachehit; de marketinggates zijn
opnieuw uitgevoerd, inclusief dezelfde twintig units. Zware gates startten
boven de afgesproken 3500 MiB MemAvailable-grens. Logs staan in
`/tmp/veyocast-s240-foundation-lint-corrective.log`,
`/tmp/veyocast-s240-foundation-typecheck.log` en
`/tmp/veyocast-s240-foundation-test.log`. Exacte hosted CI volgt. Root beheert de verplichte
PR-artifactattachment en de verdere integratie. Geen PR-merge of deploy door de
S240-writer.
Deze wijziging levert geen volledige Source-pariteit, V1-acceptatie,
pixelacceptatie, provideraflevering of staging-/productiebewijs op.

## Releasevoorbereiding

Productcommit `a0ca1a40` is normaal samengevoegd met de door root aangewezen
S234-basis `abbff5fc` in mergecommit `a782e631`. Alle 281 geërfde ledgerregels
zijn byte-identiek behouden; de eigen S240-regel is toegevoegd. De geërfde
wizardhelper had één extra lege EOF-regel. Alleen die ene newline is volgens
de expliciete uitzondering verwijderd; fixture-inhoud en alle cases bleven
gelijk. Voor/na-hashes staan in
`/tmp/veyocast-s240-inherited-helper-eof-proof.json`.

De eerste volledige marketinglint vanuit de app-directory controleerde wel
de Next-routeankers en faalde op de Source-native publieke `<a>`-elementen;
de eerdere scoped repo-rootlint kende die routes niet. De eigen chrome heeft
nu dezelfde gerichte `no-html-link-for-pages`-documentatiepragma als de
immutable Source. Alleen die comment is na het gebouwde browserbewijs
toegevoegd; weglaten ervan levert exact de geteste bronbytes op. Er is geen
markup-, routing- of runtimewijziging en daarom geen extra browser/buildrun.
De oorspronkelijke 29/30-lintfout staat onveranderd in
`/tmp/veyocast-s240-foundation-lint.log`.

De eerste draft-PR-kandidaat `380b6996` registreerde de zes nieuwe cases alleen
lokaal: `tests/marketing/` valt buiten de bestaande hosted gate-discovery.
Volgens expliciete aanvullende ownership is de volledige spec daarom
byte-identiek verplaatst naar de door de bestaande marketingbucket herkende
`tests/e2e/marketing-sync-setup-compatibility.spec.ts`. Imports, alle zes
casebodies, assertions en deadlines zijn gelijk. Runnerbucket en registratie
van exact zes cases zijn opnieuw gecontroleerd, evenals strikte spec-TSC en
gerichte lint. Hiervoor zijn geen browser, runnercode of productwijziging
nodig; de eerste queued hosted runs blijven behouden.
