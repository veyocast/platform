# Bouwopdracht voor Codex — VeyoCast V1 Sync

Gebruik deze opdracht samen met de complete broncode, assets en documenten uit dit pakket. De opdracht is bedoeld voor de bestaande VeyoCast-repository, met staging als eerste opleveromgeving.

---

Je bouwt de VeyoCast V1-rebuild. De gebruiker heeft prototype 1 **Sync** gekozen. De andere vier ontwerprichtingen vervallen. Het meegeleverde prototype is het concrete UI/UX- en gedragsvoorbeeld; neem de interface, schaal, typografie, componenten, previews, feedback, formulieren en workflows zorgvuldig over.

Lees eerst `docs/README-OVERDRACHT.md`, `docs/V1-SYNC-CANON.md`, `docs/ACCEPTATIE.md`, `docs/SEO-IMPLEMENTATIE.md` en het actuele `docs/TESTRESULTATEN.md` in de prototypebron. Lees daarna de bestaande repository-instructies, architectuur, migraties, playercontracten en deploymentflows. Behandel demo-statussen nooit als bewijs van werkende productie-integraties.

## Het resultaat

Lever één volledige Sync-werkplek en een aparte publieke Nederlandse marketingwebsite. De V1 moet alle functies uit `src/coverage.json` en de canon behouden, inclusief de minder prominente beheeronderdelen. Iedere zichtbare actie krijgt echte gedrag-/API-afhandeling of een nauwkeurig gelabelde, door de eigenaar goedgekeurde featuregate. Maak geen decoratieve knoppen die alleen een succesmelding geven.

De werkplek bevat:

- Overzicht met aandachtspunten, bereikbaarheid, synchronisatie, actieve/gewenste publicatie en planning.
- Eén contentbibliotheek, lokale/echte mediaupload, verwerking, impactinspectie, archiveren en herstellen.
- Studio met eigen content, reeksen, alle 17 sportfamilies, team-/club-/poulevarianten, menu, RSS, LED, YouTube, sponsors en Engage.
- FieldFlow en OnzeTrots TV als geversioneerde contentthema’s in 16:9 en 9:16; theme registry en consistente voorrang van overrides.
- Playlists met volgorde, secties, duur, plaatsinginstellingen, crop/fit, trim, audio, thema’s, preview, preflight, publicatie en immutable historie.
- Planning met herhaling, tijdzone, uitzonderingen, targets, overlap, overrides en terugkeer naar defaults.
- Schermbeheer met pairing, groepen, locaties/plattegrond, bedrijfstijden, composities/zones, diagnostiek en bevestigde herstelopdrachten.
- De complete playerreis met dezelfde Screen Sync-hero als op de publieke site, subtiele motion, alle wacht-/fout-/offline-/billingtoestanden en veilige activatie.
- Bronnenbeheer met bewezen datasetbeschikbaarheid; Twelve via gecontroleerde exportimport; productcatalogus met bewuste prijsupdates.
- Sponsors, campagnegoedkeuring en technische afspeelregistratie; Engage met QR-stemmen en serverafgedwongen lifecycle/resultaatbeleid.
- Team-/platformrollen, capabilities, uitnodigingen, audit, tickets, berichten/bijlagen en afdelingsrouting.
- Platformbeheer voor organisaties, limieten, flags, centrale templateversies, health en reconciliation.
- Billing als complete maar afzonderlijk vrij te geven keten, met geverifieerde providerstatus en losse flags voor collection/enforcement/warning/restriction.
- Mobiele beheerervaring met dezelfde data en rechten, camera/uploadflow, notificatievoorkeuren en echte OS-beveiliging waar native aanwezig.
- Publieke marketingpagina’s, relevante SEO-content, concrete aanvragen en de doorstap naar de werkplek.

## Eerst vaststellen, dan wijzigen

Maak in de repository een overzicht van bestaande modules en contracten. Koppel iedere canonroute en ieder scenario aan bestaande code, benodigde wijziging en bewijs. Leg minimaal vast:

1. Next.js-/monorepostructuur, runtime-/packageversies en bestaande gemeenschappelijke UI-/domeinpakketten.
2. Tenantauthenticatie, platformauthenticatie, capabilities, MFA, devicecredentials en data-isolatie.
3. Mediaopslag en verwerkingsjobs, bronadapters, dynamische snapshots en bronrechten.
4. Release-/manifestmodel, scheduler, cache-/activationcontract, command-/telemetry-/ackprotocol.
5. Android package-ID, signing, updatekanaal, lokale identiteit en recovery; LG-model/firmwareprofielen en ES5-adapter/build.
6. Bestaande billing-/provider-/webhook-/reconciliationflows en de huidige status van rolloutflags.
7. Staging-/productieconfiguratie, bestaande migraties, releaseprocedure en terugrolmogelijkheden.

Neem werkende services over. De prototypebron gebruikt React/Vite/Motion, maar een frameworkmigratie is geen doel. Port het ontwerp naar de bestaande Next.js-architectuur waar mogelijk. Gebruik de huidige bruikbare router, auth, worker- en devicearchitectuur. Voeg geen tweede parallel systeem voor dezelfde data toe.

## Veranderingsvolgorde

Werk zelfstandig door aan een concrete stagingoplevering; registreer voortgang per onderstaande stap.

### 1. Fundament en visuele shell

Port tokens, fonts, SVG’s, hero en gedeelde componenten. Bouw de vaste navigatie en responsieve Sync-layout. Map demo-objecten naar typed domeinmodellen/adapters. Regel echte sessie-, tenant- en platformcontext. Laat relevante werkelijke laad/leeg/fout/rechtenstatussen zien.

