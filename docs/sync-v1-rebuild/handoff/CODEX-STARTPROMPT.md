# Startprompt voor Codex — VeyoCast V1 Rebuild

Gebruik onderstaande opdracht samen met het volledige uitgepakte overdrachtspakket.

---

Je bouwt VeyoCast volledig opnieuw op de bestaande developmentserver. De gebruiker heeft prototype 1 / Sync definitief gekozen. Neem de huidige Sites-afbeeldingen, UI en UX exact over. Behoud de werkende achterliggende VeyoCast-logica, bestaande Android-apps en deploycontracten. Lever een volledige werkende implementatie op, niet alleen een plan of frontenddemo.

## Lees eerst

Lees `START-HIER.md`, `docs/OPDRACHTCANON.md`, `docs/V1-REBUILD-CANON.md`, `docs/VISUELE-OVERNAME.md`, `docs/LOGICA-PARITEITSMATRIX.md`, `docs/ONTWIKKELING-EN-OPRUIMING.md`, `docs/DEPLOY-EN-GITHUB-BEHOUD.md`, `docs/ANDROID-UPDATE-CONTRACT.md` en `docs/IMPLEMENTATIE-EN-ACCEPTATIE.md`. Gebruik de originele V1-repoanalyse en de functionele Sync-canon als detailbron. De oude prompts in `reference/` of in de oude geneste ZIP zijn historische bronnen; de instructies uit dit nieuwe pakket hebben voorrang.

Controleer `python3 scripts/verify-package.py`. De vaste visuele referenties zijn:

- Sync-bron `reference/sites-sync/`, commit `8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a`.
- Publieke publicatie `reference/marketing-publication/`, commit `69461726f0d9e17b535dfaa0652cc18ed75c1fdd`.
- GitHub `veyocast/platform`, onderzochte main `20729be35d38dc8eb67b836160632ac7c3ea5153`; haal de actuele toestand op vóór wijzigingen en respecteer werk dat daarna is toegevoegd.

## 1. Begin op de developmentserver

Stel binnen de bestaande geautoriseerde omgeving de echte host, gebruiker, source root, Git-remote, actieve branch/commit, worktrees, poorten, services, containers, mounts, volumes en configuratielocaties vast. Lees toepasselijke repository-instructies. Verzin geen hostname of pad. Scheid development, staging en production op basis van geverifieerde rollen; een naam alleen is onvoldoende.

Maak een geïsoleerde rebuildwerkbranch/worktree in de developmentomgeving wanneer nodig. Bewaar niet-gecommitteerd werk van anderen. Inventariseer alle branches met hun actuele heads en unieke commits. Maak een kort uitvoeringsplan en vul `execution/` in met de echte waarden. Meld concrete ontbrekende toegang gericht als die de uitvoering blokkeert; bouw ondertussen door aan onafhankelijk geautoriseerd werk. Een ontbrekende waarde is geen aanleiding om een fictieve omgeving te maken.

## 2. Leg behoud en cleanup vast

De gebruiker heeft expliciet toestemming gegeven om oude VeyoCast-/Castivo-mappen en -bestanden op development te verwijderen en onnodige bestanden in GitHub-branches op te ruimen. Voer dit na inventarisatie en afhankelijkheidscontrole zelfstandig uit; vraag niet opnieuw algemene toestemming voor dezelfde scope.

Maak in de doelrepo `archive/` met canonbesluiten, relevante protocol-/schemamapping, incidentkennis, branch-headmanifest en verwijdermanifest. Bewaar herstelbare oude bron via Git-history en waar nodig een gerichte beschermde snapshot. Plaats geen volledige afvalkopie in `archive/`.

Verwijder alleen aantoonbaar overbodige source/buildpaden, met resolved absoluut pad en vastgelegde opvolger of reden. Behoud operationele data, uploads, databases, migratiehistorie, configuratie, signing, runners, TLS/DNS, actieve releaseverwijzingen en benodigde rollback-artifacts. Ruim branchbestanden op met normale commits en normale integratie, zonder force-push, geschiedenisreset of branchdelete. Inventariseer iedere relevante branch; claim niet dat 178 branches opgeschoond zijn na alleen een main-commit.

