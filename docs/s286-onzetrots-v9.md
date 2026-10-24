# S286 — OnzeTrots v9 + grotere contextregels

> Historisch revisiebewijs. Voor actuele titels/headers geldt vanaf de opdracht
> van 24 oktober 2026 de [S291-canondelta](s291-onzetrots-consistency.md):
> Barlow Condensed Black 900. Ongetagde opgeslagen publicaties behouden de
> hieronder beschreven oorspronkelijke fonts.

Implementatie en lokale eindgates groen; normale CI en uitrol volgen.

Bron `5ba52a657d6d16ad103ba2fb43b8db18aa83715a` vervangt de tussentijdse
v7-referentie binnen dezelfde taak. Alle 160 v9-beelden en de afzonderlijke
Menu Studio-snapshot `77eec81092ab829302dd835fb430161fe93be220` blijven
byte-ongewijzigd onder `design/onzetrots-slides/v9/` staan.

De aanvullende gebruikersopdracht past bovenop v9 de contextregel toe op
14,3 logische pixels in plaats van 11 (+30%). Dezelfde semantische
`.panel-context` en tekst daarin gebruiken dit in beide modi/orientaties.
De uitlijning, paneelvolgorde en rasters blijven behouden. De meegeleverde
beelden bevatten deze extra vergroting niet; eigen bewijs benoemt dat verschil.

Een nieuwe identiteit `sync-onzetrots-v9` bewaart afzonderlijke subtitel-/titelmaps,
bezoekersschaal en de nieuwe fontset. Historische v1-presentaties veranderen niet.
Rubik Distressed 400 en OFL zijn origineel en checksumgebonden; gedeelde oude
beeldassets blijven bytegelijk. Eén gedeelde React-compositie bedient Control,
Worker en Player. De behouden v7-tijdlijn is pure elapsed-time-projectie.

Ownership en gates staan in het [sprintprompt](../prompts/sprints/S286-onzetrots-v9.md).

De bezoekersfit gebruikt ongetransformeerde fractionele CSS-maten. Dit voorkomt
naar boven afronden bij drie liggende kaarten; de maximale gevraagde schaal en
indeling blijven gelijk. De volledige 100/150/200%-matrix bij 1–4 kaarten is
in beide modi en oriëntaties als echte Player-DOM getest.

## Bestaande identiteiten en opgeslagen authoring

De baseline is `32b1db6851bcc9a3cc3aa96faa18d63fddc36964` (S285).
De oudere repo-inspectie in de overdracht zet deze implementatie niet terug.
`sync-v1`, `sync-onzetrots-v1`, Sites en FieldFlow houden hun bestaande betekenis.
Nieuwe OnzeTrots-ontwerpen gebruiken v9; bestaande immutable publicaties houden
hun vastgelegde presentatie en volledige binaire uitvoer.

`authoring` bewaart twee afzonderlijke familiemaps, `headerSubtitles` en
`headerTexts`, met maximaal 120 tekens per veld. Leeg blijft leeg. Herstellen
raakt beide velden van alleen de huidige familie. Standaardteksten gebruiken
de echte club; demo-club-/locatienamen komen alleen in displayfixtures voor.
De gedeelde `welcomeScalePercent` is 100–200, stap 5, standaard 150.
Wizard, Studio, gekoppelde ontwerpen en native Control gebruiken dezelfde
gevalideerde document-/revisionflow. Een bronrefresh overschrijft deze velden niet.

De nieuwe forwardmigratie is
`20261023140732_sync_onzetrots_v9.sql`. Zij voegt identity-helper v3 toe en
behoudt v2. De bestaande tenant-, privacy-, asset- en renderautorisatie blijft
achter dezelfde guarded writers staan. Nieuwe interne functies zijn niet voor
browserrollen of service-role rechtstreeks uitvoerbaar. De migratie schrijft
geen tenantinhoud of historische releases om. De bestaande constraint wordt
uitgebreid; een applicatierollback hoeft deze compatibele uitbreiding niet
terug te draaien. Historische migraties en checksumgebonden assets zijn ongewijzigd.

## Gedeelde compositie en beweging

Alle 36 families hebben één buitenkop, met subtitel boven titel en het clublogo
rechts. De originele achtergronden en witte footerartwork blijven behouden.
Niet-matchday heeft geen extra `.panel-head`; matchday houdt precies drie.
Contextstroken, kolomlabels, teamlogo's en werkelijke featuretitels blijven bestaan.
Verjaardagen tonen datum → felicitatie → Rubik-leeftijd → teaminformatie, met
zes vaste slots en vervolgpaginering. Een ontbrekende achternaaminitiaal wordt
niet verzonnen.

