# S280 — Kleine beheertekst en ingesloten voorbeeld leesbaar

S244 heeft op de werkelijke74eb-build alle59 standaardroutes bij390/1440 en
licht/donker vastgelegd. De bredere aaneengesloten tekstdiagnose registreert
235/236 rijen vóór de bestaande contextdeadline; origineleFAIL en onvolledige
laatste dekking blijven behouden. Concrete bevindingen: te lichte Media-/LED-
copy, typebadge, dashboardparagraaf, verkeerd gebruikte muted-achtergronden in
de verjaardagswizard, een donker previewheaderlabel op licht UI-vlak en een
oude oranje Goal Overlay-checkbox. De oorspronkelijke afbeeldingen blijven.

Ownership: uitsluitend deze zes product-CSS-bestanden:
- apps/control/app/sync-adapter.css
- apps/control/app/(shell)/dashboard/media/sites-media.module.css
- apps/control/app/(shell)/dashboard/studio/led-scores/sites-led-scene.module.css
- apps/control/app/(shell)/dashboard/studio/sportlink/birthdays/new/birthdays.module.css
- apps/control/app/(shell)/dashboard/dynamic-content.module.css
- apps/control/app/(shell)/dashboard/studio/led-scores/goal-overlay/goal-overlay.module.css
Daarnaast uitsluitend de adapterhash in tests/control/sync-platform-mobile-layout.spec.ts,
docs/s280-sync-small-text-contrast.md, dit prompt en de eigen TASK_LEDGER-regel.

Gebruik bestaande semantische Source-rollen; geen andere kleurkeuze, geometrie,
copy-, renderer-, provider-, handler-, selectie-, publicatie-, database- of
locked-tokenwijziging. Beperk de themepreviewheader tot de UI buiten het canvas.
Inspecteer het te kleine Goal Overlay-voorbeeld; een bewezen lek van lokale
UI-CSS mag uitsluitend binnen het editor-CSS worden begrensd. De gedeelde
renderer en Player blijven bytegelijk. Bij een andere benodigde scope eerst
expliciet vastleggen, geen ongerichte shared-refactor.

Bewijs daadwerkelijke CSS-tegenproeven op beide breedtes/voorkeuren, met exact
tekst/geometrie/herstel/noPOST en gegevens-/Auth-/Storage-/Source-/SDKguards.
Voer de bestaande relevante native platform-/wizardgevallen en lint uit; behoud
alle oorspronkelijke asserts, fixturepinnen en deadlines. Concrete lage
contrasten worden gericht opnieuw gemeten; geen algemene AA- of volledige
pixelclaim. Root integreert normaal. Nieuwe echte appbuild, exacteCI en ronde4–5
plus staging/productie blijven onderdeel van S244. Geen hardware/provider-
uitstelvragen en geen claim dat fysieke24uuracceptatie is uitgevoerd.
