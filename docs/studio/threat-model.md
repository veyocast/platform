# VeyoCast Studio — threat model

## Beschermde waarden

- tenantontwerpen en immutable revisies;
- bronmedia en generated media;
- worker service-role;
- private storagepaden en signed transport;
- immutable playlistreleases;
- CPU, geheugen, tempopslag en queuecapaciteit.

## Grenzen en maatregelen

| Dreiging | Maatregel |
|---|---|
| Cross-tenant project- of media-ID | tenant-aware composite FK’s, RLS en RPC-validatie |
| Asset-ID alleen in JSON vervalsen | immutable `studio_revision_assets`-relatie met composite FK |
| Silent overwrite | expected revision en expliciete conflictuitkomst |
| Mutable renderinput | iedere render verwijst naar één immutable revision |
| Dubbele media door retry | idempotency receipt, gereserveerd media-ID en replay-safe completion |
| Onveilige workeractie | service-role-only RPC’s, joblease en worker-ID-controle |
| Externe font-/assetinjectie | vaste registry, ready tenantassets en veilige data-URI’s |
| SVG/XML-injectie | eigen serializer en escaping; geen user-SVG of HTML |
| FFmpeg commandinjectie | vaste argumentenarray en `shell: false` |
| Zip-/pixel-/framebomb | artboard-, laag-, duur-, byte- en assetlimieten |
| Queue-DoS | tenantquota, idempotency, max attempts en begrensde concurrency |
| Signed URL in logs | alleen veilige foutcodes en identifiers |
| Playerregressie | uitsluitend normale ready media; geen Studio-runtime in Player |
| Publicatie stil wijzigen | iedere export maakt standaard nieuwe media; releases blijven immutable |
| Lokale recovery na logout | tenant-ID in IndexedDB-key en database verwijderen bij contextwissel/logout |

## Niet vertrouwde input

- volledige Studio-documenten uit Control;
- namen en teksten;
- QR-inhoud;
- media-ID’s;
- render- en mutationparameters;
- alle databasevelden die de worker claimt.

Clientvalidatie is alleen ergonomie. Servercommands en worker valideren opnieuw
met het gedeelde versioned contract. De renderer behandelt tekst als tekst en
plaatst geen userinput als uitvoerbare markup.

## Restrisico’s

- Zeer complexe geldige documenten kunnen de renderduur verhogen; benchmark en
  queuequota blijven vóór brede uitrol vereist.
- Font- of rendererupgrades kunnen pixels wijzigen; registry- en
  rendererversies moeten daarom onderdeel van de rendersignature blijven.
- Tenantmedia kan persoonsgegevens of auteursrechtelijk materiaal bevatten;
  bestaand media-, verwijder- en privacybeleid blijft van toepassing.
