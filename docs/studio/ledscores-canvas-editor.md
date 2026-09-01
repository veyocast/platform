# LED Scores canvaseditor

## Productgrens

De LED Scores canvaseditor ontwerpt transient wedstrijdanimaties. Hij vervangt
niet de gewone Studio, de live tussenstandslide, playlistpublicatie of de
last-known-good Playerrelease. Het canvas wordt opgeslagen in de bestaande
Goal Alert-draft en bij publiceren samen met zijn assetmanifest en doelgroepen
als immutable alertversie bevroren.

De acht ondersteunde momenten zijn:

| Contractkey | Betekenis |
|---|---|
| `goalOwn` | doelpunt van het eigen clubteam, onafhankelijk van thuis/uit |
| `goalOpponent` | doelpunt van de tegenstander |
| `goalUnknown` | doelpunt zonder veilige teamidentificatie |
| `lineupHome` | thuisopstelling |
| `lineupAway` | uitopstelling |
| `matchStart` | wedstrijdstart |
| `halfTime` | rust |
| `matchEnd` | wedstrijdeinde |

Ieder moment heeft verplicht twee onafhankelijke scenes: `landscape` op
1920×1080 en `portrait` op 1080×1920. De editor kan een scene begrensd naar de
andere stand kopiëren; daarna blijven beide versies afzonderlijk bewerkbaar.

## Authoring

Desktop gebruikt drie functionele zones:

1. **Bibliotheek** — moment, vaste tekst/vorm, opstellingsraster, live tekst- en
   beeldvelden en tenantmedia.
2. **Canvas** — oriëntatie, veilige zone, zoom, selectie, 8-pixelsnapping,
   hulplijnen, slepen en schalen.
3. **Inspector** — geometrie, typografie, focus/crop, vormgeving, achtergrond,
   zichtbaarheid, vergrendeling, animatie en laagvolgorde.

Undo/redo bewaart maximaal vijftig geldige documentstappen. `Ctrl/Cmd+Z`,
`Ctrl/Cmd+Shift+Z`, `Ctrl+Y`, Delete/Backspace en pijltjestoetsen hebben een
toetsenbordpad. Een pijl verplaatst één pixel; Shift plus pijl tien pixels.
Getallenvelden zijn het precieze alternatief voor pointerbediening.

Op maximaal 60 rem gebruikt Control een afzonderlijke sequentiële flow:
moment → inhoud → vormgeving. Het canvas is daar een compacte read-only preview;
de laagkiezer en numerieke bediening verzorgen de mutaties. Interactieve
mobiele bediening is minimaal 44 px.

## Laag- en bindingscontract

Een scene bevat maximaal zestien lagen met unieke IDs en z-posities.

| Laag | Vaste bron | Live bron |
|---|---|---|
| Tekst | maximaal 240 tekens, inclusief canvascopy voor hoofd- en subtekst | teams, losse/volledige/vorige score, klok, periode, scorend team, spelernaam, rugnummer en momentlabel |
| Beeld | gereed tenantbeeld | spelerfoto, thuislogo, uitlogo of logo van scorend team |
| Vorm | rechthoek, ellips of lijn | niet van toepassing |
| Opstelling | stijl en rasterinstellingen | begrensde actuele spelerslijst |

Alleen Inter en Inter Tight en de contractgewichten 400–900 zijn toegestaan.
Kleuren zijn zes- of achtcijferige hexwaarden. Animatie is beperkt tot `none`,
`fade`, `rise`, `zoom` of `wipe`. Deze gesloten keuzes voorkomen dat vrije CSS,
HTML, scripts of externe fonts de Control- of Playergrens passeren.

Een achtergrond is effen, een kleurverloop of tenantmedia. Een vaste JPEG-,
PNG- of WebP-afbeelding mag ook als beeldlaag worden gebruikt; SVG-markup en
GIF worden aan deze live Playergrens niet aangeboden. Een video mag alleen als
achtergrond en moet een gereed `player_1080p`-rendition hebben; de Player speelt
hem muted, looped, inline en zonder controls. Eén volledige experience gebruikt
maximaal 24 unieke media-assets.

