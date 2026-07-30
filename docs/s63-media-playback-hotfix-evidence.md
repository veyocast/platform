# S63 — Media-upload en LG native videostreaming

## Fysieke productiebevindingen

Op 30 juli 2026 bleef de Media-route na een afbeeldingsupload in de algemene
Control-foutgrens staan. Op de gekoppelde staande LG 43UL3J-EP bleef bij een
toegewezen videorelease een licht vlak met uitsluitend de locked VeyoCast-mark
zichtbaar. Die mark bewees dat pairing, React-runtime en releaseweergave nog
actief waren; de storing zat in uploadtransport en videostart.

## Oorzaken

1. Next.js accepteerde voor Server Actions nog de standaard requestgrootte van
   ongeveer 1 MB, terwijl de gevalideerde productgrens 20 MB per afbeelding is.
   Een normale PNG werd daardoor vóór de applicatievalidatie afgebroken.
2. Meerdere geselecteerde afbeeldingen werden in één Server Action-request
   verstuurd. De server kon daardoor een onnodig grote batch in geheugen
   ontvangen.
3. S62 hydrateerde op LG ook MP4 als volledige `blob:`-URL. Dat omzeilde de
   instabiele serviceworkergrens, maar ontnam de native mediaspeler tevens
   HTTPS byte-range-streaming.
4. Een `pause`-event vóór het eerste afgespeelde frame zette de Player als
   bewust gepauzeerd. De startwatchdog wachtte vervolgens onbeperkt.
5. Kritieke playbackachtergronden gebruikten de CSS-systeemkleur `Canvas`.
   De oudere browser kon die ondanks dark mode als licht vlak invullen.

## Reparatie

- De Server Action-transportgrens is 21 MB: de gedocumenteerde 20 MB plus
  uitsluitend multipart-overhead.
- Maximaal twaalf afbeeldingen worden client-side vooraf gecontroleerd en
  daarna één voor één naar dezelfde server-side inhoudsvalidatie gestuurd.
  Een te groot, leeg of verkeerd bestand bereikt de Server Action niet.
- Een onverwacht onderbroken bibliotheekquery levert een lokale
  bibliotheekmelding op; de uploadintake en bestaande sessie blijven actief.
- Een online LG-video start met de gesigneerde HTTPS-bron. De
  checksum-gevalideerde lokale object-URL blijft aan hetzelfde item gekoppeld
  en wordt bij een native mediafout één keer als fallback geladen.
- Offline start de Player meteen met de lokale geverifieerde bytes.
- Het video-element gebruikt de directe `src`-property en roept na bronwissel
  defensief `load()` en `play()` aan.
- Alleen een video die al werkelijk speelde kan door een `pause`-event de
  startwatchdog pauzeren.
- Playback-shell, stage, scènes en `contain`-achtergrond gebruiken het locked
  Ink Black-token en zijn niet meer afhankelijk van browsersysteemkleuren.

## Geautomatiseerd bewijs

- Afbeeldingen op exact 20 MB worden geaccepteerd; leeg, groter en SVG worden
  vóór transport geweigerd.
- Control: 116 unit-tests en TypeScriptcontrole groen.
- Player: 102 unit-tests inclusief online native MP4-bron en offline
  blobfallback groen.
- Control- en Player-productionbuilds groen.
- De Player-build is door de Chromium 79/webOS 6-syntaxguard gegaan.

De volledige workspace-, a11y-, Player- en offlinegates worden vóór merge
opnieuw uitgevoerd en in de PR/deploymentchecks vastgelegd.

## Fysieke heracceptatie

1. Open productie-Control opnieuw en upload één PNG tussen 1 en 20 MB.
2. Verwacht per bestand een zichtbaar resultaat; geen algemene rode
   foutgrens.
3. Laat de bestaande LG-koppeling en immutable release staan.
4. Open `https://player.veyocast.nl/lg` opnieuw of herstart het display.
5. Verwacht videobeeld en minimaal één volledige loop.
6. Verbreek tijdens een volgende loop kort het netwerk en controleer dat de
   geverifieerde lokale release blijft spelen.

De fysieke LG-uitkomst blijft een hardwaregate en wordt niet door browsertests
als bevestigd aangemerkt.
