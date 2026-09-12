# S180 — Production recovery: celebrations and sport-list height

Baseline: `e5436ed38d28bffd56bece525821ba2963ad2689`.
Branch/worktree: `veyocast/s180-player-celebrations-layout`.

## Authorized scope

Birthday runtime confetti and day/theme precedence; goal intro selection,
canonical media, video lifecycle and diagnostics in modern/Static LG Player;
shared sport-list pagination/height; the existing snapshot, release, publish,
theme-rollout and protected production operations; regression tests and evidence.
No dependency changes, brand changes, new tenancy/group/media systems, mutable
published versions or device credential extraction.

After green tests: commit, push, PR/CI, exact-SHA staging and production via the
existing deployment workflow. Then refresh every published active dynamic slide
and republish every playlist used by active Duindorp screens through official
immutable operations. Preserve fixed light, drafts and historical releases.
Read back each renderjob, release branch and device acknowledgement. Offline
devices are listed separately, never reported as synchronized.

## Findings before changes

- Production birthday templates have no confetti markup/CSS/keyframes and output
  PNG. The immutable envelope already delivers `sport.configuration.presentation`,
  birthdays/month/day, timezone and frozen theme to both Player runtimes.
- Modern birthday decoration pulses inside each card; Static LG decoration is
  static, negatively stacked and clipped to the top 18%. No falling slide-scoped
  animation exists. Static LG also trusts stale `isToday`; modern re-projection
  schedules kickoffs only, not birthday midnight. Royal copy can duplicate date
  or today labels; `emphasizeToday` is not consistently applied.
- Three published production birthday slides carry legacy dark birthday options
  but their runtime-v2 frozen FieldFlow selection and tenant profile are fixed
  light. Backward compatibility must remain; frozen authority wins.
- Royal sport rows are fixed 96/148 px, whereas paging uses separate fixed 6/5/7
  limits. The available content height is not used to determine either together.
- Same testgoal at 20:30 UTC reached Bar and portrait Prijslijst with version 4.
  Both ACK `rendered` in about 600 ms; this ACK marks celebration activation,
  not video playback. Existing persisted diagnostics cannot prove decoder state.
- Both published intro assets exist, have distinct hashes and canonical MP4
  variants, but both are recorded as 1920×1080/15.042 s, including portrait.
  This does not yet prove the LG decoder failure; actual bytes and runtime
  telemetry must be inspected before asserting that cause.

## Implementation and gates

Use one bounded cleanup-safe canvas engine in the Player, reading existing
immutable data without per-slide requests. Re-evaluate Amsterdam dates at runtime.
Centralize goal asset/orientation selection, bounded video states and diagnostic
codes, with natural `ended` and direct overlay recovery. Share sport layout
capacity/row geometry between preview, PNG, modern and LG.

Run lint/typecheck/unit/integration/build; relevant full player/offline/browser
gates and visual matrices. Schema changes require fresh DB reset/full RLS.
Record production evidence and media/device limitations in the final report.

## Recovery implementation

Production inventory before deployment: 143 active published dynamic slides,
five used playlists. All current snapshot versions match their current published
design. Two slides have an unpublished draft; recovery preserves these drafts.
Six current snapshots still carry old Velocity/Halo dark state. The current
snapshot builder resolves these to tenant FieldFlow revision 13, fixed light.
Three birthday snapshots include two birthdays today each (Amsterdam day).

`20260912214500_s180_content_recovery.sql` adds an owner-only operation, with no
public/authenticated/service-role execution grant. It checks active tenant,
expected theme revision, absence of an active rollout and complete baselines,
then rebuilds every published active snapshot using the published version's
fields and current provider data. Existing rollout maps and render jobs retain
LKG until ready. The existing materializer gains an explicit, audited path for
an asset-only playlist; all other theme operations still skip unchanged branches.
It also writes its system audit inside that private boundary: the former call
to the user-only audit helper failed when invoked by a renderer completion.
No published snapshot/release is edited and no global audit permission changes.

The private operation is invoked only after verifying the deployed SHA. Normal
Studio operations continue using their existing authenticated RPCs. Schema
rollback is operationally additive: stop invoking recovery; existing releases
remain valid. Failed renders preserve current pointers and report their job.

The protected `probe-goal-media.yml` workflow reads only published assets from
one tenant inside the exact deployed worker image, verifies checksums, runs
ffprobe and reports MP4 box order. Credentials, signed URLs and media bytes do
not leave the worker. Physical LG decoder verification requires actual device
telemetry; Chromium coverage of the Static LG engine alone is not that proof.

The private `run_ledscores_operator_test_v1` operation exercises the existing
synthetic dispatcher using a direct database-owner session. It accepts only an
active tenant, published selected team/group and recorded deployment SHA/reason.
It excludes PostgREST, SET ROLE and JWT sessions, retains the synthetic rate
limit, writes a system audit and has no Data API execution grants. It never
impersonates a human, borrows a worker lease or adds a live match statistic.

Visual review also found that the standing context label overlaid the last row.
It now occupies its own layout row. Both renderers measure the actual standing
row window, including the space used by headings and the pinned own team.

## Local release verification

- Lint, typecheck and unit tests: all 30 workspace tasks pass.
- Production build: all 18 tasks pass, including browser secret/auth boundaries
  and the Chrome-79/webOS syntax guard.
- Fresh local database reset: all 84 RLS files / 2,176 assertions pass.
- Full Player and offline suites: 188 pass; two optional external reference
  corpora are absent. All new native-video, birthday and row-layout tests pass.
- Player accessibility: eight pass. Earlier full accessibility/E2E run has
  76 passing results and 19 opt-in live scenarios skipped; its sole marketing
  timeout passes in the isolated six-test marketing rerun.
- 64-case renderer matrix and the height screenshots were regenerated and
  visually reviewed. Standing context now clears the last portrait card.
- All workflow structures and changed workflow shell blocks pass actionlint;
  deployment security and VPS validators pass. The host's small pipe buffer
  stalls actionlint's external-checker handoff for an unrelated large existing
  inline script; CI performs the normal complete workflow check.

Production media probing, deployment, immutable tenant recovery and actual
physical-device acknowledgements remain post-deploy verification, not inferred
from the browser fixtures.

The media probe obtains its client through the approved worker backend and
validated worker configuration. It does not read credentials itself. The
repository-wide credential-boundary tests were also run directly without cache.