## Mediaflow

Control leest maximaal de recente gereedstaande uploads met
`source_kind = user` en laadt daarnaast exact media die een bestaand canvas of
legacyveld al gebruikt. Die aanvullende technische referenties blijven voor
veilige preview en compatibiliteit beschikbaar, maar worden niet opnieuw als
menselijke bibliotheekkeuze aangeboden. Voor preview kiest Control een
thumbnail/original van een beeld en de `player_1080p`-variant van een video.
Storage levert signed URL's met een levensduur van tien minuten.

Het legacyveld `Clublogo` is geen algemene mediakiezer: alleen het
`logo_media_asset_id` uit de tenanthuisstijl en logo's van actieve
clubkoppelingen zijn nieuwe keuzes. Gewone foto's, video's en gegenereerde
slideoutputs blijven buiten die lijst. Fallbackbeelden en -video's komen alleen
uit de eigen uploadbibliotheek. De serveraction past dezelfde rolcontrole toe;
alleen een exact ongewijzigde technische selectie uit hetzelfde bestaande
concept mag voor achterwaartse compatibiliteit behouden blijven.

De omliggende vijfstapswizard gebruikt tot en met 48 rem één actieve stap.
Formcontrols hebben een begrensde inlinebreedte en minimaal 44 px hoogte, zodat
lange bestandsnamen de Media-stap ook op 320–768 px niet buiten de viewport
drukken.

Uploaden gebruikt de bestaande tenantmediaflows en vereist zowel
`tenant.dynamic_slide.write` als `tenant.media.write`. Een upload verschijnt pas
na de bestaande inhoudsvalidatie en ready-transitie. Het canvas bewaart alleen
het media-UUID; signed URL's, cookies en storagecredentials komen niet in het
document.

Bij opslaan leidt Control alle vaste canvasmedia opnieuw uit het document af en
voegt die toe aan het alert-assetmanifest. Een manifest met meer dan 24 assets
of dat niet exact overeenkomt met het document wordt geweigerd.

## Validatie en security

De validatie gebeurt op vier grenzen:

1. De editorreducer accepteert alleen een volledig geldig
   `LedScoresCanvasExperience` en houdt invalid input buiten undo/redo.
2. De Control-serveraction parseert het gedeelde Zod-schema opnieuw, begrenst
   de formwaarde op 240 kB en leidt de assetset af.
3. `private.validate_ledscores_canvas_config_v1` valideert bij save en publish
   exacte JSON-keys, beide oriëntaties, alle laagvelden, unieke IDs/z-posities,
   allowlisted bindings en de exacte assetset.
4. De Player parseert de immutable scene-pair en zijn assetlijst opnieuw vóór
   renderen.

De databasegrens accepteert maximaal 250.000 bytes draftconfig en 262.144 bytes
voor het immutable versionsnapshot. Referenties moeten binnen dezelfde tenant
bestaan, ready en niet verwijderd zijn en een checksum hebben. Een vaste
beeldlaag eist `kind=image` met JPEG-, PNG- of WebP-MIME; een
media-achtergrond accepteert zo'n beeld of video, waarbij video een
gecontroleerde MP4-`player_1080p`-variant vereist.

De nieuwe databasehelpers staan in `private`, hebben een expliciet lege
`search_path` en zijn niet uitvoerbaar door `anon` of `authenticated`. Alleen de
bestaande capability-guarded save- en publish-RPC's vormen de schrijfgrens. De
bestaande RLS, tenant-aware foreign keys, expected revision, audit,
idempotencyreceipt en immutable update/delete-triggers blijven van kracht.

## Runtime

