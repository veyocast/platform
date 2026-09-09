# S159 — Royal-blue tenanttheme en grotere slidehiërarchie

## Doel

Reset het FieldFlow-profiel van de expliciet gekozen tenant naar één rustig,
contrastrijk royal/navy-blue palet en vergroot de kijkafstandtypografie zonder
historische snapshots, releases of Player-LKG te muteren.

## Presentatie

- Gebruik CSS RoyalBlue `#4169E1` als primair accent en `#7A5CE6` als
  ondersteunende kleur.
- De donkere modus is actief: navy canvas, royal-blue oppervlakken,
  donkerblauwe wedstrijdregels en wit of lichtblauw gebaseerde tekst.
- Club- en thuislogo's staan op een witte plaat.
- Het palet bevat voor licht en donker alle 26 semantische kleurrollen en blijft
  na de reset per rol aanpasbaar in Instellingen.
- Algemene typografie groeit beheerst met `baseScale: 1.05`; sportprogramma,
  uitslagen en scores groeien sterker met `sportScale: 1.4`.
- Vaste rijhoogtes en deterministische paginering blijven behouden.
- Compacte tweekoloms-uitslagen volgen dezelfde sportschaal als éénkolomsregels.
- De live theme-preview toont de gekozen fonts, schaal, kleuren en de actuele
  tweeregelige programmahiërarchie.

## Centrale theme-authority

- Moderne Player, Static LG, preview, thumbnail en renderfallback projecteren
  de volledige bevroren tokenmap, inclusief de aliases die verjaardagen en
  nieuwe Menu Studio-renders gebruiken.
- Nieuwe snapshots krijgen een expliciete runtime-markering voordat een
  tenanttheme een inhoudsspecifiek Menu Studio-theme mag overrulen.
- Bestaande immutable snapshotdata en release-items worden niet bijgewerkt.

## Veilige tenantreset

- De databasefunctie accepteert alleen een exacte, unieke, actieve tenantnaam
  plus een valide GitHub-operator, auditreden en workflowrun-URL.
- De functie lockt profiel, settings en gepubliceerde slides, weigert een
  actieve publicatie en schrijft profiel plus compatibiliteitsmirror atomisch.
- Alleen bij een werkelijke wijziging wordt de revision verhoogd, een audit
  geschreven en `start_tenant_theme_rollout_v2` gestart.
- De private command is niet uitvoerbaar voor `PUBLIC`, `anon`,
  `authenticated` of `service_role`.
- Een beschermde handmatige workflow controleert de exacte reeds gedeployde
  main-SHA op Control en Player, de migratie, tenantreadback en het volledig
  gereedkomen van snapshot- en releasevertakkingen.

## Acceptatie

- Alle tien contrastcombinaties voor light/dark zijn minimaal 4,5:1.
- De Royal blauw-preset reset selectie, modus, 26 + 26 tokens, logoplaten en
  typografieschalen als één gebruikersactie.
- Programmatekst is circa 29,4 px, uitslagtekst circa 44,1 px en score circa
  68,4 px op de 1080p-éénkolomsweergave; secundaire programmadetails blijven
  circa half zo groot.
- Nieuwe tenantbrede snapshots tonen dezelfde kleuren in alle relevante
  slidefamilies en beide Player-runtimes.
- Een identieke retry is een no-op en maakt geen misleidend auditrecord of
  tweede rollout.

## Gates

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- `pnpm db:reset`, gerichte S159-pgTAP en `pnpm test:rls`.
- `pnpm test:a11y`, Chromium-E2E, `pnpm test:player` en
  `pnpm test:player:offline`.
- Gerichte theme-, renderer-, Static-LG- en visuele regressies.
- Diffcheck, ownershipcontrole, credentialscan, PR/CI, exact-SHA staging,
  production en tenant-rolloutreadback.
