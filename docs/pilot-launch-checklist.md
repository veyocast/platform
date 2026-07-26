# Lokale pilotchecklist

Een open blokkade betekent dat de sessie niet als geslaagd of klantgeschikt
wordt aangemerkt.

## Omgeving

- [ ] Node 24 en pnpm 11 zijn actief.
- [ ] Docker en de lokale Supabase-stack zijn gezond.
- [ ] Database-reset en RLS-tests slagen.
- [ ] Alleen lokale keys zijn als procesvariabelen gezet.
- [ ] De service-role key heeft geen NEXT_PUBLIC_-prefix.
- [ ] Chrome of Edge met een schoon Player-profiel is beschikbaar.

## Quality gates

- [ ] pnpm lint slaagt.
- [ ] pnpm typecheck slaagt.
- [ ] pnpm test slaagt.
- [ ] pnpm build slaagt.
- [ ] pnpm test:a11y slaagt.
- [ ] pnpm test:player slaagt, inclusief offline tests.
- [ ] pnpm test:e2e -- --project=chromium slaagt.
- [ ] De opt-in live-pilot Playwright-test slaagt met lokale Supabase.

## Live bedieningscontrole

- [ ] Login maakt een server-side Supabase-sessie en laadt tenantrollen.
- [ ] Pilotflow toont Live Supabase, niet Demomodus.
- [ ] Een geldig PNG/JPEG/WebP-bestand wordt geverifieerd en private opgeslagen.
- [ ] Een concept met de gereedstaande media kan worden gemaakt.
- [ ] Publiceren maakt een immutable release en wijst die aan het scherm toe.
- [ ] De Player toont eerst Koppelcode maken en daarna een tijdelijke code.
- [ ] Control claimt de code zonder het device-token te ontvangen.
- [ ] De Player verifieert het volledige manifest vóór PLAYING.
- [ ] Gewenste en actieve release zijn apart zichtbaar in Control.
- [ ] Heartbeat werkt en Laatst gezien wordt bijgewerkt.
- [ ] Last-known-good playback blijft zichtbaar bij tijdelijk netwerkverlies.

## Nog blokkerend voor bredere klantpilot

- [x] De media-worker claimt jobs, verwerkt private Storage-objecten en schrijft
      status, metadata en checksums atomisch terug.
- [x] MP4-upload en FFmpeg-transcoding zijn lokaal live end-to-end gevalideerd;
      zie `docs/s16-control-authoring-evidence.md`.
- [ ] De volledige reliability matrix en 24-uurs mixed-media soak uit
      docs/testing-launch-gates.md zijn groen.
- [ ] Productie-auth, keybeheer, monitoring, backup en incidentproces zijn
      ingericht en beoordeeld.
- [ ] Pilotcontent, devicehardware en netwerkcondities zijn goedgekeurd.
- [ ] Alle afwijkingen hebben een eigenaar en vervolgdatum.

## LG webOS Signage IPK

- [ ] De zelfstandige 1.0.2-smoketest start op LG 43UL3J-EP na een koude
      powercycle met `Startmodus applicatie: Lokaal`.
- [ ] De IPK is met de ongewijzigde gepinde `@webos-tools/cli` en het
      `signage`-profiel gebouwd en met
      `ares-package --info` en `--info-detail` geïnspecteerd.
- [ ] De kandidaat gebruikt aantoonbaar dezelfde officiële package-envelope
      als de door het scherm geaccepteerde 1.0.0.
- [ ] De SHA-256 in `latest.json` komt exact overeen met het aangeboden
      IPK-bestand én het bewaarde CI-artifact.
- [ ] Het exacte LG-model, webOS Signage-platform en de firmware zijn
      geregistreerd.
- [ ] Partnerdocumentatie bevestigt alle benodigde appmetadata, permissions,
      distributie- en signingvereisten voor dit model.
- [ ] Installatie, launch, fullscreen, remote input, pairingbehoud,
      netwerkherstel, rendererherstel en reboot zijn fysiek bewezen.
- [ ] De volledige twintigpuntenmatrix uit
      `docs/platforms/lg-webos-signage-ipk.md` is afgetekend.
- [ ] Een 24-uurs mixed-media soak is zonder zwart scherm, reload-loop of
      ongecontroleerde geheugengroei afgerond.

## Aftekenen

| Veld | Waarde |
|---|---|
| Datum en tijd | |
| Git commit | |
| Operator | |
| Player-target en browserversie | |
| Uitkomst | geslaagd / geblokkeerd |
| Afwijkingen en vervolgactie | |
