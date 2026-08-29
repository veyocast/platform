# S130 — LED Scores live URL-test

## Doel en grens

Deze tijdelijke test stelt vast of LED Scores een externe afbeeldings-URL één
keer importeert, bij heropening opnieuw ophaalt of periodiek blijft verversen.
De test wijzigt geen scherm, playlist, productiedata of WebSocket en staat los
van de VeyoCast Player- en releasecontracten.

## Publiek contract

Control levert op een capability-URL rechtstreeks een PNG-response:

- exact 480 × 270 pixels;
- Nederlandse datum in `Europe/Amsterdam`;
- tijd met seconden;
- zes tekens lange willekeurige requestcode;
- vaste tekst `VEYOCAST LIVE URL TEST`;
- `Content-Type: image/png`;
- `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`;
- `Pragma: no-cache`;
- `Expires: 0`;
- aanvullend `Surrogate-Control: no-store` en `X-Content-Type-Options: nosniff`.

De route is expliciet dynamisch. Iedere geldige aanvraag rendert nieuwe bytes;
er is geen HTML-, bestand- of applicatiecache. Een ongeldige capability geeft
een kale, cachevrije 404 en verraadt niet waarom toegang geweigerd is.

## Beveiliging en privacy

De URL bevat een lokaal gegenereerde 86 tekens lange capability-token. Alleen
de SHA-256-digest staat in de routecode; de token zelf staat niet in Git, runtime
configuratie of logs. Vergelijking is constant-time. Intrekken of roteren gebeurt
door de digest of tijdelijke route te verwijderen en via de gewone immutable
releaseworkflow uit te rollen.

Een begrensde in-memory limiter laat per Control-instance maximaal 90 aanvragen
per minuut per bron en 300 per minuut totaal toe. Dit ondersteunt een test op
één request per seconde maar stopt een onbeperkte lek- of abuseflow. Limiterstate
is tijdelijk en verdwijnt bij een veilige containerherstart.

Iedere geldige aanvraag schrijft exact één gestructureerd event:

```text
led_scores.live_image.requested
```

De velden zijn alleen `outcome`, `request_code`, `served_at` en `status`. Token,
URL, IP-adres, forwarded headers en user-agent worden niet gelogd. Op de
productiehost kan een bevoegde operator de events zien met:

```bash
docker logs veyocast-production-control-1 --since 30m 2>&1 \
  | jq -c 'select(.event == "led_scores.live_image.requested")'
```

## Interpretatie

- Eén event direct na opslaan en geen nieuwe events: LED Scores importeert de
  afbeelding eenmalig.
- Een nieuw event na wegschakelen en teruggaan, maar niet tussendoor: LED Scores
  haalt de URL alleen bij openen of heropenen op.
- Events met een terugkerend tijdsinterval terwijl de afbeelding zichtbaar
  blijft: LED Scores ververst continu; de timestamps tonen het werkelijke
  interval.
- Een event pas na applicatie- of schermherstart: LED Scores bewaart een lokale
  kopie totdat de runtime opnieuw start.

Zonder de capability daadwerkelijk in LED Scores in te voeren kan alleen het
servercontract worden bewezen; het clientgedrag blijft dan expliciet
`NIET_GETEST`.

## Verwijderen

Verwijder de route, `apps/control/lib/led-scores-live-image.ts`, de gerichte test
en het observability-event en rol een nieuwe immutable release uit. Er zijn geen
database-, Storage-, scherm- of playlistrecords om op te ruimen.
