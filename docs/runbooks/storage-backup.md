# Storage-back-up en herstel

## Keuze

VeyoCast kiest voor dagelijkse, immutable objectkopieën naar een tweede
S3-compatibele provider in een andere EU-regio. Dit is onafhankelijk van de
primaire Supabase-databaseback-up. Een heruploadprocedure alleen is onvoldoende
voor signagecontent en is daarom slechts een noodfallback.

`scripts/backup-supabase-storage.sh` kopieert `tenant-media` met checksums naar
een gedateerd herstelpunt en schrijft een manifest. De job gebruikt twee apart
geconfigureerde rclone-remotes:

- `RCLONE_SOURCE_REMOTE`: read-only Supabase Storage S3 credentials;
- `RCLONE_BACKUP_REMOTE`: write-only credentials voor de secundaire bucket.

Secrets staan als mode-600 rclone-config op de production VPS of in een
gelijkwaardig secret store, nooit in Git. Zet bucket versioning/object lock en
EU-residency aan. Lifecycle: 35 dagelijkse herstelpunten plus minimaal vijf
wekelijkse herstelpunten, na juridische bevestiging.

## Verificatie

Dagelijks: exitcode, objectaantal, bytes en manifest naar monitoring. Maandelijks:
herstel een willekeurige tenantprefix naar een geïsoleerde tijdelijke bucket,
vergelijk checksums en laat een Player de herstelde release valideren. Verwijder
de tijdelijke kopie na bewijsregistratie.

## Open configuratie

Voor activering zijn provider, EU-regio, bucketnaam, object-locktermijn,
credentials en kostenlimiet nodig. Zonder die keuzes is het script voorbereid
maar draait er nog geen storageback-up.

