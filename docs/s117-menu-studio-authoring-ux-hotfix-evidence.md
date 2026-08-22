# S117 Menu Studio authoring-UX hotfix

## Oorzaken

- Na `Maak productgroep` bleef `selectedGroupId` actief. De inspector en
  bibliotheek boden geen afsluitactie, waardoor iedere volgende productkeuze in
  de groepcontext bleef.
- De gedeelde portrait-CSS centreerde iedere ondervulde kolom expliciet met
  `justify-content: center`.
- `Menunaam` was een randloos veld in de toolbar. De bestaande `set-title`-
  command wijzigde alleen het document en niet de naam van de Slides-resource.

## Herstel

- Bibliotheek en inspector tonen de actieve groep en bieden `Klaar`, een
  sluitknop en `Klaar met productgroep`; een andere canvasselectie sluit de
  groepscontext ook.
- Portraitkolommen gebruiken altijd `justify-content: flex-start` in de ene
  gedeelde renderer voor preview, browser-Player en thumbnail.
- `Menunaam` is duidelijk omlijnd, als bewerkbaar gemarkeerd en licht automatisch
  opslaan toe. Ongeldige korte namen behouden de vorige waarde met herstelcopy.
- `save_menu_studio_document_v2` valideert titelcommands en synchroniseert de
  canonieke documenttitel atomisch naar `dynamic_slides.name`.
- De RPC houdt een lege `search_path`, expliciete execute-ACL, capabilitycheck,
  actieve-tenantcheck, rolloutflags, revision check en idempotency.
- Publicatie, snapshots, releases en last-known-good playback zijn niet gewijzigd.

## Lokaal bewijs

- Control lint, typecheck en 169/169 unit-tests: groen.
- Content templates lint, typecheck, 38/38 unit-tests en build: groen.
- Verse `pnpm db:reset`: groen.
- Volledige RLS-suite: 52 bestanden, 1046 assertions, groen.
- RPC-readback: `anon=false`, `public=false`, `authenticated=true`,
  `service_role=true`, `security_definer=true`, lege `search_path`.
- `db lint` meldt uitsluitend reeds bestaande repositorybevindingen en niets in
  de gewijzigde savefunctie.
- Menu Scene: 40 bestaande goldens plus lange én korte portraitgeometrie groen.
- Live Menu Studio desktop/touch/keyboard/axe, inclusief maken, groeperen,
  afsluiten, heropenen, hernoemen, opslaan en publiceren: groen.
- Volledige workspace `lint`, `typecheck` en `test`: 30/30 taken groen;
  productiebuild: 18/18 taken groen.
- Player: 91/91 groen; expliciete offlinegate: 7/7 groen.
- A11y: 34 groen en één bewust overgeslagen live-fixturetest. Eén ongewijzigde
  authnavigatie-time-out onder parallelle runnerdruk is serieel 1/1 groen.
- Volledige Chromium-matrix: 150 groen en negen bewuste skips. Tijdens een door
  Playwright gemelde Next-devserver-geheugenrestart vielen zes ongewijzigde
  shell/Playercontroles uit; exact die zes zijn aansluitend serieel 6/6 groen.

CI en hosted readbacks worden na afronding met dezelfde release-SHA aangevuld.
