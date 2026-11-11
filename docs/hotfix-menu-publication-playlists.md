# Hotfix kantineprijslijsten en playlists — 11 november 2026

## Status en bewijsgrens

Lokale wijziging vanaf `5fa981c3d873e9a802c76cd852bab03c737e7f1b`.
De gebruiker heeft op 11 november expliciet commit, push, mainintegratie,
staging en productie geautoriseerd, na uitvoering van de extra RSS-opdracht.
Beide wijzigingen worden samen via `veyocast/s309-rss-menu-hotfix` en de bestaande
main-releaseflow aangeboden. De daadwerkelijke uitrolstatus en bewijslinks staan
in `docs/s309-rss-layouts-release.md`. Workflows, environments en secrets zijn intact.

## Vastgestelde oorzaken

- De generieke Sites-configuratie valideerde `rowsPerPage` op maximaal 12.
  Widgetprojectie deelde handmatig gemaakte pagina's vervolgens opnieuw op met
  rijbudgetten, chunks en schaalafhankelijke capaciteit. De oudere MenuScene had
  daarnaast eigen rijbudgetten. Een gekozen pagina was dus geen vaste pagina.
- De widgetrenderer en de DOM-capture konden te volle productinhoud vrijwel
  onbeperkt verkleinen. Dat maskeerde ruimtegebrek en veroorzaakte verschillen
  tussen de gekozen indeling en de uiteindelijke weergave.
- Productrijen centreerden titel, omschrijving en prijs gezamenlijk verticaal.
- De publicatieactie bevestigde een verzoek, niet de gereedstaande actieve
  versie. De interface presenteerde dat toch als succes en controleerde de
  afhandeling niet. De badge toonde iedere actieve bewerkversie als concept.
- De finalisatietrigger eiste een gewijzigde snapshotpointer. Een reeds gekoppeld
  renderresultaat kon later gereed zijn zonder de versie te activeren. Een
  herhaald publicatieverzoek voor `publishing` deed geen herstel.
- Mislukte snapshots zijn terecht immutable. Een retry moet daarvoor een nieuwe
  renderpoging onder dezelfde slideversie maken; een verlopen, nog niet terminale
  job kan wel met een gewiste lease opnieuw worden ingepland.
- Automatische oude dynamic-releasefuncties waren eerder bewust uitgezet.
  Een nieuwe actieve slideversie veranderde daardoor niet vanzelf de bestaande
  immutable playlistpublicaties en de scherm-/deviceverwijzingen ernaar.
- De playlistpijlen bestonden alleen in de aparte volgordemodus. Meerdere klikken
  binnen dezelfde render konden bovendien van dezelfde verouderde props uitgaan.

## Gedrag na de wijziging

### Pagina's en prijsuitlijning

De gekozen pagina blijft één pagina; product 13 maakt geen vervolgpaginering.
De generieke menulimiet van 12 is weg in TypeScript én databasevalidatie.
Sportlink-/LED-limieten en bestaande beveiligingsgrenzen voor documentgrootte
blijven intact. Automatische kolomverdeling verdeelt uitsluitend binnen de
gekozen pagina; expliciete kolomkeuzes blijven behouden.

Preview en Player delen dezelfde renderer. Producttekst wordt niet automatisch
kleiner gemaakt om een overvolle pagina passend te verklaren. De wizard meet
alle pagina's, inclusief categorieblokken, omschrijvingen, afbeeldingen, kop en
de beschikbare ruimte vóór de footer. Bij overloop verschijnt een waarschuwing
en wordt publiceren tegengehouden. Niets wordt uit de selectie verwijderd;
de gebruiker past schaal/kolommen/inhoud aan of maakt zelf een extra pagina.

Product en prijs staan in een grid met een eigen, niet-afbrekende prijskolom,
uitgelijnd op de eerste tekstbaseline. Een omschrijving of meerregelige titel
beïnvloedt die eerste prijsbaseline niet. Het optionele beeld gebruikt een
expliciet data-attribuut, geen nieuwe `:has()`-afhankelijkheid voor oudere spelers.

