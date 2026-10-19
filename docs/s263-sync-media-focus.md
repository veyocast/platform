# S263 — Sync-focus op mediakaarten en gedeelde bediening

De selectie- en favorietbediening van de mediabibliotheek had onder 768 px
een vaste oranje focusrand. De lokale selector heeft specificiteit 0,3,0 en
wint daardoor van de algemene Sync-focusselector met specificiteit 0,2,1.
De regel bleef bereikbaar via de `mobileMedia`-wrapper in `media/page.tsx`
en `mediaControls` in `media-library-workspace.tsx`.

De kleur van die bestaande mediafocusrand gebruikt nu `var(--accent)`.
Deze geërfde Sync-variabele is in `apps/control/app/sync-source.css`
vastgelegd als `#006d73`, de bestaande kleur voor Sync-bediening en de
behouden accountfocus. Het donkere accent contrasteert beter met de lichte
mediakaart dan de algemene mintfocus. De lokale contrastberekening staat
afzonderlijk in het private taakbewijs; zij vervangt geen beeldcontrole op
de daadwerkelijke fotoachtergrond.
Randbreedte, afstand, selectors, mediaquery, aanraakdoelen, favorietstatus,
handlers en brondata veranderen niet. De vergelijkbare regel in de grote
Engage-stylesheet is geen bewezen bereikbare mediabediening en valt buiten
deze taak. Deze correctie staat in commit
`4be206e8b066f66de4c6aaf6602ff9acc8fa9899` en blijft ongewijzigd.

## Begrensde scope-uitbreiding na rootreview

De algemene Source-focus gebruikte mint op lichte oppervlakken; die kleur
contrasteert slechts 1,5971:1 met wit. De Sportlink-wizard bevat daarnaast een
lokale focuskleur `#8cbfba` met 2,0435:1 tegen wit. Root heeft expliciet twee
extra productpaden toegestaan. Uitsluitend de twee bestaande kleurdeclaraties
worden `color-mix(in srgb, var(--accent) 70%, var(--mint) 30%)`.
De bestaande selectors, 3 px-rand, 3 px-afstand en alle overige bytes in deze
twee CSS-bestanden blijven behouden. Er komen geen tokens of themaregels bij.

Met de bestaande Source-waarden geeft deze menging sRGB
`(26.7, 144.7, 133.3)`. De berekende contrasten met bestaande effen oppervlakken
zijn 3,8760:1 met wit, 3,5892:1 met Source-pagina `#f3f7f6`, 3,4720:1 met
`#edf4f1` en 3,4248:1 met actieve navigatie `#ddf7e9`. De behouden donkere
FieldFlow-oppervlakken van generieke overlays geven 3,9733:1 met `#0d2927`,
3,5061:1 met `#123332` en 3,1974:1 met `#163a37`. Alleen het donkere accent
als algemene focuskleur gebruiken zou op deze donkere oppervlakken onder
3:1 blijven. De lokale mediafocus blijft daarom afzonderlijk `var(--accent)`;
deze uitbreiding verandert haar niet.

De werkelijke Shell heeft zowel `sites-control` als `sync-control`; haar
sidebar heeft zowel `vx-sidebar` als `nav-panel`. De later geïmporteerde
Source-regel voor `.sync-control .nav-panel` wint bij gelijke specificiteit
van de oude FieldFlow-sidebarachtergrond en gebruikt het lichte
`var(--surface)`. De oude donkere sidebar is dus geen reden voor een extra
navigatieregel. De bestaande donkere voorkeur verandert `--ff-*`-waarden,
terwijl Source `--surface`, `--accent` en `--mint` behoudt. Generieke
Dialog/Sheet-portals erven de Shell via `DialogPortalProvider` en kunnen
daardoor zowel de algemene focusregel als een donker `--ff-surface` of
`--ff-surface-raised` gebruiken.

De echte `/dashboard/studio/sportlink/new`-route monteert
`SportlinkBulkWizard`; zowel het formulier als de familie-Dialog gebruiken
de lokale `page`-klasse. Hun bestaande focusselector heeft dezelfde
specificiteit 0,2,1 als de algemene Source-selector. De tweede kleurcorrectie
voorkomt dat de lokale zwakke kleur bij latere stylesheetvolgorde terugkomt.
De bestaande specifieke accentfocus van auth, retained Studio,
Source-dialogs en mobiele media blijft intact; die regels zijn expliciet in
het private cascadebewijs opgenomen.

Dit is een berekening voor genoemde effen achtergronden, geen native of
toegankelijkheidsacceptatie. Tegen de accentknopkleur zelf is de menging
1,5773:1; de bestaande 3 px-outlineafstand maakt het naastliggende externe
oppervlak relevant. De daadwerkelijke plaatsing, begrenzing en onbekende
foto- of kleurachtergronden vragen nog gebouwde inspectie. Er is geen
algemene claim dat iedere mogelijke focusomgeving 3:1 haalt.

## Scope en basis

- Branch: `veyocast/s263-sync-media-focus`.
- Worktree: `/home/codex/repos/castivo-s263`.
- Basis: `f740e96820d82d047e6d1a4c0ab05f565f99b2ed`.
- Exact zes paden: `apps/control/app/(shell)/dashboard/media/sites-media.module.css`,
  `apps/control/app/sync-source.css`,
  `apps/control/app/(shell)/dashboard/studio/sportlink/new/sites-source-wizard.module.css`,
  dit document, het eigen sprintprompt en uitsluitend de S263-regel in
  `TASK_LEDGER.md`.
- De worktree is sparse aangemaakt; geen installatie, dependency-, token-,
  immutable Source-asset-, database- of workflowwijziging.

## Verificatiegrens

Root heeft oorspronkelijk vier paden en de ene mediakleurcorrectie beoordeeld
en goedgekeurd voor een gewone commit, push en afzonderlijke draft-PR #286.
`git diff --cached --check` is met exitcode 0 uitgevoerd op die oorspronkelijke
vier paden. Root heeft de daaropvolgende uitbreiding met twee
focuskleurdeclaraties eveneens beoordeeld, beide CSS-vervangingen onafhankelijk
bytegewijs terugvergeleken en bevestigd dat de media-CSS gelijk blijft aan
`4be206e`. Root heeft hiervoor `git diff --check` met exitcode 0 uitgevoerd
en een gewone vervolcommit en push op dezelfde branch en draft-PR toegestaan.
Deze agent heeft geen nieuwe diffcheck of lint-, browser- of gecombineerde
gates uitgevoerd. De private statische freeze bewaart de bronpinnen,
contrastberekening en cascadebewijs vóór deze statusupdate.
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
uitrolgates blijven open bij S244. Ook de gedeelde bediening, navigatie en
Sportlink-wizard vragen gebouwde focusinspectie met lichte én donkere
voorkeur, inclusief echte generieke overlays. De bestaande
`tests/control/sync-sheet-portal.spec.ts` gebruikt alleen een lichte fixture;
die bewijst geen donkere focus. Deze kleurcorrecties krijgen geen nieuwe
tests die uitsluitend de CSS-declaraties herhalen.
