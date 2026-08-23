# S122 — Dynamic slide versioning, Sportlink wizard en thema-audit

## Baseline

- Startbranch: `main`
- Start-SHA: `27c801a39a9d44b78af0ab46b4fa776dc53d178c`
- Featurebranch: `veyocast/s122-slide-versioning-theme-wizard`
- Productie- en stagingrevision bij start: `27c801a39a9d44b78af0ab46b4fa776dc53d178c`
- Laatste migration bij start: `20260822221815_s119_unified_sportlink_studio.sql`

## Feitelijk model voor deze sprint

### Slides en snapshots

`dynamic_slides` is vóór S122 tegelijk het logische library-item en de mutable
ontwerpconfiguratie. Het record bevat onder andere template, databron,
oriëntatie, selectiegedrag en `configuration_json`. Er bestaat geen aparte
configuratieversie voor menu- of Sportlink-slides.

`dynamic_slide_snapshots` is wél immutable, maar is een geresolveerde
data-/renderuitvoer. Een veranderde Sportlink-score hoort terecht een nieuwe
snapshot te maken. Een snapshot is echter geen bewerkbare ontwerpversie en kan
dus niet dienen als versiegeschiedenis voor thema, layout of competitiekeuze.

Menu Studio heeft daarnaast een oplopende documentrevision en een immutable
operation log. Die revision is concurrencycontrole voor het actuele document,
niet het gebruikersmodel `v1`, `v2`, `v3` met een huidige gepubliceerde versie.

### Templates en Studio

Platformtemplates hebben al het juiste splitmodel:
`dynamic_templates` plus immutable `dynamic_template_versions`, met maximaal
één draft. De vrije Studio gebruikt een eigen design/revisionmodel. Die twee
modellen mogen niet worden verward met een tenant-slideversie.

### Playlists en releases

Een playlistconcept bewaart `dynamic_slide_id` én de op dat moment geresolveerde
`dynamic_snapshot_id`. Daarmee is de plaatsing al aan het logische slide-id
gekoppeld. Bij een nieuwe ready snapshot wordt een latest-plaatsing bijgewerkt.

Een playlistrelease en zijn release-items zijn immutable en bewaren de concrete
snapshot plus assetprovenance. Automatische dynamische verversing maakt een
nieuwe immutable playlistrelease; een oude release wordt niet aangepast. Dit is
de juiste fundamentele semantiek en blijft behouden.

### Thema's

S109 introduceerde één bestaand V2-themacatalogusmodel met tien platformthema's,
een tenant-default in `tenant_settings` en een expliciete `themeSelection` in
nieuwere slideconfiguratie. De instellingenpagina biedt de default echter alleen
als technische select aan. De S119 Sportlink-bulkwizard leest de tenant-default
niet en schrijft geen expliciete theme-selectie. Legacy slides vallen tijdens
snapshotopbouw terug op de bestaande `editorial-arena`-presentatie.

S122 bouwt daarom geen tweede themesysteem. De bestaande catalogus,
`ThemeSelection`, tenant-default en frozen `themePresentation` blijven leidend.

## Root causes

1. Menu- en Sportlinkconfiguratie leven rechtstreeks op `dynamic_slides`; er is
   geen immutable configuration-versionlaag of current/draft-pointer.
2. Menu documentrevisions en dynamic snapshots werden in de UI als versieachtig
   gepresenteerd, maar representeren respectievelijk concurrency en actuele data.
3. De Sportlink-wizard bestaat uit zeven losse stappen, kiest teams en typen in
   verschillende schermen, toont het product `teams × typen` pas laat en vraagt
   competitiecontext per gegenereerde slide opnieuw.
4. De wizard laadt uitsluitend bronnen, teams en Editorial Arena-templates. De
   bestaande tenant-theme-default en catalogus worden niet geladen of opgeslagen.
5. Settings bevat de default technisch al, maar een dropdown zonder preview maakt
   de impact en het creation-default-karakter onvoldoende duidelijk.

## S122-architectuurbesluit

- `dynamic_slides` blijft het stabiele logische object waar playlistconcepten
  naar verwijzen.
- `dynamic_slide_versions` bewaart volledige ontwerpconfiguratie, thema,
  template/databron/oriëntatie en status.
- Iedere bestaande slide krijgt een backfilled v1 zonder bestaande snapshots of
  releases te herschrijven.
- Een gepubliceerd versionrecord is immutable; maximaal één draft per slide.
- Een draft wordt vanuit de huidige versie gekloond en bij herhaald klikken
  hervat.
- De bestaande runtimekolommen op `dynamic_slides` blijven als compatibele
  materialisatie voor resolver en player. Tijdens een draft blijft de huidige
  ready snapshot actief. Publicatie materialiseert de draft en maakt een nieuwe
  snapshot; de current-versionpointer wordt pas bij ready output omgezet.
- Snapshots krijgen versieprovenance. Datarefresh blijft dezelfde gepubliceerde
  versie gebruiken en maakt dus geen nieuwe ontwerpversie.
- Playlistdrafts blijven naar het logische slide-id wijzen; releases blijven een
  concrete snapshot vastleggen.
- Bestaande slides zonder V2-selectie worden als legacy theme gerepresenteerd,
  zodat een migration geen visuele conversie veroorzaakt.

## UX-audit Sportlink-wizard

- `Bron`, `Teams` en `Slidetypen` zijn drie losse stappen terwijl ze één keuze
  voorbereiden; de gebruiker ziet de combinaties niet naast elkaar.
- Alle blueprints staan in één ongedifferentieerde lijst; club-, team- en
  poulebetekenis is niet zichtbaar.
- Het aantal te maken slides staat alleen op de submitknop.
- Context wordt per slide als volledige dropdown herhaald; dezelfde keuze kan
  niet eerst één keer per team worden toegepast.
- Provider-ID's kunnen als fallbacklabel in beeld komen.
- Oriëntatie, arrival-only instellingen en motion staan samen in één groot
  universeel formulier.
- Er is geen theme-keuze, geen tenant-defaultmarkering en geen blijvende preview.
- Zeven microstappen maken teruggaan en het behouden van overzicht onnodig zwaar.

De nieuwe flow gebruikt vijf conceptuele stappen, een desktopmatrix met mobiele
cards, een blijvende selectieteller, teamgewijze context met optionele individuele
override, één gedeelde visuele ThemePicker, een vaste preview en een leesbare
eindcontrole.

