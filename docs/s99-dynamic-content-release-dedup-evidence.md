# S99 — inhoudsgestuurde dynamische publicatie

## Probleem

Een periodieke Sportlink-check kon dezelfde bronrevisie tweemaal verhogen.
Daarnaast bevatte de snapshothash een nieuw `generatedAt`-tijdstip. Daardoor
leek inhoud bij iedere check gewijzigd en ontstonden onnodig een snapshot,
PNG-fallback, immutable playlistrelease en Playerdownload. Het getal
`Versie 969` was dus een echte releaseversie, niet de hoeveelheid lokaal
opgeslagen bestanden op de Player.

## Nieuwe keten

```text
providercheck
  → genormaliseerde data opslaan
  → bronrevisie exact eenmaal verhogen
  → canonieke Playerinhoud hashen (zonder observatietijd)
  ├─ gelijk: alleen synchronisatiestatus/tijd bijwerken
  └─ gewijzigd: snapshot → render → één gecoalesceerde immutable release
                 → desired release → geverifieerde Playercache
```

Fallbackassets krijgen een deterministische identiteit uit tenant, template en
inhoudshash. Twee gelijke renders registreren daardoor hetzelfde mediabestand.
De afronding controleert pad, checksum, bytes en afmetingen voordat bestaand
materiaal mag worden hergebruikt.

## Bewaargaranties

- Bestaande releases blijven immutable en activeerbaar; geschiedenis wordt niet
  destructief herschreven om een lager versienummer te tonen.
- De Player houdt zijn last-known-good release vast totdat een complete nieuwe
  release lokaal staat en geverifieerd is.
- Een ongewijzigde check maakt geen snapshot, renderjob, fallbackasset, release,
  desired-releasewijziging of nieuwe download.
- Een echte inhoudswijziging blijft atomisch door dezelfde releaseketen gaan.

## Regressiebewijs

De databaseproeven bewijzen onder meer:

- één bronrevisie per succesvolle Sportlinksync;
- geen nieuwe snapshot of renderjob bij identieke Sportlinkinhoud;
- geen nieuwe snapshot bij een ongewijzigde handmatige refresh;
- één content-addressed media-asset voor gelijke fallbackoutput;
- veilige validatie bij het hergebruiken van die asset.