De behouden entree gebruikt een gedeelde zuivere tijdprojectie: achtergrond
0–850 ms; header 1250–1900 ms; daadwerkelijke bovenliggende panelen vanaf
2100 + i×120 ms; footer vanaf 2600 + max(0,n−1)×120 ms. Pauze/reduced motion
maken de intro af; hervatten behoudt die toestand. Beide replayknoppen starten
dezelfde scène opnieuw en respecteren reduced motion. Preview, Worker en Player
gebruiken dezelfde compositie, layoutmeting en motionprojectie.

De grotere kop en contextstrook zijn meegenomen in de volledige heen-/terugduur
van de ranglijst. Eén gecontroleerde eigen rij blijft boven/onder vaststaan.
De normale liggende voorbeeldstand vraagt nu 40 seconden. De poster wordt na
de entree binnen de eerste gegevenspagina genomen, ook bij een minimum van
vier seconden per pagina. Oudere Players krijgen de complete MP4/PNG-fallback;
alleen de expliciete v9-capability kan de nieuwe DOM-presentatie ontvangen.

## Visueel en technisch bewijs

[Bewijsmap](implementation/s286-onzetrots-v9/) bevat acht contactbladen,
representatieve native PNG's en de complete 144×-metadata-/SHA-matrix.
De 144 zelfstandige referentierenders lezen de byte-ongewijzigde v9-bron met
alleen de expliciet benoemde contextvergroting in de testomgeving.
Bij goal is de intro afgemaakt terwijl de oorspronkelijke gegevensanimatie
op 1200 ms blijft staan; een oudere capturehelper liet daar tijdelijk alleen
het intro-achtergrondframe zien. De oorspronkelijke overdracht is niet aangepast.
Pixeldifferenties zijn diagnostiek bij inhoud, glyphs en de nauwkeuriger
bezoekersfit; er is geen verruimde visuele passdrempel of afdekking ingevoerd.

De gedeelde echte Worker-/Player-entree is op 425, 1575, 2425 en 3500 ms op
1920×1080 exact gelijk in gedecodeerde RGBA-pixels. De losse PNG-encoderingen
staan onder `motion/`, met metadata. De complete canonieke video staat daar ook:
40.000 ms, 1200 frames, 1920×1080, 12.910.482 bytes, SHA-256
`d6fcaaf741c6b04d5516457805125f9b7aeb639dcc1443358606b1420650be58`.
De echte encoder en ffprobe zijn gebruikt binnen de bestaande grens van 300 s.

Uitgevoerde controles:

- Pakket: 261 exacte bronbestanden, 36 families, 144 basisbeelden + 16 details,
  vier aparte Menu Studio-beelden, hashes/galerij/fontlicentie en vijf gedragstests.
- Native productmatrix: alle 144 combinaties; verjaardag- en bezoekersbeelden
  na hun laatste gerichte wijziging opnieuw opgenomen.
- Gedeelde SSR-renderer: 144 familie-/modus-/formaatgevallen plus veilige tekst,
  binnenkoppen, de verjaardagvolgorde en werkelijk allowlisted Rubik-fontbytes.
- Wizard: 19 bestaande gevallen, inclusief 390/1440 en aXe; twee aanvullende
  header-/schaal-/herlaad-/reset-/receiptgevallen. Bestaande Studio: zes gerichte
  gevallen, inclusief beide replayknoppen en reduced motion.
- Player v9: 29 basis-/introgevallen en vier schaalgevallen met ieder alle
  1–4 bezoekersaantallen op 100/150/200%. Eigen rij eerste/midden/laatste,
  pauze, verborgen tabblad, fasen, lege slots en vervolgpagina's zijn behouden.
- Echte productiebuild van de Player: video/DOM op vier gedecodeerde tijden,
  koude offline start, corrupt-pending-checksum met behoud van LKG en de
  complete oudere capability-/EOF-fallback zijn geslaagd. De bestaande
  native H.264-grens van twee pixels is behouden.
- Verse eigen lokale database: 138 bestanden / 4525 assertions groen,
  inclusief 40 nieuwe v9-controles. Geen bestaande staging-/productiedatabase
  of database van een ander project is geleegd. De eigen teststack is gestopt.

De volledige lokale repositorygates zijn groen: lint, typecheck en unit-tests
ieder 30/30 taken; productiebuild 18/18 taken. De aanvullende lint voor nieuwe
helpers en workflowvalidatie zijn eveneens groen. De normale
PR-/staging-/productieflow wordt bij de exacte eindcommit geregistreerd.
Fysieke apparaten en de eerder uitgestelde 24-uursproef zijn niet als uitgevoerd
gemeld.

