# S263 — Resterende oranje mobiele mediafocus

De gebruiker vraagt een diepgaande vergelijking met de gekozen Sync-bron,
verwijdering van oude oranje bediening en een verzorgde interface. De
onafhankelijke statische heraudit vond één bereikbare afwijking: de mobiele
kaartselectie en favorietknop gebruiken een vaste oranje toetsenbordfocus.

## Basis en exclusieve ownership

Werk op `veyocast/s263-sync-media-focus` in een eigen sparse worktree vanaf
`f740e96820d82d047e6d1a4c0ab05f565f99b2ed`. Lees de verplichte repo-instructies
en de leidende Sync-handoffcanons. De expliciete actuele Sync-opdracht gaat
boven de historische algemene oranje bedieningsregel.

Wijzig uitsluitend:

- `apps/control/app/(shell)/dashboard/media/sites-media.module.css`: alleen
  de kleur van `.mobileMedia .mediaControls :focus-visible` onder 768 px.
- `docs/s263-sync-media-focus.md`.
- Dit sprintprompt.
- Uitsluitend de eigen S263-regel in `TASK_LEDGER.md`.

Gebruik de bestaande geërfde Sync-bedieningsvariabele `--accent`, zodat de
focus duidelijk afsteekt tegen de lichte mediakaart. Leg de berekende
kleurcontrasten op de bestaande lokale oppervlakken privé vast, zonder een
nieuwe test of browserrun. Laat selectors,
geometrie, inhoud, waarschuwingen, favorietstatus, handlers, permissions,
tokens, Source-assets, dependencies, schema en workflows intact.

## Review en bewijs

Bereid de exacte kleine sourcehunk en documentatie voor. Geen checks,
browseractor, commit of push vóór rootreview. Root heeft de vier paden en
de ene kleurcorrectie vervolgens expliciet goedgekeurd voor `git diff --check`
en een gewone commit, push en draft-PR. Geef aan welke bestaande
mediaproeven de productiecomponenten al gebruiken en welke concrete
focuscontrole zij niet bewijzen. Een CSS-spiegeltest is niet nodig.

Root sluit de echte toetsenbordfocus op de actuele gebouwde route en de
relevante geïntegreerde gates. Geen vijf-ronden-, V1-, release- of
toegankelijkheidsclaim op basis van deze tekstlezing of één kleurdelta.
