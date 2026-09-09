# S159 — Royal-blue tenanttheme en grotere slidehiërarchie

Status: `READY_FOR_RELEASE`

Deployment: `STAGING_APP_GREEN; TENANTRESET_DIAGNOSTIEK_IN_REVIEW`

Datum: 9 september 2026

Branch: `veyocast/s159-royal-theme-scale`

Baseline: `6a80932b29312058fc3ca44231fefe26889d8d28`

## Besluit

Het Royal-blue uiterlijk is één gedeeld, concreet FieldFlow-preset en geen
stille wijziging van `fieldflow@1.0.0` of de globale appearance-default. Het
actieve profiel gebruikt `#4169E1`, support `#7A5CE6`, fixed dark, witte
logoplaten, navy/royal oppervlakken, wit gebaseerde tekst, Inter/Manrope,
`baseScale: 1.05` en `sportScale: 1.4`.

Daardoor groeit de 1080p-programmaregel van 22,4 naar 29,4 px, de
éénkolomsuitslag van 33,6 naar 44,1 px en de score van 52,08 naar 68,355 px.
De circa 52%-detailregel en alle vaste rijhoogtes/paginering blijven behouden.
Compacte tweekolomsuitslagen volgen dezelfde schaal, met behoud van hun
kleinere uitgangsmaat en 48 px-logotracks.

## Volledige tokenauthority

- De centrale editor biedt Royal blauw als eerste standaardpalet en als
  expliciete herstelactie.
- Eén presetactie zet selectie, actieve modus, alle 26 + 26 kleurrollen,
  logoplaten en typografie samen; iedere rol blijft daarna individueel
  aanpasbaar.
- De live preview projecteert de gekozen fonts en schalen en toont dezelfde
  tweeregelige wedstrijdhiërarchie als de Player.
- De gedeelde `--vc-theme-*`-aliases lezen de bevroren concrete tenanttokens in
  plaats van de statische manifestkleuren. Dat herstelt onder meer
  verjaardagskaarten.
- Static LG projecteert dezelfde aliases en sportschalen zonder moderne
  browserrekenfuncties.
- Nieuwe snapshots dragen `_veyocastThemeRuntime.version = 2`. Alleen deze
  versie laat de centrale tokenmap een Menu Studio-inhoudsthema overrulen;
  eerdere immutable snapshotdata blijft ongewijzigd.

## Veilige tenantreset

De migratie muteert geen tenant tijdens deployment. De owner-only private
command accepteert één exacte, unieke, actieve tenantnaam en alleen streng
gevalideerde GitHub-operator-, reden- en workflowrunvelden. Hij lockt settings,
profiel en relevante slides, weigert een actieve publicatie, schrijft profiel
en compatibiliteitsmirror atomisch, verhoogt de revision en start
`private.start_tenant_theme_rollout_v2`. Alleen een echte wijziging krijgt een
auditrecord; een retry leest de bestaande rollout terug.

De beschermde workflow controleert vóór mutatie Control én Player op de exacte
reeds gedeployde main-SHA, controleert migratiehistorie, voert mutatie en
readback atomisch uit en wacht begrensd tot snapshots én releasevertakkingen
gereed zijn. `PUBLIC`, `anon`, `authenticated` en `service_role` hebben geen
execute-recht op de resetcommand.

## Verificatie

- Workspace: lint `30/30`, typecheck `30/30`, unit `30/30` en build `18/18`.
- Database: verse reset groen; gerichte S154/S159-pgTAP `90/90`; volledige
  RLS-suite `77` bestanden en `1.946` assertions; DB-lint exit `0` met alleen
  reeds bestaande meldingen buiten S159; migratieveiligheidscontrole groen.
- Control/browser: a11y effectief `36` groen en `1` bewuste live-skip. De brede
  Chromium-run leverde `190` direct groen, `23` bewuste live/visual-skips en
  door lokale devserver-geheugendruk `11` uitvallen plus `1` seriële
  vervolgtest; alle twaalf zijn daarna op frisse servers groen herhaald. De
  effectieve matrix is daarmee `202` groen en `23` bewuste skips.
- Player: effectief `126/126` groen nadat één service-workerregistratie na de
  elf minuten durende verzamelrun schoon `1/1` slaagde; de afzonderlijke
  offline/LKG-gate is `7/7` groen.
- Visueel: de bestaande FieldFlow-matrix met `64` cellen, de `44`
  Menu Studio-compatibilitygoldens en de `16` Static-LG-sportgoldens zijn
  groen. Nieuwe 1080p-goldens bewaken Royal blauw voor programma,
  tweekolomsuitslagen en bezoekers. De twee light-verjaardaggoldens zijn
  bewust vernieuwd omdat de volledige tokenprojectie de eerdere donkere kaart
  met onleesbare metadata corrigeert; beide zijn visueel gecontroleerd.
- Releaseveiligheid: volledige GitHub Actions-validatie inclusief actionlint,
  workflowshellsyntax, diffcheck en de operationele workflowharness zijn groen.

PR #178, CI en de exact-SHA staging-appdeployment zijn afgerond. De
diagnostische vervolg-PR, beide tenantreadbacks en productiedeployment staan
nog open na deze grens.

## Eerste operationele stagingbevinding

PR `#178` is met alle verplichte checks groen gemerged als
`4b46cdcab7a2b532628f22a4f66faf800a4ae6a6`. Deploymentrun `34295879948`
bouwde één immutable release en verifieerde staging-Control, staging-Player,
pairing en standalone-LG-herstel op exact die SHA.

De eerste twee tenantresetruns (`34296888846` en `34297349818`) stopten beide
vóór een bevestigde resetreadback bij de eerste databaseopdracht. De shell hield
de queryuitvoer in command substitution vast en beëindigde door `set -e`
voordat een veilige foutcategorie zichtbaar werd; de logs bewezen daardoor
alleen de verbinding en exitcode, niet de onderliggende datastatus. Productie is
daarom niet gestart. De vervolgcorrectie voegt een alleen-lezen, strikt
getypeerde preflight en fasebewuste, gesaneerde foutclassificatie toe; een
onbekende mutatietransportstatus wordt nooit als zekere rollback gepresenteerd.

## Bekende grenzen

- De fysieke LG wordt niet als lokaal getest geclaimd; Static-LG-contract- en
  browserregressies vormen de automatiseerbare grens.
- De operationele reset blijft fail-closed wanneer de exacte tenant niet in een
  omgeving bestaat of wanneer een publicatie/rollout niet veilig kan worden
  afgerond.
