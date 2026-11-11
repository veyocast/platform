# S312 — Publicatie met een bevroren providerlogo

## Vastgestelde fout

Na de succesvolle S311-uitrol meldt de gebruiker `dynamic_complete_failed`.
De echte productie-Worker heeft dezelfde taak driemaal geprobeerd. PostgreSQL
wees `complete_menu_dom_job_v2` af met SQLSTATE23514 vanuit
`private.assert_menu_dom_presentation_v2`, niet tijdens rendering of upload.

De complete descriptor staat daadwerkelijk in Storage. Zijn logo-UUID en
SHA256 zijn exact de immutable `provider_asset_versions`-versie die al in
`snapshot_data_json.brand.logoMediaAssetId` is bevroren. De renderer gebruikt
terecht die broncache. De Menu-validator eiste echter uitsluitend een record
in tenant `media_assets`/`media_variants`. De gewone Source-validator ondersteunde
providerbeelden al. Hierdoor faalde juist een echt clublogo; de eerdere
Menu-databasefixture zonder providerlogo bewaakte deze productieroute niet.

## Gerichte oplossing en grenzen

Een forwardmigration vervangt uitsluitend de bestaande private Menu-validator.
De bestaande tenant-Media-route blijft behouden. Daarnaast mag uitsluitend de
exact bevroren brandlogo-ID een immutable providerbeeld met exact dezelfde
checksum gebruiken. Een ander providerbeeld is geen nieuwe tenantautorisatie.
Documentvalidatie, renderer/protocol, afmetingen/duur, getypeerde referenties,
workerlease, completiontransactie, ready output en finalisatie blijven intact.
Dezelfde validator wordt door DOM- en bestaande binaire Menu-completion gebruikt.
Geen tabel-/policy-/grantverruiming of kopiëren van providerbeelden naar Media.

De gerichte regressies gebruiken de bestaande echte Menu-wizardfixture en
testen providerlogo/checksum/bevroren autoriteit, tenant A versus B, bestaande
eigen Media, echte service-role-completion, ready output, actieve versie en
idempotentie zonder nieuwe slide of versie. De SQL-outputfixture bewijst de
databaseketen; zij is geen echte Storage-upload of fysieke TV-test.

De gedeelde lokale Supabase wordt niet gereset. Lokale migratie-/SQL-proeven
draaien uitsluitend transactioneel met rollback. Volledige verse DB/RLS,
normale CI, staging/productie en eventueel expliciet bevestigde klant-retry
moeten daadwerkelijk volgen. Resultaten en exacte SHA/runlinks worden in de PR
vastgelegd, niet vooruitlopend als geslaagd aangemerkt.

## Uitgevoerde lokale controles

De definitieve regressie tegen de oude validator geeft zes verwachte fouten:
providerlogo, echte completion/herhaling, afgeronde taak, gepubliceerde versie
en consistente actieve output. Met de forwardmigration slagen alle 27 assertions.
De testfixture volgt de bestaande afgeleide output-ID en Menu-documentrevision;
geen productieguard is versoepeld om de fixture passend te maken.

Zeven transactionele suites slagen met 196 assertions: Menu-DOM27,
Source-DOM22, identiteit/observatie35, slideversies46, MenuStudio44,
widgets14 en provider-cache/RLS8. Alle tijdelijk ontbrekende forwardmigrations
zijn binnen dezelfde rollbacktransacties meegenomen. Een eerste bredere lokale
harnasrun miste het pgTAP-search-path voor een bestaande suite; alleen het
harnas is gecorrigeerd, niet de bestaande test of databaseconfiguratie.
Daarnaast slagen 25 bestaande databaseclient-/queryhelperproeven en
`git diff --check`. Dit vervangt niet de verplichte verse hosted reset/RLS-suite
of een echte nieuwe klantpublicatie.

## Veilige herstelroute

Een terminale failed snapshot blijft onveranderlijke historie. De bestaande
retryactie maakt een nieuwe renderpoging onder dezelfde slideversie. Publiceer
niet alle concepten en herschrijf geen immutable snapshots/releases. Een
gerichte klant-retry vereist een ondubbelzinnig geïdentificeerde betrokken slide;
zonder dat bewijs wordt uitsluitend de structurele fout uitgerold en de
gebruiker naar de bestaande retryactie verwezen.

