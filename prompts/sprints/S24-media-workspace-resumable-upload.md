# S24 - Media workspace en resumable upload

## Doel

Bouw een schaalbare mediabibliotheek met detail, hervatbare upload, duidelijke
processingstates en veilige gebruiks-/impactdata.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S24
- `docs/media-pipeline-canon.md`, media threat model en worker runbook

## Scope

- paginated list/grid, filters, search en assetdetail;
- upload intent/chunks/resume/cancel/finalize met idempotency;
- clientprogress en herstel na toegestane reload/navigatie;
- server-authoritative MIME/signature/size/quota/pathvalidatie;
- queued/processing/ready/failed/quarantined herstel-UX;
- asset -> drafts -> releases -> screens usagequery.

## Acceptatie

- chunk replay, resume en cancel verliezen geen status;
- cross-tenant, path traversal, MIME mismatch, oversize en quota falen;
- signed URLs lekken niet naar langdurige clientstate;
- keyboard/mobile upload en library zijn bruikbaar;
- RLS, storage, E2E, a11y en foundationgates zijn groen.

## Stop en rapporteer

- wanneer nieuwe uploadrechten private Storage/RLS zouden verzwakken;
- wanneer lockfilewijziging buiten afgesproken dependencyownership valt.
