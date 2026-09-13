# S183 — Verify original goal video orientation

The user corrects the S182 assumption: two independent goal uploads are intended
for fullscreen landscape and portrait. Center-cropping a landscape raster is
not evidence that the correct portrait upload is playing.

Read-only production data confirms distinct landscape (`Goal2`) and portrait
(`Goal`) media IDs in published version 4. Both published variants are 1920×1080.
The original variant rows have no width/height: the worker completion records
output dimensions on media_assets. Therefore those rows do not establish the
original upload orientation. Do not repeat that earlier inference as fact.

Ownership: existing protected media diagnostic, its inspection helper/tests, read-only probe metadata,
this prompt and TASK_LEDGER.md. First compare original and published bytes in
the existing worker boundary, with tenant/path/hash validation and temporary
file cleanup. Report source kind and display dimensions accounting for rotation and sample aspect ratio.
Keep credentials, URLs, paths and media content inside the worker. Use the
existing exact-SHA production deployment and protected diagnostic workflow.

No asset substitution, re-encoding, draft edit or immutable version mutation
is authorized by an unverified assumption. After the original comparison,
repair the proven source/normalization/publication fault through the appropriate
existing service. If the intended source cannot be identified, ask for its name
while completing independent verification.

Run lint, typecheck, unit tests and build. This diagnostic does not change the
Player, authoring UI, database/RLS, dependencies or ordinary worker processing.

Initial local verification: lint/typecheck/unit each 30/30 tasks; worker tests
154/154 including 11 protected-inspection cases; build 18/18 tasks. No UI,
Player runtime, database, dependency or unrelated file changes.