### 2. Content naar immutable publicatie

Maak bibliotheek/Studio/playlist een doorgaande flow. Upload init/complete/retry mag geen dubbele media opleveren. Bewaar revisions en behandel conflicten. Maak plaatsingen onafhankelijk van bronontwerpen. Bouw alle families en thema’s met dezelfde renderercontracten. Preflight en publicatie moeten content, prijs- en themeversies vastleggen; mutatie van een concept verandert oude releases niet.

### 3. Planning en schermbesturing

Koppel schedules en composities aan echte targets. Bouw geldige pairing en tijdelijke codes. Scheid online, synchronisatie en zichtbare activatie. Laat de device het nieuwe manifest eerst volledig downloaden/verifiëren en daarna veilig activeren. Bewaar last-good cache en herstel zonder pairing te wissen. Toon iedere command-/publicatiestap op basis van echte acknowledgements.

### 4. Bronnen, beheer en aanvullende V1

Werk de bronselectie, 17 families en datasetrechten uit. Voeg Twelve-import, expliciete prijsupdates, RSS-rotatie/QR en YouTube-fallback toe. Maak LED-events idempotent en laat onderbroken playback correct hervatten. Koppel sponsors, Engage, team/support, platform en mobiele beheerervaring. Billing is onderdeel van de bouw, maar onafhankelijke flags blijven uit tot bewijs beschikbaar is.

### 5. Marketing en aanvraagketen

Gebruik de publieke routekaart uit `SEO-IMPLEMENTATIE.md`. Serverrender/prerender betekenisvolle content per URL. Bouw echte canonical/metadata/social preview/robots/sitemap en een 404. De publieke bundle bevat geen tenantfixtures, interne administratie of devicegegevens. Gebruik de bestaande hero in responsieve kwaliteit. Een aanvraag wordt server-side gevalideerd en duurzaam opgeslagen, krijgt idempotente opvolging en een betekenisvolle fout-/successtate. Bewaar de configuratorselectie als setup-intent. Gebruik actuele, werkelijk ondersteunde productclaims en account-/contactgegevens.

### 6. Acceptatie en staging

Voer de scenario’s en risicojourneys uit `ACCEPTATIE.md` uit. Maak screenshots op de afgesproken breedtes en vergelijk met de bronreferentie. Test API-autorisatie en cross-tenanttoegang ook buiten de UI. Bewijs fysieke player-, netwerk-/cache-, bronprovider- en betaalketens afzonderlijk. Leg uitgevoerde tests, resultaten, commit/build-ID, resterende gates en configuratie vast. Deploy naar staging via de bestaande flow en verifieer de gedeployde versie.

## Niet te verliezen eigenschappen

- Productiedata en bestaande tenant-, device-, media-, playlist- en release-ID’s blijven behouden. Geen lege herstart of destructieve reset om nieuwe modellen passend te maken.
- Android signing/package-identiteit en bestaande pairing/cache/recoverycontracten blijven intact. Nieuwe runtimeversies mogen bestaande installaties niet onbedoeld als nieuw device registreren.
- De LG-runtime behoudt een passende aparte compatibiliteitslaag; moderne beheercode wordt niet ongecontroleerd in de legacy bundle getrokken.
- Een scherm dat recent contact had is nog niet aantoonbaar correct aan het afspelen. `desired`, `downloaded/verified` en `active/confirmed` blijven aparte statussen.
- Een corrupte of onvolledige kandidaat verdringt nooit een geldige actieve release. Normale sync/herstart wist geen identity/cache.
- Bronverversing veroorzaakt geen onnodige playlistrelease. Een prijs- of themawijziging verandert geen actieve bevroren publicatie zonder expliciete update.
- Fout, leeg, ontbrekend recht, stale data en onbekende status hebben een eigen betekenis; verberg deze niet met gesimuleerde succesdata.
- Geen live Twelve-API, universele Sportlinkdataset of universele hardwarefunctie claimen zonder bewijs. Manual fallback is herkenbaar.
- Publieke stemmen en serverrechten worden server-side gevalideerd. localStorage is geen autorisatie of duurzame administratie.
- Financiële status wordt niet afgeleid uit een browserredirect. Providerreadback, webhookvalidatie en reconciliation blijven leidend.

## Wat je oplevert

1. Werkende stagingimplementatie met versie-/commitverwijzing.
2. Route-/capability-/API-mapping en datamigratieoverzicht.
3. Controleerbare screenshots van publieke site, hoofdroutes, Studio, playlist, schermdetail, mobiel en player in beide oriëntaties.
4. Testverslag per bewijsniveau, inclusief negatieve tests en expliciet nog onbewezen providers/hardware.
5. Release notes, configuratie-/secretlijst zonder geheime waarden en gecontroleerd rollbackplan.
6. Bekende beperkingen/gates met concrete vervolgstap. Markeer de V1 pas compleet wanneer de acceptatiecriteria gehaald zijn of de eigenaar een afwijking expliciet heeft geaccepteerd.

De opdracht autoriseert het bouwen en opleveren op staging. Productie-uitrol, onomkeerbare dataverwijdering of het daadwerkelijk activeren van nieuwe incasso-/restrictieflows volgt alleen op een afzonderlijke geldige opdracht. Presenteer dan de concrete geteste release en resterende risico’s; vraag niet vooraf om routinebeslissingen die binnen deze opdracht zelfstandig kunnen worden opgelost.