### Opslaan, publiceren en herstel

Opslag wacht op serverbevestiging. Een herhaalde Menu-operatiesleutel wordt ook
vóór de lokale revisioncontrole aan de tenantgebonden opslagreceipt getoetst.
Dezelfde bevestigde operatie wordt niet opnieuw toegepast; afwijkende invoer of
een inmiddels nieuwere revision levert een zichtbare fout op. De wizard blokkeert
bewerken tijdens opslag en vervangt bij oriëntatieopslag niet de lokale inhoud
door een oudere serverkopie.

De gedeelde publicatiecontrole vraagt iedere twee seconden de echte versie en
snapshot op. Alleen `published` + de actuele actieve-versieverwijzing + een
`ready` snapshot met output wordt als gereed gemeld. Na voltooiing wordt de
dashboardweergave automatisch bijgewerkt. Fouten worden zichtbaar; na twee
minuten observeren, of een snapshot ouder dan tien minuten, volgt geen eindeloze
publicatiemelding maar een herstelactie. De bibliotheek ververst maximaal twee
minuten iedere drie seconden en verwijst bij uitblijvende voltooiing naar herstel.
Een expliciete retry krijgt opnieuw twee minuten observatietijd, ook wanneer
dezelfde oude, niet-terminale snapshot opnieuw in de wachtrij is gezet.

De migration behoudt de bestaande prijs-/autorisatiecontroles rondom het
publicatie-RPC. Finalisatie vereist ook een ready, niet-verwijderde media-asset
met original-variant. De vorige actieve versie blijft staan tijdens verwerking.
Retry gebruikt dezelfde slide en versie. Een verlopen workerlease wordt gewist
en daarmee afgeschermd tegen een verouderde completion. Een terminale mislukte
snapshot blijft geschiedenis; een nieuwe renderpoging hoort bij dezelfde versie.

Een beperkte migrationreparatie activeert uitsluitend reeds als `publishing`
gemarkeerde versies met het daadwerkelijk gereedstaande gekoppelde resultaat.
Opzettelijke `draft`-versies worden niet gepubliceerd. Andere mislukte of nog
lopende taken worden niet blind opnieuw gestart; daarvoor bestaat de retryactie.

### Bestaande playlistpublicaties

Bij activering van een nieuwe slideversie wordt per huidige, volgende
playlistpublicatie een nieuwe immutable release afgeleid van de **laatst
gepubliceerde release**, niet van het bewerkconcept. De manifest-itemidentiteit,
volgorde, duur en overige frozen instellingen blijven intact. Bewerkitems worden
niet verwijderd of opnieuw toegevoegd. Ongepubliceerde playlistwijzigingen blijven
ongepubliceerd. Geërfde Sites-opmaak volgt de nieuwe bron; afwijkende expliciete
playlistopmaak en de gekozen afspeeltijd worden behouden.

Defaultschermen, actieve planningen, frozen doelsnapshots en gewenste releases
van gekoppelde devices worden via de bestaande toewijzingsmodellen bijgewerkt.
Historische releases blijven beschikbaar. Expliciet vastgezette niet-live items
en afzonderlijk gemaakte Source-opmaakvarianten worden niet stilzwijgend
omgezet naar een andere ontwerpbinding.

### Playlistvolgorde

De pijlen zijn bij ieder item beschikbaar, ook buiten de volgordemodus. Ze werken
op de unieke playlistitem-ID, niet de media-ID. Grenzen zijn uitgeschakeld;
twee snelle klikken bouwen op de laatste lokale volgorde voort. Knoppen hebben
een toegankelijke naam, tooltip, normale toetsenbordbediening en de bestaande
aanraakvlakken van minimaal 44 × 44. Klikken starten geen preview/editoractie.

