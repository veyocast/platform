# FieldFlow Royal blue tenantreset

Dit runbook zet het FieldFlow-profiel van exact één gekozen tenant terug naar
het vaste, contrastrijke Royal blue-profiel. De reset is een afzonderlijke
operationele handeling na deployment: de migratie wijzigt bij het uitrollen van
de applicatie uit zichzelf geen tenantdata.

De huidige beoogde tenant is `Duindorp SV`. De workflow vult die naam standaard
in, maar de operator blijft verantwoordelijk voor het controleren van de exacte
zichtbare tenantnaam.

## Vast resetprofiel

De command zet atomisch vast:

- accent `#4169E1` en steunkleur `#7A5CE6`;
- vaste donkere modus met navy canvas en royal-blue oppervlakken;
- alle 26 lichte en alle 26 donkere semantische kleurtokens;
- witte club- en thuislogoplaten;
- `baseScale: 1.05` en `sportScale: 1.4`;
- Inter voor lopende tekst en Manrope voor koppen en wedstrijdnamen;
- themeversie `fieldflow@1.0.0` in zowel het canonical profiel als de
  compatibiliteitsmirror.

Na de reset blijven alle kleurrollen, fonts, logoplaten en schalen afzonderlijk
aanpasbaar via **Instellingen → Thema's → FieldFlow**.

## Veiligheidsgrenzen

Gebruik uitsluitend de handmatige workflow
`.github/workflows/fieldflow-royal-theme-reset.yml`. Deze workflow:

1. draait alleen vanaf de actuele `main`;
2. gebruikt het beschermde GitHub Environment `staging` of `production`;
3. accepteert uitsluitend een volledige lowercase Git-SHA van 40 tekens;
4. controleert die SHA tegen zowel de workflowcheckout als de opnieuw opgehaalde
   actuele remote `main`;
5. eist dat Control én Player op de doelomgeving gezond zijn en exact die SHA
   rapporteren;
6. controleert migratie `20260908224609`;
7. geeft de tenantnaam, auditreden, GitHub-operator en run-URL uitsluitend
   base64-gecodeerd aan SQL door;
8. roept als database-eigenaar exact
   `private.reset_tenant_fieldflow_royal_v1(...)` aan;
9. accepteert het resultaat pas wanneer de functie haar interne atomische
   profiel-, mirror-, rollout- en auditreadback met `verified: true` bevestigt;
10. leest aansluitend in een afzonderlijke post-commitquery het volledige palet,
    appearanceprofiel, de compatibility mirror, audit, revision, uitkomst en
    rollout-id exact terug. Deze extra query is afzonderlijk omdat een omringende
    PostgreSQL-statement-snapshot de writes van een aangeroepen functie niet
    betrouwbaar opnieuw projecteert;
11. wacht bij iedere bestaande of nieuwe rollout maximaal 72 keer vijf
    seconden op de status `ready` en stopt direct bij `failed`.

De private command is niet uitvoerbaar voor `PUBLIC`, `anon`, `authenticated`
of `service_role`. `SUPABASE_DB_URL` komt uitsluitend uit het gekozen protected
Environment en wordt niet gelogd.

## Voorwaarden

- De gereviewde S159-release is gemerged naar `main`.
- De normale deploymentworkflow is groen voor de doelomgeving.
- Control en Player draaien daar op dezelfde actuele volledige `main`-SHA.
- Migratie `20260908224609_s159_royal_theme_scale.sql` is door die deployment
  toegepast.
- De gekozen tenant bestaat exact één keer en heeft status `active`.
- Er is voor die tenant geen dynamische slideversie met status `publishing`.
- Het GitHub Environment bevat het bestaande secret `SUPABASE_DB_URL` en de
  geldende deployment approvals.

Voer de tenantreset eerst op staging uit. Ga pas naar productie nadat zowel de
normale productiedeployment als de stagingreset voor exact dezelfde SHA groen
zijn. Wanneer `Duindorp SV` niet in staging bestaat, moet de stagingreset
fail-closed blijven; maak geen tijdelijke of gelijknamige tenant aan om deze
controle te omzeilen.

## Staging uitvoeren

Haal de actuele `main` op en leg de volledige SHA vast:

```bash
git fetch origin main
release_sha="$(git rev-parse origin/main)"
test "${#release_sha}" -eq 40
```

Start vervolgens de bewaakte reset:

```bash
gh workflow run fieldflow-royal-theme-reset.yml \
  --repo veyocast/platform \
  --ref main \
  -f target_environment=staging \
  -f tenant_name='Duindorp SV' \
  -f release_sha="${release_sha}" \
  -f reason='S159 Royal blue-profiel na geslaagde stagingdeployment' \
  -f confirmation='ROYAL BLUE RESET'
```

Zoek de zojuist gestarte run en volg hem tot een terminale status:

```bash
gh run list \
  --repo veyocast/platform \
  --workflow fieldflow-royal-theme-reset.yml \
  --event workflow_dispatch \
  --branch main \
  --limit 5

gh run watch <RUN_ID> --repo veyocast/platform --exit-status
```

Een groene run meldt één van deze twee geldige uitkomsten:

- het profiel wijzigde en alle nieuwe snapshots en releasevertakkingen zijn
  gereed;
- het profiel was al exact gelijk (`noop`) en een eventuele bestaande rollout
  voor dezelfde revision is eveneens gereed. Alleen wanneer voor die revision
  nooit een rollout bestond, is er niets om te volgen.

## Productie uitvoeren

Controleer eerst dat de expliciete productiedeployment van `release_sha` groen
is. De resetworkflow deployt zelf geen applicatie en migreert geen database.

```bash
gh workflow run fieldflow-royal-theme-reset.yml \
  --repo veyocast/platform \
  --ref main \
  -f target_environment=production \
  -f tenant_name='Duindorp SV' \
  -f release_sha="${release_sha}" \
  -f reason='S159 Royal blue-profiel na goedgekeurde productiedeployment' \
  -f confirmation='ROYAL BLUE RESET'
```

Volg ook deze run expliciet:

```bash
gh run list \
  --repo veyocast/platform \
  --workflow fieldflow-royal-theme-reset.yml \
  --event workflow_dispatch \
  --branch main \
  --limit 5

gh run watch <RUN_ID> --repo veyocast/platform --exit-status
```

Controleer daarna in Control voor `Duindorp SV` de FieldFlow-preview en ten
minste één actief horizontaal en één actief verticaal scherm. De workflowreadback
is leidend voor de opgeslagen waarden; de schermcontrole bewijst daarnaast de
praktische presentatie op kijkafstand.

## Immutable rollout en Player-LKG

De reset overschrijft geen bestaande snapshot of playlistrelease. Bij een
werkelijke profielwijziging verhoogt de database eerst de theme-revision en
maakt de bestaande themeplanner nieuwe tenantgebonden snapshots. Pas nadat alle
renderjobs klaar zijn, worden nieuwe immutable releasevertakkingen opgebouwd en
worden actieve scherm-, groep- en planningpointers gecontroleerd omgezet.

Tot dat moment blijft de oude release actief. Een Player die tijdelijk offline
is, blijft zijn last-known-good release afspelen. Een onvolledige of mislukte
theme-uitrol kan daarom geen gedeeltelijk palet activeren en maakt bestaande
playback niet zwart. De uiteindelijke Playerwissel blijft plaatsvinden op de
bestaande item- of loopgrens.

## Fouten en herstel

- **SHA-, main- of healthcontrole faalt:** deploy eerst de actuele `main`
  opnieuw via de normale releaseflow. Vul nooit een andere SHA in om de guard te
  omzeilen.
- **Tenant ontbreekt, is niet uniek of niet actief:** stop en corrigeer de
  tenantadministratie via de bevoegde beheerroute. Maak geen directe SQL-update.
- **Actieve slidepublicatie:** wacht tot die publicatie terminal is en start
  daarna dezelfde reset opnieuw.
- **Rolloutstatus `failed`:** de workflow stopt onmiddellijk. De oude actieve
  releases en Player-LKG blijven behouden. Onderzoek de begrensde foutstatus in
  het tenantthema-overzicht, herstel de oorzaak en gebruik daarna de bestaande
  bevoegde actie **Uitrol opnieuw proberen**. Een identieke theme-reset blijft
  bewust een no-op en maakt geen misleidend tweede auditrecord.
- **Wachttijd verstreken:** de achtergrondjobs kunnen veilig doorgaan. Start
  geen productierun en herhaal de reset niet blind; controleer eerst de bestaande
  rollout-id in Control. Bij gereedkomen is geen nieuwe reset nodig.

Er bestaat geen automatische database-downmigration voor deze handeling. Een
latere stijlwijziging loopt via een nieuwe bevoegde theme-save en dezelfde
immutable rolloutgrens.