## Bevestigde vervolgscope en Ubuntu-storing

Tijdens de begrensde klant-herstelproef is een tweede echte oorzaak vastgesteld:
de gedeelde refreshroute zoekt de canonical inhoudshash en geeft bij ongewijzigde
inhoud dezelfde terminale failed snapshot terug. De bestaande retrytest gebruikte
`repeat('e',64)` en miste precies deze route. De test met de werkelijke hash faalt
op de queued-assertion en probeert daarna terecht geen immutable fout te wijzigen.

Dezelfde forwardmigration serializeert refresh per slide en volgt een
deterministische hashketen van canonical inhoud plus de voorgaande failed
snapshot-ID. Alleen een expliciete refresh/publicatie maakt een volgende poging;
een herhaalde klik vindt de al queued/rendering/ready poging. Eerdere fouten,
versies, selectie en inhoud blijven behouden. De bestaande actor-/tenantguards,
frozen snapshots en echte fenced completion blijven verplicht. Audit vermeldt
de oorspronkelijke failed snapshot. De uitgebreidere versieproef bewaakt twee
opeenvolgende terminale fouten, beide herhalingen en de vorige werkende versie.
Na deze bronwijziging moeten alle hostedgates opnieuw op de nieuwe SHA slagen.

De definitieve zeven rollback-suites slagen nu met 207 assertions, waarvan 57
voor versiebeheer/retry en ongewijzigd 27 voor Menu-DOM. Zonder de retryfix faalt
de echte-hash-queued-tegenproef; met de fix blijven twee opeenvolgende retries
en hun herhalingen correct. De afzonderlijke operationele fixture slaagt met
36 assertions (21 bestaande Menu-guards plus 15 herstelcontroles): stale editor-
state wordt geweigerd, twee uitvoeringen maken één taak/receipt, eerdere fouten
en andere versies blijven gelijk, en uitsluitend echte fenced completion
activeert dezelfde versie. Ook een herhaling na voltooiing maakt niets dubbel.
Die fixture is transactioneel/rollback, met metadata-output, geen klantmutatie,
werkelijke Storage-upload of fysieke TV-test. De geautoriseerde klantoperatie
blijft geblokkeerd tot normale productie-uitrol van de exacte groene bron.

De gebruiker bevestigt zowel de exacte ‘Prijslijst Kantine’-publicatie als de
veilige mirrorfallback. Twee hosted pogingen stagneerden vóór browsercases:
`archive.ubuntu.com` en `security.ubuntu.com` waren niet resolveerbaar. Canonical
meldt DNS Major Outage vanaf 11 november 14:26 UTC. De tweede Foundation-poging
is geheel groen, inclusief 254 infrastructuurproeven; beide verse DB/RLS-runs
slagen met 158 bestanden/5465 assertions. Dit is geen geslaagde browsergate.

De drie CI-workflows delen nu `prepare-ubuntu-ci-mirrors.mjs`. Alleen eigen
ephemeral Linux/GitHub-hosted runners zijn toegestaan, nooit de VPS-runners.
De helper probeert de canonieke HTTPS-archive en vervolgens twee vaste HTTPS-
mirrors. Hij verifieert alle vier suite-InRelease-bestanden werkelijk met
`gpgv` en de bestaande Ubuntu Archive-keyring, inclusief Origin/Suite/Codename,
vóór enige bronwijziging. Geen nieuwe keys, HTTP-downgrade of resolverwijziging.
APT blijft authenticatie, pakketchecksums en Valid-Until afdwingen. Slechts
bekende Ubuntu-bases wijzigen; suites/components/keyrings en externe repositories
blijven gelijk. De oorspronkelijke `playwright install --with-deps chromium`
blijft verplicht, inclusief alle fonts. Onbereikbare of ongeldige mirrors
stoppen begrensd en fail-closed; herstel kiest weer de canonieke transportbasis.

18 mirrorregressies en scoped lint zijn groen. Een afzonderlijke echte
netwerk-/cryptoproef verifieert alle vier resolute-suites van de fallback met
de echte Ubuntu Archive-keyring; een gewijzigde echte handtekening wordt
afgewezen. Deze proef schrijft niet in de APT-configuratie van de gedeelde
worker. Werkelijke hosted pakketinstallatie/browsergates en nieuwe uitrol
blijven vereist en worden afzonderlijk in de PR vastgelegd.
