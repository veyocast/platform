# Sportlink Club.Dataservice

Status: conditional production integration, discovered 2026-07-28.

VeyoCast uses only the official `https://data.sportlink.com` API. The
JavaScript/jQuery library is a discovery reference, never a runtime dependency.
The tenant Client ID is tested server-side, AES-256-GCM encrypted and represented
in public data only by a masked suffix.

## Verified contract

`/list` returned 71 articles. All requested public articles exist. Live,
credential-safe GET probes returned:

| Article | Result |
|---|---|
| clubgegevens | object with `gegevens` and `bezoekadres` |
| clublogo | raw PNG, not JSON |
| teams | 32 records |
| programma | 5 records |
| uitslagen | valid empty array |
| afgelastingen | valid empty array |
| verenigingsactiviteiten | valid empty array |

Dependent team, pool, standing and match-information calls were also verified.
`wedstrijd-informatie` already contains venue, dressing-room and official
subobjects and is preferred over N+1 detail requests.

Stable provider errors are mapped by code: 4001 condition unavailable, 4002
required argument, 4011 token invalid, 4012 Client ID invalid, 4031 missing
scope, 4041 unknown article and 5001 provider failure. Empty arrays and 4001 for
conditional statistics are availability states, not destructive sync failures.

## Capability boundary

Club, teams, competitions, matches, results, standings, cancellations and
activities are synchronized by the production worker. Match information is
refreshed through the bounded upcoming-match group. Facilities and sponsors
are allowlisted provider capabilities for subsequent dataset expansion; they
are not presented as synchronized until a successful worker run records that
capability. Public-person datasets are implemented in the registry but default
off and require explicit privacy activation. `adresboek` and every `mijn-*`
financial/personal article are excluded; VeyoCast implements no Sportlink OAuth
member portal.

Local discovery reads `SPORTLINK_CLIENT_ID` without printing it. Application
connections additionally require `SPORTLINK_CONFIG_ENCRYPTION_KEY` of at least
32 characters. Never commit either value. The VPS Compose boundary injects the
already stable server-actions AES key under this dedicated environment name.
Rotating it therefore requires controlled Sportlink credential re-encryption
or tenant reconnection; it is never exposed to a browser bundle.