## 3. Neem Sites exact over

Gebruik componenten, CSS, assets, fonts, teksten en interacties uit `reference/sites-sync/`. De Vite-basis is een referentie, geen opdracht om het bestaande Next.js/pnpm/Supabase-systeem te vervangen door Vite. Port waar nodig zonder visuele verandering. Houd alleen Sync als werkplekontwerp; beide schermthemafamilies FieldFlow en OnzeTrots TV blijven wel behouden.

Bevries de visuele baseline, leg route-/state-/viewportcaptures vast en vergelijk de rebuild met dezelfde data en toestand. Wijzig geen kleur, spacing, typografie, kaartvorm, navigatie, responsive indeling of statusbetekenis op eigen smaak. Hergebruik de originele hero op marketing én player-opstart, met dezelfde verhoudingen. Gebruik het meegeleverde Android-iconpakket met de bestaande resourceverwijzingen; geen opnieuw ontworpen logo.

Vervang alleen de demonstratielaag door echte serverservices: localStorage, vaste login/MFA/pairingcodes, demo-tenantwissels en gesimuleerde succesmeldingen zijn geen productie-implementatie. Behoud de UI voor loading/empty/error/denied/stale/success en voer haar gedrag daadwerkelijk uit. Interne review/demohulpmiddelen zijn geen publieke klantfunctionaliteit of autorisatiegrens.

Demo-, omgeving- en statusclaims zijn de gerichte uitzondering op letterlijke tekstovername: vervang uitsluitend aantoonbaar onjuist geworden prototypecopy (zoals “geen live dienst”, “voorbeeldaanvraag” of “alleen lokaal opgeslagen”) door feitelijk correcte productiecopy zodra de echte dienst werkt. Behoud layout, typografie, informatierangorde en interactie; dit staat geen algemene herschrijving of redesign toe.

## 4. Bewaar de volledige werkende logica

Map ieder domein op bestaande code/services vóór vervanging en registreer behouden, overgenomen, gerepareerd, gemigreerd en nog onbewezen gedrag. Houd tenant/device/media/playlist/release/provider/payment-ID's stabiel. Geen lege databaseherstart.

Bouw eerst één echte content → Studio → playlistplaatsing → preflight → immutable publicatie → download → verificatie → veilige activatie → bevestiging-keten. Breid vervolgens uit tot alle V1-domeinen: planning/zones/bedrijfstijden, bronnen, thema's, producten/prijspublicatie, sponsors, Engage, team/rollen, support, platformbeheer, billingflags, marketingaanvragen en native beheer.

Respecteer expliciet: heartbeat is geen afspeelbewijs; desired/downloaded/verified/active/confirmed blijven apart; foutieve kandidaat verdringt nooit last-known-good; force-sync/herstart wist geen pairing/cache; brondata verversen maakt geen onnodige release; thema-/prijs-/ontwerpwijzigingen veranderen bevroren publicaties niet ongemerkt; oudere benodigde releaseformaten blijven decodeerbaar; LG houdt een aparte compatibiliteitslaag en bestaande media-/timerherstelmaatregelen.

Laat Sportlinkdatasetrechten en daadwerkelijke providerpaden leidend zijn, inclusief alle 17 families met herkenbare handmatige fallback waar nodig. Twelve blijft CSV/XLSX-import. YouTube blijft online met lokale fallback. Beperk retries, telemetry, polls, DB-writes en retention; maak geen nieuw database-overbelastingsprobleem.

## 5. Behoud deployment en maak Android-updates

