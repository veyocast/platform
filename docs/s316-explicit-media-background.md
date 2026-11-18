# S316 — Thema’s zijn geen Media

## Bron en vastgestelde oorzaken

Actuele main via remote bevestigd: `67d8470198acec4272c47c4c7979b6071a915c4b`.
S315 is de afzonderlijke voorganger; zijn finale volledige gates blijven vereist.

- SitesSourceThemePicker bevat uitsluitend de geregistreerde authoring-ID’s
  `fieldflow` en `onzetrots-tv`. Direct daaronder mengde SitesSourceDesignControls
  negen vaste achtergronden met alle geladen tenantafbeeldingen in één galerij.
  Daardoor leek een sponsorlogo of poster een nieuw schermthema. Sportlink,
  Sportlink-bulk, Menu/Twelve en beide LED Scores-wizards delen dit onderdeel.
- In SyncCreateWizard koos ‘Eigen foto kiezen’ direct `data.images[0]` en schreef
  die keuze naar het hersteljournal. De browsertegenproef is op de oude code
  daadwerkelijk rood: alleen openen verandert `clubmuur` naar `photo` met het
  eerste tenantasset. Een nieuwe upload/sortering kon dus een andere foto kiezen.
- De normale RSS-/handmatige aanmaak deelt SyncCreateWizard. Bewerkbare normale
  en verbonden ontwerpen delen SyncStudioFrame; de aparte achtergrondselect
  stond daar tussen de overige clubbeelden. Deze achtergrondkeuze gebruikt nu
  dezelfde expliciete picker. Inhoudsfoto’s en logo’s behouden hun eigen velden.
- De generieke Sites-TV-inhoudseditor selecteert expliciet afbeeldingen als
  inhoud en heeft geen upload-naar-thema-adapter. Die werkende route is behouden.

De uploadketen schrijft `media_assets`/varianten, niet `tenant_theme_profiles`.
De bronnen laden alleen gereedstaande afbeeldingen; MP4/WebM is geen foto-
achtergrond. Er is geen bronbewijs van historische dataclassificatiecorruptie.
Daarom geen databasebackfill, media-/themadeletie of wijziging van opgeslagen
concepten, immutable snapshots, renderer of publicatieketen.

## Herstel

Themakiezers en vaste achtergronden blijven behouden. De tenantgalerij wordt
uitsluitend geopend via ‘Kies uit Media’. Openen, zoeken, Escape en Annuleren
roepen geen ontwerpwijziging aan. De gedeelde DialogTrigger herstelt de focus
naar diezelfde knop. Alleen ‘Gebruik … als achtergrond’ schrijft het gekozen
asset-ID/checksum naar de bestaande slideconfiguratie. Clubstijl, inhoud,
oriëntatie en centrale defaults veranderen daarbij niet.

Het gekozen beeld wordt benoemd; een historische referentie die niet in de
geladen keuzepagina staat, wordt niet gewist of vervangen. De bestaande
voorbeelden tonen dezelfde opgeslagen referentie via hun ongewijzigde resolver.
Andere media-/contentpickers, uploadlimieten en bestaande paginering blijven
intact. Geen vaste productlimiet of andere toepassing van 12 gewijzigd.

## Bewijs en grenzen

- Oude echte browsertegenproef: alleen openen wijzigt het duurzame journal (RED).
- Gewijzigde twee bestaande browserbestanden: 33/33 groen met de normale gepinde
  Chromium. Beide oriëntaties, extra poster/logo-keuzes, behoud bij nieuwe
  mediavolgorde, annuleren, expliciet het niet-eerste asset kiezen, refresh,
  bewaren en exacte replay na verloren antwoord; bestaande provider-/read-only-
  en herstelproeven blijven intact.
- Zes daadwerkelijke SSR-componentproeven over Sportlink/Menu/LED en beide
  oriëntaties vergelijken vóór/na extra Media bytegelijke gesloten selectors,
  configuratie en callbacks; een eerder gekozen achtergrond blijft behouden.
- De aanvullende open-dialogproef controleert axe en toetsenbord/focusterugkeer.
  De aanvankelijk ontbrekende triggerfocus is in de component zelf hersteld,
  niet met een versoepelde test of timeout.
- Finale foundation lint/typecheck/test ieder32/32 groen (31/31/30 cachehits),
  inclusief de zes nieuwe componentproeven. Daarna de volledige 33/33 browsers
  opnieuw groen (1,9 minuut), met open-dialog-axe en Escape/focusterugkeer.
  Alle normale hostedgates en builds volgen op de definitieve commit.

‘Nieuwe upload’ in deze gerichte browserproeven is een gecontroleerde nieuwe
Media-readrespons. Er is nog geen echte klantupload, generatie of ingelogde
staging-/productie-schrijfjourney uitgevoerd. Een aangewezen stagingvereniging/
testaccount en de door de beheerder in te voeren OpenAI-projectsleutel zijn
apart gevraagd. Geen fysieke LG-/Android- of live-providerclaim.

Staging-/productieruns, actieve revisies en functionele readbacks worden pas na
de normale exacte-SHA-uitrol als werkelijk behaald geregistreerd. De AI-agent
is een afzonderlijke S317-kandidaat en wordt niet door deze UI-PR geactiveerd.
