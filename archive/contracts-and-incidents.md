# Behouden contracten en incidentkennis

Herstelbasis: `20729be35d38dc8eb67b836160632ac7c3ea5153`. De overdracht en
canonbesluiten staan in `docs/sync-v1-rebuild/DECISIONS.md`; L01–L36 worden
bijgehouden in `execution/logica-pariteit.csv`. Dit archief bevat verwijzingen,
geen tweede runtime of operationele dataset.

- S185: `docs/s185-current-publication.md`, huidige publicatie en targetrevision
  los van live datarevisie; immutable configuratie, eerste frame en natuurlijke
  grens. Een bronhashwijziging maakt niet automatisch een playlistrelease.
- S210/S211: begrensde queues, polling, retentie en databasebelasting. De oude
  cutover/reset was historisch; S226 herschrijft of reset geen operationele data.
- S217/S218: Studio-bibliotheek en Player-serverrenderer moeten bruikbaar blijven
  zonder dat ieder ontwerp eerst naar een nieuw videobestand wordt gerenderd.
- S221: een nulhoogte- of niet-paintbaar HTML/CSS-canvas is geen framebewijs;
  de gecontroleerde fallback en expliciete LG-canvasgeometrie blijven behouden.
- S222: duurafhankelijk eindig transcodebudget en passende mediajoblease;
  bronretry houdt assetidentiteit en hoeft geen nieuwe upload te maken.
- S223/S224/S225: veilige force-sync zonder pairing/cacheverlies; lokale LG
  Blob/Range/HTTPS-keuze, videomediafout en timerherstel mogen publicatie en
  last-known-good niet blokkeren. Bestaande regressies blijven in de suite.
- Android general en TV houden `nl.veyocast.player` met aparte monotone
  versionCode-reeksen; Control houdt `nl.veyocast.control`. Signing/Play en
  package-/gegevenscontinuïteit worden niet uit een debugbuild afgeleid.

Oude bron en de twee vervangen CSS-modules blijven herstelbaar via Git-history.
Iedere daadwerkelijke verwijdering staat met resolved pad en opvolger in het
opruimregister. De 178 geïnventariseerde branches zijn behouden; unieke commits
zijn afzonderlijk geregistreerd. Er wordt geen volledige branchcleanup geclaimd.
