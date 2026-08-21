# Menu Studio v2 rollout

## Doel en harde grenzen

Deze runbook geldt voor de additieve S112-release. De algemene deploymentcanon
in `docs/deployment/vps-deployment.md` blijft leidend. De code, migratie en
mediaworker mogen naar staging en production; tenantactivatie is een aparte,
expliciete beheerhandeling en hoort niet bij de deployment.

- Deploy alleen een actuele `main`-SHA via `.github/workflows/deploy.yml`.
- Bouw eenmaal op staging en promoveer exact dezelfde image-ID's naar
  production.
- Laat alle Menu Studio-flags standaard `false`.
- Voer geen backfill, automatische v1→v2-save, republish of release-mutatie uit.
- Behoud immutable snapshots, playlistreleases en Player last-known-good.
- Draai migrations uitsluitend forward; rollback is app/flag-rollback.

## Releasevolgorde

1. Bewijs lokaal `db:reset`, RLS, workspacegates, a11y/E2E, Player/offline en de
   volledige Menu Scene-matrix.
2. Merge de featurebranch volgens de beschermde GitHub-flow naar `main`.
3. Dispatch `Deploy VeyoCast` op `main` in `release`-modus met
   `deploy_target=production`. Deze ene run doet eerst staging en alleen na een
   gezonde stagingjob production.
4. De stagingjob voert migration-historycheck, dry-run en de additieve migration
   uit vóór de nieuwe containers worden geactiveerd.
5. De nieuwe worker gebruikt de 12-argumentenvariant van
   `complete_media_processing_job`; de bestaande 9-argumentenvariant blijft
   tijdens de rolling deployment beschikbaar. Verwijder die compatibiliteits-
   overload niet in deze release.
6. Controleer staginghealth en de bestaande pairing/recovery-smoke. Activeer
   geen tenantflag en maak geen klantdocument aan.
7. Laat production dezelfde geteste image-ID's promoveren, voer dezelfde
   forward migration uit en controleer alle publieke healthroutes.

De migration bevat geen destructive statements en herschrijft geen bestaande
`price_list`-configuratie. Bestaande video's zonder poster blijven bruikbaar in
hun bestaande flows, maar worden niet door Menu Studio geselecteerd totdat een
expliciete herverwerking een geverifieerde poster heeft gemaakt.

## Featureflags

De veilige activatievolgorde per pilottenant is:

1. `menu_document_v2_read_enabled` — dual-read en openen;
2. `menu_studio_v2_authoring_enabled` — concepten maken en opslaan;
3. `menu_studio_v2_linked_groups_enabled` — gekoppelde productgroepen;
4. `menu_studio_v2_media_enabled` — image/video/logo-blocks;
5. `menu_studio_v2_publish_enabled` — immutable snapshot maken;
6. `menu_studio_v2_player_enabled` — v2 in een nieuwe releasebundel toelaten.

Activeer steeds één tenant, leg actor en reden vast en wacht na iedere stap op
de observatievensters hieronder. `publish` en `player` gaan nooit aan voordat
read/authoring en de gebruikte optionele capabilities groen zijn. De binaire
staging- en productiondeployment in S112 laat alle zes flags uit.

Voorbeeld voor een later goedgekeurde pilot, uit te voeren via een
tenantbeveiligde beheerhandeling en niet als losse Data API-write:

```sql
select
  tenant_id,
  menu_document_v2_read_enabled,
  menu_studio_v2_authoring_enabled,
  menu_studio_v2_linked_groups_enabled,
  menu_studio_v2_media_enabled,
  menu_studio_v2_publish_enabled,
  menu_studio_v2_player_enabled
from public.tenant_settings
where tenant_id = :tenant_id;
```

### S113 operationele pilotbediening

S113 levert `.github/workflows/menu-studio-pilot-rollout.yml` als de
afzonderlijke beheerhandeling. De workflow:

- is alleen handmatig op `main` beschikbaar;
- gebruikt de gekozen beschermde `staging`- of `production`-Environment en
  uitsluitend diens databasecredential;
- vereist de exacte tenantnaam, volledige reeds gedeployde main-SHA, reden en
  bevestiging `MENU STUDIO PILOT`;
- controleert eerst de Control-health-SHA en de aanwezige S113-migratie;
- wijzigt exact één flag via de owner-only private databasefunctie;
- weigert een onbekende, dubbele of niet-actieve tenant en een overgeslagen
  dependency;
- schrijft alleen bij een echte mutatie een audit-event met flag, van/naar,
  GitHub-operator, reden en workflowrun;
- leest de gekozen flag na de transactie terug zonder tenantinhoud te loggen.

De private functie is expliciet niet uitvoerbaar door `anon`, `authenticated`
of `service_role`; dit is dus geen algemene Data API-backdoor. Gebruik voor
Duindorp SV zes afzonderlijke `enable`-runs in de hierboven vastgelegde
volgorde. Gebruik voor rollback afzonderlijke `disable`-runs in deze volgorde:

1. `player`;
2. `publish`;
3. `media` en `linked_groups`;
4. `authoring`;
5. `read`.

