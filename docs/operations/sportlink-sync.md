# Sportlink sync operations

Policies support `hourly`, `daily`, `weekly` and `monthly` per connection and
dataset group. Defaults are hourly for matches/details and daily for the club
profile (including the tenant logo) and other public groups. Due work is leased
per connection/group; overlap is rejected and manual syncs use a cooldown.

The club profile is checked once per day. The worker fetches the official
Sportlink club logo, compares its content checksum and keeps the existing
immutable provider-media version when the bytes are unchanged. A changed logo
gets a new content-addressed version and the tenant's club link is updated;
unchanged data therefore does not create new snapshots or releases.

The media worker polls the lease dispatcher every fifteen seconds. A database
lease and unique running-group index prevent overlapping work for the same
connection and dataset group. Failed work is safely retried after fifteen
minutes without deleting normalized data.

Run completion qualifies the persisted `read_count` column and keeps the
standing counter under a distinct PL/pgSQL variable name. This prevents a
valid provider response from being flattened into
`SPORTLINK_SYNC_INTERNAL_ERROR`. The recovery migration only brings policies
forward when their last failed run carried that code or the repaired
competition-argument code; last-known-good normalized data is retained.

The official Teams response can repeat one `teamcode` for competition, cup,
phase and pool contexts. Normalize those rows to one canonical team before the
set-based database upsert and retain the distinct contexts in
`sports_teams.metadata.competitionOptions`. The database repeats this
deduplication defensively, because two equal conflict keys in one
`INSERT .. ON CONFLICT DO UPDATE` statement would otherwise abort the complete
run. A recovery migration immediately requeues enabled Teams policies whose
previous run ended in `SPORTLINK_SYNC_INTERNAL_ERROR`; it does not clear the
last-known-good dataset.

Control team filters must be populated only from these normalized `teams`
rows. Match home/away teams and standing rows contain opponents and may enrich
availability, competition and season context, but must not create selectable
teams. The completion worker also stores the official client club logo as a
content-addressed tenant media asset. The corresponding RPC is service-role
only and validates tenant path, hash, MIME type, dimensions and file size
before linking it to `sports_clubs`.

Dependency order:

1. club and capabilities;
2. teams;
3. pool/competition relations;
4. program, results and cancellations;
5. standings;
6. the bounded upcoming-match refresh;
7. activities.

Public-person and volunteer groups are in the allowlisted registry and default
off. De birthday-submodule van `public_people` draait na de afzonderlijke
`privacy_birthdays_enabled`-activatie dagelijks via Client ID; een ontbrekende
of ongeldige Token Club.Data blokkeert dit pad niet. Vrijwilligers en overige
persoonsfeeds blijven uitgeschakeld zonder hun eigen privacygrondslag.

Retry only transport, 429 and 5xx failures with bounded exponential backoff and
jitter. Never retry 4001/4002/4012/4031/4041 as transient failures. Record safe
codes and normalized read counts; the run schema reserves add/change/skip/
deactivate counters for expanded per-record telemetry. Never log request URLs
containing `client_id`.

Stale data remains visible in Control. It is not deleted from Player releases.
Program items expire after their configured window; cancellation, dressing-room
and official data expire after match day. Birthday snapshots are retained as
Last Known Good for at most 21 days, while the Player filters expired birthday
dates again at local playback time and skips an empty result without a frame.

For match-driven slides, Control may persist a bounded canonical
`sportTeamExternalId` and `sportCompetitionExternalId`. Both identities are
validated against the tenant's Sportlink connection. Filtering happens while
building the immutable snapshot and before the row limit; the frozen snapshot
also records the human-readable team and competition/phase selection.
