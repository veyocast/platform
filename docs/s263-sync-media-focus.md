# S263 — Sync-focus op mobiele mediakaarten

De selectie- en favorietbediening van de mediabibliotheek had onder 768 px
een vaste oranje focusrand. De lokale selector heeft specificiteit 0,3,0 en
wint daardoor van de algemene Sync-focusselector met specificiteit 0,2,1.
De regel bleef bereikbaar via de `mobileMedia`-wrapper in `media/page.tsx`
en `mediaControls` in `media-library-workspace.tsx`.

Alleen de kleur van die bestaande focusrand gebruikt nu `var(--accent)`.
Deze geërfde Sync-variabele is in `apps/control/app/sync-source.css`
vastgelegd als `#006d73`, de bestaande kleur voor Sync-bediening en de
behouden accountfocus. Het donkere accent contrasteert beter met de lichte
mediakaart dan de algemene mintfocus. De lokale contrastberekening staat
afzonderlijk in het private taakbewijs; zij vervangt geen beeldcontrole op
de daadwerkelijke fotoachtergrond.
Randbreedte, afstand, selectors, mediaquery, aanraakdoelen, favorietstatus,
handlers en brondata veranderen niet. De vergelijkbare regel in de grote
Engage-stylesheet is geen bewezen bereikbare mediabediening en valt buiten
deze taak.

## Scope en basis

- Branch: `veyocast/s263-sync-media-focus`.
- Worktree: `/home/codex/repos/castivo-s263`.
- Basis: `f740e96820d82d047e6d1a4c0ab05f565f99b2ed`.
- Exact vier paden: het genoemde CSS-bestand, dit document, het eigen
  sprintprompt en uitsluitend de S263-regel in `TASK_LEDGER.md`.
- De worktree is sparse aangemaakt; geen installatie, dependency-, token-,
  Source-, database- of workflowwijziging.

## Verificatiegrens

Root heeft de vier paden en de ene kleurcorrectie beoordeeld en goedgekeurd
voor een gewone commit, push en afzonderlijke draft-PR. Er zijn geen lint-,
browser- of gecombineerde gates uitgevoerd. `git diff --cached --check`
is met exitcode 0 uitgevoerd op de exact vier voorbereide paden.
De statische cascadecontrole is geen bewijs van een native focusbeeld,
toegankelijkheidsacceptatie of een volledige visuele vergelijkingsronde.

De bestaande `tests/control/sites-media-screens-states.spec.ts` monteert de
echte `MediaLibraryWorkspace` met selectie- en favorietbediening en Sync-CSS.
De fixture mist echter de productie-`mobileMedia`-wrapper en controleert deze
focuskleur niet. `tests/control/sites-media-editor.spec.ts` bewijst andere
metadata-/conflicthandelingen, evenmin deze focusrand. Hun eerdere groene
resultaten certificeren deze verandering niet.

De passende nieuwe beeldcontrole is de actuele gebouwde, read-only
`/dashboard/media`-route onder 768 px: focus de kaartselectie en favorietknop
met het toetsenbord, controleer de berekende accentkleur en zichtbare focusrand
en behoud de productie-wrapper. Focus alleen verstuurt geen opdracht.
De actuele gebouwde 390 px-focuscontrole voor selectie én favorietknop,
de finale geïntegreerde lint/typecheck/test-, UI/a11y-/Chromium- en
uitrolgates blijven open bij S244. Eén kleurcorrectie krijgt geen nieuwe test die
uitsluitend de CSS-declaratie herhaalt.