De oude route `/dashboard/slides/new` redirect vanaf S113 naar Menu Studio.
Bestaande legacy-slides blijven via hun bestaande detailroute beschikbaar;
hun configuraties, snapshots en releases worden niet geconverteerd of
verwijderd.

## Pre-deploy impact en locks

Voer read-only uit tegen elke doelomgeving; noteer alleen tellingen, nooit
configuratie- of klantinhoud in deploymentlogs.

```sql
select count(*) as existing_price_lists
from public.dynamic_slides
where type = 'price_list';

select count(*) as existing_menu_v2
from public.dynamic_slides
where configuration_json->>'schemaVersion' = 'menu-document.v2';

select count(*) as active_media_jobs
from public.media_processing_jobs
where status in ('queued', 'processing');

select locktype, mode, granted, count(*)
from pg_locks
where relation in (
  'public.tenant_settings'::regclass,
  'public.dynamic_slides'::regclass,
  'public.media_assets'::regclass
)
group by locktype, mode, granted
order by locktype, mode, granted;
```

Stop vóór production wanneer onverwachte langdurige niet-verleende locks,
out-of-order migrationhistorie of een groeiende actieve mediaqueue zichtbaar
zijn. Er is geen S112-backfillbatch waarvan de duur geschat of gevolgd moet
worden.

## Stagingverificatie

Verplicht na de deployment:

- `https://staging-control.veyocast.nl/api/health` meldt `status=ok`,
  `environment=staging` en de verwachte volledige SHA;
- `https://staging-player.veyocast.nl/healthz` meldt dezelfde SHA;
- de bestaande pairing/recovery-smoke is groen;
- migration history bevat `20260821151348_menu_studio_v2`;
- alle zes flags zijn voor alle tenants nog `false`;
- bestaande prijslijsten openen en spelen ongewijzigd;
- de mediaworker is ready en de queue groeit niet.

Een functionele Menu Studio-smoke met echte content gebeurt pas in een expliciet
goedgekeurde pilottenant. Gebruik daarvoor de featureflagvolgorde; publiceer
niet in een algemene stagingtenant.

## Productionverificatie

Controleer na promotie:

- `https://veyocast.nl/api/health`;
- `https://control.veyocast.nl/api/health`;
- `https://player.veyocast.nl/healthz`;
- alle antwoorden dragen exact de staging-SHA;
- production migration history bevat dezelfde S112-migration;
- tenantflags bleven uit en er zijn geen S112-operationlogs door de deployment;
- bestaande login, publicatie, pairing en playback blijven gezond;
- Player-heartbeats tonen geen toename van bundle-, checksum- of
  last-known-good-fouten.

## Observability en alerts

Volg ten minste de eerste 30 minuten op staging en production:

- aantal `menu_studio.*` audit-/operationevents per resultaatcode;
- `40001` revision conflicts en geweigerde capability-/tenantchecks;
- snapshot/publicatiefouten en duur;
- DOM-overflowrapporten per `contentFitVersion`;
- incomplete of checksum-mismatched releasebundles;
- Player activatie-/fallbackratio en last-known-good-behoud;
- mediaqueue queued/processing/failed, retryleeftijd en poster-/variantfouten;
- HTTP 5xx en healthstatus van Control, Player en worker.

Alarmeer direct bij tenantoverschrijding, geactiveerde v2-bundle zonder complete
assets, mutatie van een immutable snapshot/release, verlies van last-known-good
of een onverwacht ingeschakelde flag. Pauzeer rollout bij een foutpercentage
boven het normale platformbaseline of een aanhoudend groeiende mediaqueue.

## Rollback

Functionele rollback per tenant, in deze volgorde:

1. zet `menu_studio_v2_publish_enabled=false`;
2. zet `menu_studio_v2_authoring_enabled=false`;
3. zet optioneel media/groups/read uit;
4. laat reeds gepubliceerde v2-releases en `menu_studio_v2_player_enabled`
   ongemoeid zolang ze actief last-known-good vormen;
5. publiceer pas via een normale immutable publicatie een bewezen eerdere
   playlistinhoud; muteer nooit een bestaande release.

Applicatierollback volgt `docs/deployment/rollback.md`: heractiveer een bewezen
eerdere image-SHA, draai de database niet terug en verwijder geen S112-tabellen,
kolommen, assets, snapshots of operationlogs. De migration is
backward-compatible met de voorafgaande applicatie.

## Bekende platformgrenzen

- De repositoryvariantset is `original|thumbnail|player_1080p`; S112 introduceert
  geen parallelle 960/1920/3840-varianttaxonomie.
- Structurele MIME-, byte-, dimensie-, duur-, SVG- en checksumvalidatie is in
  de bestaande private mediapipeline geïntegreerd. De repository bevat geen
  afzonderlijke antivirusscanner; voeg die alleen als platformbrede,
  fail-closed ingestcapability toe.
- Productfamilies gebruiken de bestaande tenantproductcatalogus en stabiele
  optionele `familyId`; S112 introduceert geen tweede productmastertabel.
- Fysieke LG-hardwareacceptatie blijft een afzonderlijk releasebewijs; browser
  en LG Legacy-contracten, incomplete-bundleweigering en offline last-known-good
  zijn geautomatiseerd bewezen.
