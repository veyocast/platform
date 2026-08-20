# Theme-engine v2 — migratie-, rollback- en acceptatierunbook

## Veilige uitrol

1. Draai `scripts/migrations/s109-theme-engine-v2-dry-run.sql` read-only en
   archiveer de aantallen legacy/v2/ongeldige selecties.
2. Draai fresh `pnpm db:reset`, `pnpm test:rls` en de workspacegates.
3. Controleer staging Security Advisor: geen exposed tabel zonder RLS en geen
   nieuwe SECURITY DEFINER met PUBLIC/anon execute.
4. Maak één nieuwe v2-slide per oriëntatie; controleer snapshotref, resolved
   mode, fontloading, thumbnail en Playercache offline.
5. Gebruik voor bestaande slides alleen de expliciete convertactie na
   goedkeuring van `legacy-theme-mapping.v1.json`.
6. Publiceer via de normale immutable releaseflow. Wijzig geen feature flag en
   republish geen bestaande release als migratiestap.

## Rollback zonder database-restore

Stop eerst nieuwe v2-authoring in de applicatierelease. Nieuwe snapshots zijn
zelfdragend en blijven leesbaar. Voer daarna het gedocumenteerde rollbackscript
handmatig en in een gecontroleerd maintenancevenster uit. Dat script herstelt
de vorige snapshotwrapper en trekt nieuwe commandrechten in. Het verwijdert
geen snapshots, releases of brondata. Kolommen en overridehistorie blijven
bewust staan zodat vooruitrollen zonder restore mogelijk blijft.

## Fysiek LG-protocol

Test minimaal één conservatief webOS-model en één actueel model, landscape en
portrait, light en dark, met menu/prijslijst, stand, nieuws en wedstrijd.
Registreer model, firmware, resolutie, 30 minuten loop, 1.000 transitions, FPS,
dropped frames, memorytrend, temperatuur, offline reboot en fontloadstatus.
Geen Chromiumrun mag als fysiek bewijs worden gemarkeerd.