De Playerbootstrap koppelt een scene uitsluitend aan de immutable
`alertVersionId`. Een eventueel sceneveld uit het live event wordt eerst
verwijderd; daarna wordt de momentkey bepaald en alleen de gepubliceerde scene
toegevoegd wanneer ieder vast asset in het gepubliceerde manifest aanwezig is.
Bij reconnect blijft een nog geldige pending delivery voor versie A samen met
de inmiddels actuele versie B in de begrensde bootstrap staan; pending
immutable versies krijgen daarbij voorrang vóór de clientcap. De pending
delivery zelf houdt de bevroren versie beschikbaar wanneer de mutable alert
daarna wordt gepauzeerd of het scherm vóór reconnect uit de actuele doelgroep
wordt gehaald.

Moderne Player en de zelfstandige Legacy LG-runtime:

- kiezen de oriëntatie uit de actuele viewport;
- vullen uitsluitend de contractbindings met gesaneerde wedstrijdwaarden;
- renderen effen/verloop/media-achtergrond en tekst-, beeld-, vorm- en
  opstellingslagen;
- verwerken fade, rise, zoom en wipe;
- werken een actieve goal bij wanneer spelernaam, rugnummer of foto later
  beschikbaar komt;
- pagineren een opstelling begrensd met maximaal elf spelers per liggende en
  acht per staande pagina.

De overlay blijft boven de bestaande last-known-good playback staan. Scene- of
mediafouten mogen de playlist niet stoppen en activeren geen nieuwe release.

## Compatibiliteit en bewuste limieten

- Een legacy alert zonder `canvasExperience` blijft de bestaande vaste
  ontwerpvelden gebruiken; er is geen backfill.
- Een ongeldige scene, verkeerde oriëntatie of ontbrekend immutable asset wordt
  niet gedeeltelijk gerenderd maar valt terug op die veilige vaste overlay.
- Als een geldige achtergrondafbeelding of -video pas in de browser faalt,
  schakelen moderne en Legacy Player de volledige canvasvisual terug naar de
  vaste overlay; goal-sponsor en -geluid blijven daarbij actief.
- Een ontbrekende live tekstbinding gebruikt de vaste fallbacktekst. Een
  ontbrekend live beeld levert geen externe inhoud; het beeldvak blijft leeg,
  terwijl het opstellingsraster initialen voor een ontbrekende spelerfoto toont.
- Video is alleen achtergrond, niet een vrij schaalbare videolaag.
- Er is geen vrije code, plug-inlaag, externe URL, audio, custom fontupload,
  willekeurige keyframe-editor of canvas-publicatie buiten de Goal Alert-flow.
- Automatisch kopiëren tussen standen levert een veilig startpunt, geen
  gegarandeerd definitief responsive ontwerp; de gebruiker controleert beide
  scenes expliciet.

## Test- en releasestatus

Lokaal bewezen tijdens S142:

- contractschema: 5 gerichte scenetests en 58/58 contracttests;
- Control reducer/editorcontract: 8 gerichte tests;
- Control: lint en typecheck groen, 54 suites/291 tests groen en productionbuild
  inclusief auth- en client-secretboundary groen;
- Player: 48 suites/243 tests groen, inclusief moderne canvasrenderer,
  serverattachment, matchparser, goal-/matchoverlay en Legacy-route.

De S142-pgTAP bevat 27 assertions voor capability, legacycompatibiliteit,
paired scenes, strikte laagvalidatie, cross-tenant/ready media, video-rendition,
exact manifest, revision, immutable publicatie en pending-versiehydratie na
pauzeren of hertargeten. Een verse database-reset en de volledige RLS-run zijn
groen met 1.583 assertions. De werkruimte heeft 1.054/1.054 unittests en 18/18
buildtaken; a11y heeft 36 groene cases en één bewuste live-fixtureskip. De brede
Chromiumrun heeft 188 groene cases en 21 bewuste skips; de ene eenmalige
signed-media-opstarttimeout na de negentien minuten durende matrix is direct
daarna drie keer achtereen groen herhaald. De afzonderlijke Playergate is
116/116 groen en offline 7/7. Alleen immutable staging-/productie-readback blijft
een externe releasegate tot promotie van de merge-SHA.
