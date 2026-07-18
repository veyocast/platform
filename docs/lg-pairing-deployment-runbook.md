# LG-koppelklaar deploymentrunbook

> Dit bestand beschrijft de oorspronkelijke single-environment deploymentkit.
> Voor de aparte staging- en productieomgevingen op de gedeelde deployment-VPS,
> self-hosted runners en Supabase-migraties is
> `docs/vps-environments-runbook.md` leidend.

## Doel en grens

Deze deployment levert één HTTPS Control-host, één HTTPS Player-host en een
doorlopende FFmpeg-mediaworker. De normale pagina **Schermen** gebruikt echte
tenantdata voor schermaanmaak, vlootstatus en veilige pairing.

Dit is de technische ingang voor de volgende fysieke LG-sprint. Het is nog geen
bewijs dat ieder LG webOS Signage-model service workers, opslag, autoplay,
screensaver, autostart en power recovery voldoende ondersteunt. Die claims mogen
pas na uitvoering van `docs/player/lg-physical-test-protocol.md` worden gemaakt.

## Productievereisten

- Linux-VPS met Docker Engine en Docker Compose v2;
- poorten 80 en 443 publiek bereikbaar;
- twee DNS-records naar de VPS, bijvoorbeeld `control.example.nl` en
  `player.example.nl`;
- een gemigreerd Supabase-project met de VeyoCast-migraties en minimaal één
  tenantbeheerder;
- een Supabase anon-key en een server-only service-role key;
- minimaal 2 GB vrij geheugen plus voldoende schijf voor imagebuilds en
  mediaverwerking;
- het exacte LG-model ondersteunt `Play via URL`, of een gelijkwaardige
  fullscreen URL-launchmodus.

## Secrets en configuratie

Kopieer buiten git het voorbeeld:

```bash
cp infra/production/production.env.example infra/production/production.env
```

Vul alle placeholders in. Gebruik voor `DEPLOYMENT_SHA` de volledige commit-SHA.
De service-role key komt alleen in de server-side Player- en workercontainers en
mag nooit met `NEXT_PUBLIC_` beginnen. Genereer de drie applicatiesecrets met een
cryptografisch veilige secretmanager. Commit `production.env` nooit.

Voor Device Lab gelden twee verschillende secrets:

- `DEVICE_LAB_ACCESS_TOKEN` is een tijdelijk supporttoken in de URL;
- `DEVICE_LAB_SESSION_SECRET` ondertekent de korte HttpOnly-sessie en bevat
  minimaal 32 willekeurige bytes.

## Reproduceerbaar bouwen

Voer vanaf de repositoryroot uit:

```bash
docker compose \
  --env-file infra/production/production.env \
  -f infra/production/compose.yaml \
  build
```

De images worden lokaal getagd als:

- `veyocast-control:<DEPLOYMENT_SHA>`;
- `veyocast-player:<DEPLOYMENT_SHA>`;
- `veyocast-media-worker:<DEPLOYMENT_SHA>`.

De webimages gebruiken Next.js standalone-output. De workerimage bevat FFmpeg en
start de begrensde, idempotente queue-runner. Caddy vraagt automatisch TLS aan en
routeert alleen de twee publieke webservices; het backendnetwerk van de worker is
intern.

## Starten en readiness

```bash
docker compose \
  --env-file infra/production/production.env \
  -f infra/production/compose.yaml \
  up --detach
```

Controleer daarna:

```bash
curl --fail https://control.example.nl/api/health
curl --fail https://player.example.nl/api/health
docker compose \
  --env-file infra/production/production.env \
  -f infra/production/compose.yaml \
  ps
```

Beide healthroutes moeten HTTP 200 en `status: ready` teruggeven. De Player moet
ook `pairing: ready` melden. De responses bevatten geen keys of tokens. Controleer
vervolgens in een gewone browser:

1. Control-login en tenantcontext;
2. **Schermen → Scherm aanmaken**;
3. Player-root toont een nieuwe code van zes tekens;
4. **Schermen → Player koppelen** claimt die code;
5. de Player verdwijnt uit de pairingstate en meldt heartbeats;
6. een gepubliceerde immutable release wordt volledig gedownload en pas daarna
   geactiveerd.

## Volgende sprint: fysiek LG-scherm koppelen

1. Leg model, serienummer, firmware, webOS Signage-versie, resolutie en
   oriëntatie vast.
2. Open `https://<PLAYER_HOST>` via `Play via URL`; gebruik geen HTTP-URL of
   IP-adres met een onbetrouwbaar certificaat.
3. Controleer dat er geen browserchrome, cursor of permanente watermark zichtbaar
   is en dat de code op kijkafstand leesbaar is.
4. Maak in Control eerst een scherm met dezelfde fysieke naam en locatie.
5. Neem de code exact over bij **Player koppelen**. Een bestaande actieve Player
   voor dat scherm wordt server-side ingetrokken voordat het nieuwe device actief
   wordt.
6. Publiceer één kleine, bekende H.264/AAC- of image-release en wacht op
   `PLAYING` plus een actuele heartbeat.
7. Voer daarna het volledige fysieke protocol en de Device Capability Lab-run uit.
8. Beslis pas op basis van dat bewijs of `Play via URL` volstaat of een dunne
   hosted LG-wrapper nodig is.

## Rollback

Wijzig `DEPLOYMENT_SHA` terug naar een eerder groen image-tag en start Compose
opnieuw. Database-releases en playlists blijven immutable. Een webrollback mag de
actieve last-known-good release of gecachte assets op de Player niet verwijderen.

## Bekende grenzen

- Supabase zelf wordt niet door deze legacy Compose-stack gehost of gemigreerd;
  de VPS-workflow migreert de externe staging- en productieprojecten wel.
- DNS, VPS, certificaatuitgifte en productiecredentials vereisen externe
  infrastructuur en zijn niet vanuit de repository te bewijzen.
- Device Lab-testmedia moeten vóór de fysieke run met
  `scripts/generate-lg-test-media.sh` worden gegenereerd en meegebouwd.
- De mediaworker heeft nog productie-observability, alerts en een dead-letter
  operatorflow nodig.
- Een fysieke LG-run en een 24-uurs soak blijven releasegates voor een
  productieclaim per model/firmware.