Het bestaande expliciete opslagmodel blijft gelden: **Opslaan** bewaart het
concept; **Publiceren** verspreidt de gewenste complete playlist naar gekozen
schermen. De interface meldt direct dat een verplaatsing nog niet is opgeslagen.
De bestaande serverrevision-, batchjournal- en foutafhandeling blijven leidend.
Een bewerkconcept wordt niet zonder publicatie als schermrelease verspreid.

## Wanneer ontvangt de Player wijzigingen?

- De normale online manifestcontrole start na een geslaagde synchronisatie
  opnieuw na 8 seconden plus maximaal 750 ms jitter. Daarnaast controleert nu
  iedere echte nieuwe afspeelbeurt het manifest, ook bij gewone media. Een gemiste
  wijzigingsmelding laat de Player dus niet permanent op de oude release staan.
- ETags, bestaande assetchecksums, gedeelde lopende requests en generatiecontrole
  blijven actief. Ongewijzigde bestanden worden niet onnodig opnieuw gedownload;
  een laat oud antwoord kan een nieuwere kandidaat niet vervangen.
- Een kandidaat wordt eerst volledig voorbereid en gecontroleerd. De bestaande
  item-/loopgrens en compositiegrenzen bepalen daarna de veilige overgang; het
  huidige media-item wordt niet alleen wegens een volgordewijziging afgebroken.
  De eerstvolgende vertoning na een geslaagde activering gebruikt de nieuwe versie.
- De normale detectievertraging is dus maximaal circa 8,75 seconden tot de
  volgende geplande request, plus netwerk-/voorbereidingstijd en de resterende
  tijd tot de veilige afspeelgrens. Er bestaat geen eerlijke absolute
  secondenlimiet inclusief willekeurige downloads of netwerkstoringen.
- Manifestrequests hebben een timeout van 10 seconden. Bij fouten geldt de
  bestaande exponentiële backoff tot vijf minuten. Online-/resume-events starten
  herstel. De geverifieerde last-known-good blijft beschikbaar; er komt geen
  nieuwe herstart- of zwartschermroute bij.

## Uitgevoerde controles

- Workspace `turbo run lint typecheck test`: 68/68 taken groen (inclusief
  bestaande cachehits). Player 755 tests; Control 2232 tests;
  content-templates 294; media-worker 436.
  Bestaande overgeslagen suites blijven overgeslagen, niet als geslaagd geteld.
- Workspace `turbo run build`: 18/18 taken groen. Echte Next-productiebuilds
  voor Control, Player en Marketing, worker/packagebuilds en Android Expo-export;
  bestaande client-secret-, auth-boundary- en webOS-compatibiliteitsgates behouden.
  Eerste poging miste sparse-checkout marketingafbeeldingen; de oorspronkelijke
  getrackte fixtures zijn hersteld. Geen appcode gewijzigd om die gate te omzeilen.
- Gecombineerde workspacecontrole `turbo run lint typecheck test build`: 75/75
  taken groen; de afzonderlijke aantallen overlappen gedeelde afhankelijkheden.
  Na de laatste retry-interfacecorrectie is Control opnieuw gecontroleerd:
  14/14 taken groen, inclusief lint, typecheck, 2232 tests en productiebuild.
- Gerichte PostgreSQL/pgTAP-proef met de forwardmigration: 46 assertions groen.
  Nieuwe/eerdere versie, onveranderde snapshotpointer, twee playlists, behoud van
  manifest-ID/duur/volgorde, defaults, devices, planning/doelsnapshot, geen dubbele
  releases, ongepubliceerde concepten, verlopen workerlease, renderfout en retry.
- Bestaande Menu-widgetdatabaseproef met drie extra grensgevallen: 14 assertions
  groen, waaronder 13/16 en afwijzen van een niet-gehele rijinstelling.
- Beide DB-proeven draaien in een transactie met rollback op de aanwezige lokale
  database. Geen gedeelde DB-reset of blijvende test-/klantwijzigingen uitgevoerd.
