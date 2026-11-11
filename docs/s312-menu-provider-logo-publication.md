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
