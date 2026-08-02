# Sportlink sync operations

Policies support `hourly`, `daily`, `weekly` and `monthly` per connection and
dataset group. Defaults are hourly for matches/details, weekly for club profile
and daily for other public groups. Due work is leased per connection/group;
overlap is rejected and manual syncs use a cooldown.

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

Dependency order:

1. club and capabilities;
2. teams;
3. pool/competition relations;
4. program, results and cancellations;
5. standings;
6. the bounded upcoming-match refresh;
7. activities.

Public-person and volunteer groups are in the allowlisted registry but default
off. The worker refuses them until the separate privacy activation is present.

Retry only transport, 429 and 5xx failures with bounded exponential backoff and
jitter. Never retry 4001/4002/4012/4031/4041 as transient failures. Record safe
codes and normalized read counts; the run schema reserves add/change/skip/
deactivate counters for expanded per-record telemetry. Never log request URLs
containing `client_id`.

Stale data remains visible in Control. It is not deleted from Player releases.
Program items expire after their configured window; cancellation, dressing-room
and official data expire after match day; birthdays after their date.