- Chromium: 12 nieuwe renderproeven groen, twee thema's × twee oriëntaties,
  13/16 compacte producten op één pagina en overloop met lange titels/omschrijvingen.
  Compacte fixtures gebruiken bewust twee kolommen en handmatig gekozen schaal
  70, geen automatische tekstverkleining. Geometrie, aantallen, prijskolom en
  eerste titelregel worden werkelijk in de browser gemeten.
- Chromium: acht playlistproeven groen. Echte productiecomponent op 320/1440 px,
  A/B/C/D, omhoog/omlaag, snelle dubbelklik, dubbele mediareferenties, duurbehoud,
  bevestigde HTTP-opslag en heropenen; bestaande volgorde-/bulk-/foutproeven op
  390/768/1440 px. Beide nieuwe dialogen hebben nul geteste WCAG-A/AA axe-fouten.
- Gebouwde Next-Player in Chromium: 18 bestaande verversings-/offlineproeven
  groen (1,5 minuut). Browser en static-LG-profiel, vernieuwde signed URLs zonder
  nieuwe download, reconnect met vertraagde oude response, crash/nieuwer doel
  tijdens activering, tien opeenvolgende publicaties, een late oude download,
  behoud van het huidige frame tot de grens, periodieke manifestcontrole,
  intrekken van een pending release, last-known-good bij onbeschikbaar manifest
  en media, en weigeren van corrupte pending assets. Dit gebruikt lokale
  geverifieerde fixtures en requestinterceptie, niet een klantdevice.

## Nog niet geverifieerd

Geen nieuwe staging- of productie-uitrol, volledige fresh DB-reset/RLS-suite,
geauthenticeerde end-to-end bewerking in meerdere echte tenants/sessies,
klantspecifieke vastgelopen taak, daadwerkelijke object-storage/workercompletion,
hardware-Android/webOS of fysieke offline-/reconnectproef. DB-assets in de
transactionele fixture zijn metadata, geen claim dat bestanden zijn geüpload.
De HTTP-opslagbrowserfixture is geen echte backend-/nieuwe-sessieproef.
Er wordt dus geen hosted of fysieke Playeracceptatie geclaimd op grond van
alleen units, componentbrowserproeven of toewijzingspointers.

## Gewijzigde bestanden

- `apps/control/app/(shell)/dashboard/slides/menu-studio/`:
  `actions.ts`, `sites-menu-wizard.tsx`, `menu-studio-editor.tsx`,
  `[slideId]/page.tsx`, `menu-widget-document.test.tsx`, `sites-menu-publish.test.ts`.
- `apps/control/app/(shell)/dashboard/slides/`: `version-actions.ts`,
  `version-history.tsx`, `publication-progress.tsx`, `publication-status.test.ts`,
  `page.tsx`.
- `apps/control/app/(shell)/dashboard/studio/sportlink/new/sites-source-design-controls.tsx`.
- `apps/control/app/(shell)/dashboard/playlists/_components/sites/playlist-editor.tsx`.
- `apps/control/lib/`: `move-playlist-item.ts`, `move-playlist-item.test.ts`.
- `packages/contracts/src/sites-presentation.ts`.
- `packages/content-templates/src/`: `sites-menu-widgets-model.ts`,
  `sites-menu-widgets-styles.ts`, `sites-menu-widgets-markup.tsx`,
  `sites-menu-widgets.tsx`, `sites-presentation.tsx`, `sites-approved-menu.tsx`,
  `menu-scene-model.ts`, `menu-scene.module.css`.
- `packages/content-templates/test/menu-scene.test.ts`.
- `apps/media-worker/src/sites-dom-capture.tsx`.
- `apps/player/app/_components/player-runtime.tsx`.
- `supabase/migrations/20261111002440_menu_publication_and_playlist_hotfix.sql`.
- `supabase/tests/`: `rls_dynamic_slide_versions.sql`, `s215_menu_widgets.sql`.
- `tests/control/`: `menu-hotfix-layout.spec.ts`, `sites-playlist-workflows.spec.ts`.
- Dit document en `TASK_LEDGER.md`.
