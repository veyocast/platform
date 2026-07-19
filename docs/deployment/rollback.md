# Rollback en herstel

## Uitgangspunt

Een rollback heractiveert een eerder gebouwde, immutable applicatierelease. Hij
draait geen Supabase-migrations terug. Databaseherstel en applicatierollback zijn
bewust gescheiden incidentprocedures.

Rollback is veilig wanneer:

- de doel-SHA een ancestor van `main` is;
- `veyocast-control:<sha>`, `veyocast-player:<sha>` en
  `veyocast-marketing:<sha>` nog in dezelfde Rootless Docker-daemon bestaan;
- `/srv/apps/veyocast/releases/<sha>/RELEASE_METADATA` aanwezig is;
- de image-ID's exact overeenkomen met die metadata;
- de oude applicatie compatibel is met het huidige, vooruit gemigreerde schema;
- de Server Actions-key overeenkomt met de releasefingerprint.

## Automatisch herstel bij een mislukte deployment

`scripts/deploy-vps.sh` bewaart de bestaande `.env.runtime` totdat de kandidaat
volledig is gestart en lokaal én publiek gezond is. Als een fout optreedt nadat
mutatie is begonnen, probeert het script de vorige stabiele runtimeconfiguratie
opnieuw te activeren met `up -d --no-build --remove-orphans`.

De stabiele state wordt alleen na volledig succes atomisch bijgewerkt:

- `PREVIOUS_REVISION` krijgt de vorige `REVISION`;
- `REVISION` krijgt de nieuwe SHA;
- `.env.runtime` wordt vervangen;
- `RELEASE_MANIFEST` wordt geschreven.

Dit herstel is applicatieherstel. Een reeds toegepaste databasewijziging blijft
staan en moet backward-compatible zijn.

## Aanbevolen GitHub-rollback

Gebruik voor production altijd de workflow, zodat eerst staging wordt bewezen en
production opnieuw approval vereist.

1. Kies een eerder gezond verklaarde SHA uit `REVISION`,
   `PREVIOUS_REVISION` of releasehistorie.
2. Controleer de app/schema-compatibiliteit en leg incidentreden en gekozen SHA
   vast.
3. Open Actions → `Deploy VeyoCast` → `Run workflow` op branch `main`.
4. Kies `mode=rollback`.
5. Vul de volledige 40-teken-SHA in bij `release_sha`.
6. Vul exact `ROLLBACK` in bij `rollback_confirmation`.
7. Controleer dat `build-release` alleen bestaande image-ID's en metadata
   valideert en niets opnieuw bouwt.
8. Laat de release naar staging terugzetten en controleer alle staginghealth en
   functionele smoke tests.
9. Laat een required reviewer production bewust goedkeuren.
10. Controleer na production de healthmatrix en de functionele kernflows.

De workflow accepteert geen commit buiten `main`. In rollbackmodus is een oudere
main-SHA toegestaan; in normale releasemodus moet de SHA exact de actuele
`origin/main` zijn.

## Lokale noodrollback

Gebruik dit alleen wanneer GitHub Actions niet beschikbaar is en de operator al
veilig als `deploy` op de VPS werkt. Vul eerst de volledige environmentconfig in
via de goedgekeurde secretbron.

```bash
export GITHUB_SHA=<volledige-eerdere-sha>
export DEPLOYMENT_MODE=rollback
bash scripts/deploy-vps.sh staging rollback
bash scripts/deploy-vps.sh staging verify
```

Production volgt pas na een afzonderlijk stagingbewijs en een vastgelegde
menselijke goedkeuring:

```bash
export GITHUB_SHA=<dezelfde-volledige-eerdere-sha>
export DEPLOYMENT_MODE=rollback
bash scripts/deploy-vps.sh production rollback
bash scripts/deploy-vps.sh production verify
```

Laat secretwaarden niet in shell history, proceslijsten, tickets of logs achter.
De GitHub-route blijft daarom de standaard.

## Databaseherstel

Automatische database-down-migrations zijn verboden. Bij een onverenigbare of
schadelijke migration:

1. stop verdere productionapproval;
2. laat waar mogelijk de vorige applicatierelease draaien;
3. bepaal impact aan de hand van Supabase migration history en auditlogs;
4. maak een nieuwe forward-fixmigration, of herstel bewust vanuit een externe
   Supabase-back-up volgens het geldende databaseherstelplan;
5. bewijs tenantisolatie en RLS opnieuw;
6. doorloop daarna de volledige staging- en approvalflow.

Een databaseherstel kan data na het back-uppunt verliezen en vereist daarom een
aparte incidentbeslissing. Het deploymentscript voert dit nooit automatisch uit.

## Behoud en cleanup

Imagecleanup bewaart revisions die in `REVISION` of `PREVIOUS_REVISION` van
staging of production staan. Andere SHA-tags mogen gecontroleerd worden
verwijderd. Voor een rollback naar een oudere release buiten die set moet het
image eerst uit een betrouwbare immutable registry of back-up worden hersteld;
production mag het niet opnieuw vanaf bron bouwen.

Verwijder nooit Player last-known-good media of immutable playlistreleases als
onderdeel van een applicatierollback. Offline playback en database-releases zijn
een ander lifecyclecontract.

## Na de rollback

- controleer alle lokale en publieke healthroutes;
- test login, contentpublicatie, pairing en Player-playback;
- controleer dat `REVISION`, `PREVIOUS_REVISION` en `RELEASE_MANIFEST` kloppen;
- controleer Control-, Player- en Marketing-image-ID's;
- noteer de databaseversie en bevestig app/schema-compatibiliteit;
- maak een forward fix op een nieuwe branch en doorloop de normale releaseflow.