Behoud de bestaande workflows, GitHub-environments, secrets en variabelen, inclusief aanvullende settings die niet letterlijk in code worden gebruikt. Leg vóór/na alleen namen, scopes en contracten vast, geen geheime waarden. Laat workflowtriggers, runnerlabels, promotion/rollback, signing en releasegates intact. Pas slechts aantoonbaar nodige padverwijzingen aan wanneer de bronstructuur wijzigt.

Gebruik de bestaande webflow: main-push → staging; production alleen de bestaande expliciete handmatige promotie van dezelfde release. Een push naar main kan dus staging uitrollen: controleer daarvoor normale integratiegates en lopende deployments. Zet billing-/retentionflags niet ongemerkt aan.

Android Player standaard en TV delen de productie-applicationId `nl.veyocast.player` en gebruiken verschillende versionCode-reeksen. Control gebruikt `nl.veyocast.control`. Verifieer de werkelijk geïnstalleerde distributie, de hoogste eerder uitgegeven code en signing/Play-identiteit. Brondefaults zijn niet het bewijs van de laatst geïnstalleerde versie. Kies een geldig hoger updateversionCode binnen het bestaande releasebeleid, behoud kanaal/installatiecompatibiliteit en test update over bestaande installatie. Geen uninstall, clear-data of ander package als oplossing. Werk icon, native launch/pairing/splash en volledige playerhero zorgvuldig bij. Behoud Control-sessie, biometrische app-lock, voorkeuren en API-contracten. Volg de concrete Android-bronpaden in het contract.

## 6. Maak de publieke website werkelijk af

Neem de negen bestaande routes, teksten, beelden, HTML-structuur, canonical-, OG-, sitemap- en robotsopzet over. Gebruik het bedoelde productiedomein volgens de bestaande omgevingsconfiguratie; Sites-URL's zijn de referentie, geen blijvende productiecanonical. Houd app/tenantdata/overdracht buiten de publieke bundel. Maak aanvraag → serveropslag → beheerinbox → mailstatus/retry echt, inclusief setup-intent en idempotentie. Een succesmelding volgt pas na werkelijke ontvangst. Valideer nested routes, 404's, indexering, mobiele bediening en prestaties.

## 7. Verifieer en lever op

Gebruik alle 148 scenario-ID's en de aanvullende productiepariteitsmatrix. Voer echte serverrechten/cross-tenant-/concurrency-/idempotentie-/migratie-/offline-/hardwarechecks uit op het passende bewijsniveau. Leg de visuele vergelijking vast voor desktop/mobiel, spelers in 16:9 en 9:16 en beide contentthema's. Test Android-upgrade, koude offlineboot, afgebroken download, corrupte kandidaat, opslagdruk, bronuitval en minimaal 24 uur playback op fysieke relevante apparaten. Behoud bestaande LG-compatibiliteit; een browserpreview bewijst die niet.

Gebruik de bestaande tests en releasegates. Test gericht op regressierisico, geen testmassa die alleen nieuwe implementatiedetails herhaalt. Voer stagingdeploy uit via de bestaande flow en controleer versie, health en echte gebruikersketens. Productie-uitrol of nieuwe incasso-/restrictieactivering vraagt een afzonderlijke geldige opdracht; rond eerst alle geautoriseerde ontwikkeling, cleanup en stagingverificatie af.

Lever op: commits/branch/SHA, werkende development- en staging-URL's, route/API/datamapping, before/after-cleanupmanifest, archiefindex, gelijk gebleven environment-/secret-/variablecontracten, visueel bewijs, testresultaat per scenario, Android-artifacts met package/version/signingmetadata zonder geheime waarden, icon-/splashcontrole, migratie- en rollbackprocedure, release notes en concrete open gates. Zeg uitsluitend 'V1 compleet' als alle verplichte criteria zijn gehaald of de gebruiker een concreet gedocumenteerde afwijking heeft geaccepteerd. Een blokkade op één externe test is geen reden om de rest van het geautoriseerde werk te stoppen.

Werk zelfstandig door, houd de gebruiker op de hoogte van bevindingen en beslissingen, en lever het resultaat volledig af.
