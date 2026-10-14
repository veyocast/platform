# S217 — Clubverhaal-bibliotheek en Playerrelease

## Vastgestelde oorzaken

De Control-bibliotheek en de bestaande playlistplaatsingen selecteerden
`dynamic_slide_snapshots.snapshot_hash`. De bestaande database heeft uitsluitend
`source_revision_hash`; de productielogs bevestigen SQLSTATE 42703 bij de
bibliotheekaanvragen. Beide lezingen gebruiken nu de echte bronhash en blijven
tenantgebonden. Een onleesbare opgeslagen slide levert een zichtbare fout op.

De productie-Next-build reproduceerde `RELEASE_ASSETS_UNAVAILABLE` nadat Storage
de gepubliceerde PNG succesvol had ondertekend. `SitesStaticView` importeerde
de browsercomponent `SitesUnifiedV17`. Het serverrenderen van die RSC-referentie
mislukte; broncode-Vitest kon deze Next-modulegrens niet zien. De statische
renderer gebruikt nu dezelfde pure `SitesUnifiedV17Markup` als de clientwrapper.
De browser behoudt zijn metingen en viewportfit. Het bestaande productie-menu
geeft in de gecorrigeerde build HTTP 200 met het daadwerkelijke product en widget.

Nieuwe menu-snapshots bewaren `menuDocument` aan de root. De widgetprojectie las
uitsluitend de oudere geneste `priceList.menuDocument`-vorm. Beide databasevormen
worden nu herkend. Documenten, publicaties en bytes hoeven hiervoor niet opnieuw
te worden aangemaakt.

De uploadclient las `error.cause` terwijl de image-API `error.message` en
`error.recovery` teruggeeft. De serveroorzaak en herstelactie verschijnen nu in
de editor. Een bestandsnaam van één teken of boven 120 tekens krijgt een geldige
registratietitel. Succes vereist nog steeds een serverreceipt en de preview van
hetzelfde geverifieerde asset; de SHA wordt meegenomen in de lokale selectie.
Een ontvangen upload wordt bij een previewfout niet nogmaals verstuurd.

## Verwerkingsstatus

De Media-selectie toont uitsluitend gereedstaande useruploads. Gegenereerde
slides worden via de slidebibliotheek geladen. Productie had zeven gegenereerde
images, vier gereedstaande dynamische slides en één mislukte video; een lege
ready-uploadlijst betekende dus niet dat alle opgeslagen content verdwenen was.

De picker toont nu maximaal twaalf recente niet-gereedstaande uploads, met de
werkelijke status en een herstelactie. Tijdens actieve verwerking wordt de
bibliotheek iedere twee seconden opnieuw gelezen. Polling stopt zodra geen
verwerking meer loopt. Mislukte assets zijn niet selecteerbaar. Geen bronupdate
of statuspoll slaat een slide, playlistversie of release op.

De geobserveerde videojob eindigde na ongeveer 44 seconden met
`processing_timeout` tijdens FFmpeg. Deze oorspronkelijke upload blijft
behouden. De bestaande harde verwerkingsgrens is behouden; de picker legt uit
dat een conform H.264-bestand tot 1080p30 opnieuw kan worden aangeleverd. Er is
geen ongeverifieerde afspeelvariant geactiveerd en geen succes gefingeerd.

## Verificatie

- Foundation: lint, typecheck en test elk 30/30 taken groen. De eerste parallelle
  testrun raakte de bestaande 5s-grens van de package-boundarytest; de volledige
  seriële run is geslaagd zonder gewijzigde assertions of deadlines.
- Nieuwe upload-/bibliotheektests en bestaande immutable bindingtests: 11 PASS.
- De werkelijk gebundelde Next-manifestroute: rootmenu, genest menu, v17- en
  v11-programma HTTP 200; ontbrekend Storage-object HTTP 503: 5 PASS.
  Het backendtransport is synthetisch en gebonden aan testgegevens; de
  productiebuild, schema's, projectie en serverrenderer worden werkelijk uitgevoerd.
- Werkelijke lokale Supabase/image-upload, private varianten, metadata,
  playlist-save/reopen, concurrency en immutable publicatie: 1 PASS.
- Bestaande editor-/pickerworkflows en toestanden: 114 PASS. Nieuwe statusflow,
  begrensde refresh en axe-controle op mobiel: 1 PASS.
- Player offline: 7 PASS.
- Verse geïsoleerde database-reset: alle 164 bestaande migraties; volledige
  pgTAP/RLS-suite: 107 bestanden, 3029 assertions PASS. Geen SQL-migratie,
  RLS-policy, dependency, lockfile of merkasset gewijzigd.

CI en uitrol van de exacte PR-SHA volgen via de bestaande staging/production-
pipeline. De fysieke Playerbevestiging wordt na uitrol apart gecontroleerd.
Manifestfouten krijgen voortaan een gestructureerde serverlog met fase en
release-ID, zonder credential, URL, ruwe SDK-fout of stacktrace.
