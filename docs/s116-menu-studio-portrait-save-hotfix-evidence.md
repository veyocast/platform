# S116 Menu Studio portrait save hotfix

## Oorzaak

De oriëntatieknoppen wijzigden uitsluitend de lokale `MenuScene`-preview. Bij
het maken van een concept verstuurde Control altijd één vooraf geladen
`templateVersionId`; door de alfabetische templatequery was dat doorgaans het
landscape-template. De editroute las bovendien de opgeslagen
`dynamic_slides.orientation` niet terug, waardoor ook een correct staand menu
na navigatie opnieuw liggend opende.

## Herstel

- Control laadt en koppelt per oriëntatie een gepubliceerd prijslijsttemplate.
- Een nieuw concept verstuurt het template-ID van de actieve schermstand.
- De editroute initialiseert de preview vanuit de opgeslagen slideoriëntatie.
- `set_menu_studio_orientation_v2` wijzigt bij bestaande concepten oriëntatie,
  template-ID, templateversie en MenuDocumentrevision in één transactie.
- De commandgrens valideert tenantcapability, actieve tenant, rolloutflags,
  expected revision, gepubliceerde template-identiteit en operation-ID.
- De functie heeft een lege `search_path`; `anon` heeft geen execute-recht en
  alleen `authenticated` en `service_role` zijn expliciet toegestaan.
- Bestaande snapshots/releases blijven immutable; een gewijzigde oriëntatie
  komt pas na de bestaande expliciete publicatie in een nieuwe snapshot.

## Lokaal bewijs

- Control lint, typecheck en 169/169 unit-tests: groen.
- Verse `pnpm db:reset`: groen.
- Volledige RLS-suite: 52 bestanden, 1045 assertions, groen.
- Gerichte ACL-readback: `anon=false`, `authenticated=true`,
  `service_role=true`, `security_definer=true`, lege `search_path`.
- Supabase security-advisor: geen nieuwe securityfinding; alleen vijf reeds
  bestaande performancewaarschuwingen voor meervoudige permissive SELECT-policies.
- `db lint` meldt vijf reeds bestaande fouten in ongewijzigde functies; de
  nieuwe functie migreert, wordt door pgTAP uitgevoerd en is daarvan niet één.
- Volledige workspace `lint`, `typecheck` en `test`: 30/30 pakketten groen;
  productiebuild: 18/18 pakketten groen.
- A11y: 35 groen en één bewust overgeslagen live-fixturetest.
- Chromium: 151 groen en negen bewuste live/visual skips in de brede run. De
  vier door een automatische devserver-herstart en geheugendruk geraakte
  controles zijn aansluitend serieel 4/4 groen herhaald.
- Menu Studio Playerbewijs: vier prijslijstcombinaties, de 40-cellen visual
  matrix en de portraitmeting van twintig echte DOM-productregels zijn groen.

CI en hosted readbacks worden in dezelfde release via de PR- en
deploymentruns vastgelegd.