De eerste CI-run op `7c5ebd91` bevestigde foundation, responsive UI, alle vier
historische renderercohorten, Marketing/cross, Android Player en native Control.
De database-/RLS- en concurrencytests waren groen; de 30-minutenjobgrens werd
bereikt tijdens een FFmpeg-download via de trage HTTP Azure Ubuntu-mirror.
De bestaande Player-mirrorfix miste de `mirror+file`-bestanden. De beperkte
correctie neemt die bronbestanden mee en past dezelfde HTTPS-bron vóór de
database-publicatietools toe. Pakketten, signatures, suites, tests en grenzen
blijven gelijk. De afgebroken run wordt niet als volledige PASS gerapporteerd.

Dezelfde Control-run vond twee liggende Engage-grensgevallen. Ze zijn lokaal
gereproduceerd: lange antwoordteksten werden door flex-shrink te klein gemeten
en liepen onder hun rij door. Alleen de liggende variant met lange antwoordtekst
krijgt compactere paneel-/rijafstand, een passende vraagkop en niet-krimpende
rijen. Gewone referentievoorbeelden en staand houden hun layout. De oorspronkelijke
vier 390/1440 × liggend/staand-cases zijn daarna alle vier groen, inclusief
2/13/24 keuzes, de 160-tekensvraag, volledige antwoordtekst, QR en vervolgpagina's.
De assertions en toleranties zijn ongewijzigd; de definitieve CI volgt op de
correctiecommit.

De tweede run op `c11d02f4` bevestigde de volledige Control-browsersuite,
foundation, database/publicatie, native en alle renderercohorten behalve LED.
De LED-job downloadde nog via de aparte workflowbron: 25,9 MB in 7 min 24 s,
waarna de 45-minutenjobgrens de rendervergelijking afbrak. Dezelfde HTTPS-fix
geldt daarom vóór beide Sites-Chromium-installaties en vóór alle browsergroepen.
Dit wijzigt uitsluitend de runnerpakketbron, inclusief `mirror+file`; de
behouden renderer, referentiebeelden, pixelasserties, case-inventaris, packages
en alle deadlines blijven gelijk. De afgebroken runs blijven historische
infrastructuurresultaten en worden niet als volledige PASS gerapporteerd.

De volledige Player-browsersuite van dezelfde tweede run is eveneens groen,
inclusief de echte v9-export-/DOM-pariteit, introframes en offline/fallbacktests.
De daaropvolgende commit wijzigt alleen de hierboven beschreven CI-bronkeuze
en de bijbehorende documentatie; de product- en testbytes blijven gelijk.

Alle veertien normale CI-jobs zijn op `f7f3a034` groen geworden, inclusief LED.
Een extra gerichte controle vóór oplevering vond daarna een vroeg pauzegeval:
de goalslide maakte haar hoofdentree af, terwijl de afzonderlijke GOAL-tekst
half transparant bleef. V9 maakt die tekst nu volledig zichtbaar zodra de
entree is afgerond of expliciet afgemaakt. Hervatten behoudt die eindtoestand;
replay en normale start behouden hun entree. De historische renderer wijzigt niet.

De v9-goalregel is één tekstnode, met dezelfde tekst en spaties als voorheen.
Dit verwijdert het kleine glyphverschil door SSR-/clienttekstsegmentatie.
De volledige gepauzeerde Worker-/Player-output op 0 ms is nu exact gelijk in
native RGBA, zonder maskers of tolerantie. Beide PNG's en hun metadata staan
onder `motion/`. Nieuwe browsercases controleren daarnaast vooraf laden op 0 ms
en echte pauze/hervatting. Het oorspronkelijke rode pauzebewijs blijft bewaard.

Na deze gerichte correctie: alle 36 v9-Playercases, 295 oude/nieuwe SSR-cases,
255 gedeelde rendererunits, gerichte lint en renderer-typecheck groen. De vier
goalbeelden zijn opnieuw genomen; de onafhankelijke prototypecapture behoudt
daarbij de echte pauzestand. De volledige 144×-matrix en acht contactbladen
zijn daarmee opnieuw samengesteld, met behoud van de overige native beelden.

De volgende CI-poging stopte bij de bestaande connectiviteitstest vóór de
v9-cases: de test schakelde offline nadat alleen het afspeelgebied zichtbaar
was. De diagnostiek stond nog op ‘Publicatie voorbereid; wacht op zichtbare
bevestiging’. De test wacht nu aanvullend op de bestaande echte
`first-frame-ready`-bevestiging vóór netwerkverlies. Alle oorspronkelijke
offline-/continuïteitsasserties en tijdslimieten zijn behouden; er is hiervoor
geen playbackcode gewijzigd. De oorspronkelijke CI-trace en foutuitvoer zijn
bewaard. De vier connectiviteitstests en de volledige echte v9-export-/offline-
fallbacktest zijn op de actuele productiebuild geslaagd.
