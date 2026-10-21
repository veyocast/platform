# S263 — Resterende mobiele en gedeelde Sync-focus

De gebruiker vraagt een diepgaande vergelijking met de gekozen Sync-bron,
verwijdering van oude oranje bediening en een verzorgde interface. De
onafhankelijke statische heraudit vond één bereikbare afwijking: de mobiele
kaartselectie en favorietknop gebruiken een vaste oranje toetsenbordfocus.
De oorspronkelijke correctie staat in immutable commit
`4be206e8b066f66de4c6aaf6602ff9acc8fa9899` en draft-PR #286. Root heeft
daarna expliciet de hieronder begrensde algemene en Sportlink-focusuitbreiding
toegestaan; wijzig de bestaande mediacorrectie niet opnieuw.

## Basis en exclusieve ownership

Werk op `veyocast/s263-sync-media-focus` in een eigen sparse worktree vanaf
`f740e96820d82d047e6d1a4c0ab05f565f99b2ed`. Lees de verplichte repo-instructies
en de leidende Sync-handoffcanons. De expliciete actuele Sync-opdracht gaat
boven de historische algemene oranje bedieningsregel.

Wijzig uitsluitend:

- `apps/control/app/(shell)/dashboard/media/sites-media.module.css`: alleen
  de reeds gecommitte kleur van `.mobileMedia .mediaControls :focus-visible`
  onder 768 px; behoud deze correctie bytegelijk.
- `apps/control/app/sync-source.css`: uitsluitend de bestaande algemene
  focuskleur `#59e4b0` vervangen door
  `color-mix(in srgb, var(--accent) 70%, var(--mint) 30%)`.
- `apps/control/app/(shell)/dashboard/studio/sportlink/new/sites-source-wizard.module.css`:
  uitsluitend de bestaande focuskleur `#8cbfba` vervangen door dezelfde
  `color-mix(in srgb, var(--accent) 70%, var(--mint) 30%)`.
- `docs/s263-sync-media-focus.md`.
- Dit sprintprompt.
- Uitsluitend de eigen S263-regel in `TASK_LEDGER.md`.

Gebruik voor de mediakaart de bestaande geërfde Sync-bedieningsvariabele
`--accent`. Gebruik voor de twee aanvullende declaraties uitsluitend de
toegestane menging van bestaande `--accent` en `--mint`; geen nieuwe token of
globale overschrijving van specifieke focusregels. Leg de berekende
kleurcontrasten op bestaande lichte en donkere oppervlakken privé vast.
Bewijs de cascade op de echte Shell-, sidebar-, portal- en Sportlink-wrappers
statisch, inclusief bestaande specifieke accentregels en de grens bij
onbekende foto-/kleurachtergronden. Geen nieuwe test of browserrun. Laat selectors,
geometrie, inhoud, waarschuwingen, favorietstatus, handlers, permissions,
tokens, Source-assets, dependencies, schema en workflows intact.

## Review en bewijs

Bereid de exacte kleine sourcehunk en documentatie voor. Geen checks,
browseractor, commit of push vóór rootreview. Root heeft de oorspronkelijke
vier paden en de ene mediakleurcorrectie vervolgens expliciet goedgekeurd voor
`git diff --check` en een gewone commit, push en draft-PR. De twee aanvullende
productpaden waren daarna alleen toegestaan voor voorbereiding en freeze vóór
rootreview. Root heeft vervolgens de CSS-delta onafhankelijk bytegewijs
beoordeeld, de bestaande media-CSS gelijk aan `4be206e` bevonden en zelf
`git diff --check` met exitcode 0 uitgevoerd. De aanvullende gewone commit,
push en actualisering van dezelfde draft-PR zijn daarmee toegestaan; behoud
de oorspronkelijke commit zonder amend/rebase. Geen eigen nieuwe checks of
browseractor. Geef aan welke bestaande
mediaproeven de productiecomponenten al gebruiken en welke concrete
focuscontrole zij niet bewijzen. De bestaande Sheet-portalfixture is alleen
licht; gebouwde focuscontrole moet ook echte donkere generieke overlays
meenemen. Een CSS-spiegeltest is niet nodig.

Root sluit de echte toetsenbordfocus op de actuele gebouwde route en de
relevante geïntegreerde gates. Geen vijf-ronden-, V1-, release- of
toegankelijkheidsclaim op basis van deze tekstlezing of één kleurdelta.
