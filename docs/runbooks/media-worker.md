# Runbook — media-worker errors en retries

## Signaal

Meer dan vijf fouten per vijf minuten of meer dan tien retries per vijftien minuten.

## Herstel

1. Open de gefilterde mediabibliotheek en groepeer uitsluitend op bounded errorcode.
2. Controleer worker health, readiness, CPU, geheugen en tijdelijke opslag.
3. Bij één corrupt bronbestand: laat de job definitief falen en geef de gebruiker de concrete herstelactie.
4. Bij infrastructuurfout: drain de worker, herstel de dependency en hervat leases veilig.
5. Rollback de image volgens `docs/deployment/rollback.md` wanneer de fout aan de huidige revision begon.

Eigenaar: Platform operations.
