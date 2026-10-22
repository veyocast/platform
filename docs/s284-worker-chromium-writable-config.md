# S284 — Herstel van Chromium in de renderworker

## Gevonden fout

De gemelde slide `Bezoekende teams` heeft één mislukte snapshot en drie mislukte
renderpogingen. De bewaarde foutcode is `dynamic_render_internal_error`.
Reproductie van exact die opgeslagen snapshot in de productiecontainer faalt
vóór de eerste framecapture: `chrome_crashpad_handler: --database is required`.
De container draait als `node`, met read-only root en uitsluitend `/tmp` als
schrijfbaar volume. `/home/node/.config` is daardoor niet schrijfbaar.

Dezelfde snapshot rendert in dezelfde container wel volledig met alleen
`XDG_CONFIG_HOME` en `XDG_CACHE_HOME` onder een eigen tijdelijke map: MP4,
4.981.619 bytes, 1920 × 1080, plus poster. Deze diagnose heeft geen queueclaim,
upload, databasewijziging of publicatie uitgevoerd. De volledige oorspronkelijke
fout en de geslaagde afzonderlijke render zijn lokaal privé bewaard.

## Wijziging

De worker-Compose zet twee vaste XDG-paden onder het bestaande `/tmp`-volume.
Het read-only rootbestandssysteem, de niet-rootgebruiker, capabilities, resource-
en netwerkgrenzen blijven behouden. De bestaande configuratievalidator vereist
deze exacte paden; de deploymentvalidatie wijst ontbrekende en verkeerd geplaatste
paden af. Er is geen wijziging aan slide-inhoud, schema, rechten, template,
locked assets, snapshotdata, publicaties of Player-LKG.

`apps/media-worker/scripts/chromium-smoke.ts` maakt echte liggende en staande
OnzeTrots-PNG's in de worker met zijn echte containerinstellingen. Het script
heeft geen database-, queue- of providertoegang en valideert formaat en afmeting.
Een queueheartbeat alleen bewijst geen werkende browsercapture.

## Verificatie en operationeel herstel

Voor commit: lint, typecheck en unitgates alle 30 taken geslaagd. De volledige
bestaande deploymentvalidatie slaagt met 226 tests, inclusief acht negatieve
XDG-cases. Een bestaande watchdogfixture overschreed lokaal eerst zijn 8s-grens;
de oorspronkelijke failures blijven bewaard. De ongewijzigde volledige suite
slaagt daarna; geen deadline, test, skip of productiegedrag aangepast.

Vier echte captures slagen met tijdelijke XDG-paden in de bestaande read-only
staging- en productiecontainers. Per oriëntatie zijn de PNG-checksums tussen
beide omgevingen exact gelijk. Dit is bewijs voor de runtimecorrectie; de
permanente uitrol moet daarna dezelfde captures zonder overrides doorlopen.

Daarna normale volledige CI en exacte staging- en
productie-uitrol; echte containercaptures en gecontroleerde retry van uitsluitend
de gemelde mislukte job. Voltooide snapshots of releases worden niet herschreven.
Uitrol- en herstelresultaten worden als operationeel bewijs bij de PR vastgelegd.

Primaire referenties:
[Chromium Linux-configuratie](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/user_data_dir.md),
[Supabase Data API-beveiliging](https://supabase.com/docs/guides/api/securing-your-api).
De Supabase-changelog is voor implementatie gecontroleerd; de aangekondigde TLS-
wijziging van 10 november verklaart deze lokale browserstartfout niet.
