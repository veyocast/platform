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

Competition discovery uses the club `teams` and `poulelijst` responses. Direct
`poulecode` values are combined with pool rows matching the club team codes,
deduplicated and capped before `poulestand` is requested. The worker does not
call `teampoulelijst` with an incomplete argument set: the live contract
requires both `teamcode` and `lokaleteamcode`, while the verified `teams`
response does not provide a usable local-team code for that dependency.

The `teams` article may return the same team code once per competition
context. VeyoCast stores one canonical team and retains the separate
competition type, name, phase/class and pool contexts as bounded options.
Program and result slides can therefore be scoped to a team and to an exact
competition, cup or phase without treating provider duplicates as distinct
teams.

The `teams` article is also the authoritative client-scoped club-team set for
Control. Opponents that occur in matches or standing rows remain renderable
content, but are never promoted into the team selector. If Sportlink uses a
different identifier for the same own team in a match or standing, VeyoCast
may associate it by normalized team name only with an existing client team;
that does not create an extra selectable opponent.

The official `clublogo` PNG is normalized server-side to a bounded WebP and
stored once under the tenant media path by content hash. Sportlink slide
snapshots use it only when the tenant has no explicit Studio brand logo. The
asset is included in immutable Player releases and local offline cache; neither
the browser Player nor LG Legacy hotlinks the provider.

Stable provider errors are mapped by code: 4001 condition unavailable, 4002
required argument, 4011 token invalid, 4012 Client ID invalid, 4031 missing
scope, 4041 unknown article and 5001 provider failure. Empty arrays and 4001 for
conditional statistics are availability states, not destructive sync failures.

## Capability boundary

### Verjaardagen

Het officiële `verjaardagen`-artikel accepteert `aantaldagen` tot en met 21 en
levert de publieke velden `verjaardag` en `volledigenaam`. VeyoCast vraagt altijd
het maximale venster server-side op en selecteert het ingestelde kortere venster
op afspeeltijd. De Client ID is voldoende; deze capability hangt niet af van een
Token Club.Data. Het artikel bevat geen gedocumenteerd betrouwbaar geboortejaar.
Leeftijd komt daarom uitsluitend uit tenantveilige importprovenance en nooit uit
naam, teamcategorie of rol.

Team en rol komen alleen uit exact gekoppelde `team-indeling`-records. Eén
lidcode mag meerdere teamtoewijzingen verenigen; dubbele namen zonder unieke
identiteit blijven onverrijkt en verschijnen in een handmatige conflictlijst.
Toegestane foto's gebruiken de private providerassetcache en worden alleen
gekoppeld wanneer dezelfde identiteit bewezen is.

Club, teams, competitions, matches, results, standings, cancellations and
activities are synchronized by the production worker. Match information is
refreshed through the bounded upcoming-match group. Facilities and sponsors
are allowlisted provider capabilities for subsequent dataset expansion; they
are not presented as synchronized until a successful worker run records that
capability. Public-person datasets are implemented in the registry but default
off and require explicit privacy activation. `adresboek` and every `mijn-*`
financial/personal article are excluded; VeyoCast implements no Sportlink OAuth
member portal.

The supported canonical datasets can feed fixed Player-rendered Sportlink
slides. Control offers portrait/landscape and light/dark variants plus a
bounded row count. Match-driven slides additionally offer canonical team and
competition/phase filters after both Teams and Matches have completed at least
one successful synchronization. Publication freezes the normalized content and
selection in the release; the Player renders locked HTML/CSS and retains the
PNG generated from the same snapshot as offline/legacy fallback. This does not
broaden the provider or privacy boundary.

Local discovery reads `SPORTLINK_CLIENT_ID` without printing it. Application
connections additionally require `SPORTLINK_CONFIG_ENCRYPTION_KEY` of at least
32 characters. Never commit either value. The VPS Compose boundary injects the
already stable server-actions AES key under this dedicated environment name.
Rotating it therefore requires controlled Sportlink credential re-encryption
or tenant reconnection; it is never exposed to a browser bundle.
