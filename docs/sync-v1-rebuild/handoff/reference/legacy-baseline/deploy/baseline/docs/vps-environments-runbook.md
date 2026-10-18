# VPS staging en production

Dit historische S17-bestand is vervangen door de definitieve S19-documentatie:

- `docs/deployment/vps-deployment.md` — topologie, releaseflow en eerste uitrol;
- `docs/deployment/github-environments.md` — variables, secrets en protection;
- `docs/deployment/rollback.md` — applicatierollback en databaseherstel;
- `docs/deployment/deployment-audit.md` — gecontroleerde repository- en GitHub-status.

De oude containerproxy-, verouderde runnerlabel- en rebuild-per-environment-route
is ingetrokken. Caddy draait op de host, Docker publiceert uitsluitend op
localhost en production gebruikt exact de staging-gevalideerde SHA-images.
