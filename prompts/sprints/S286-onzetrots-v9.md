# S286 — OnzeTrots v9 + contextregel 30% in de actieve Sync-keten

Gebruikersopdracht: voer de geplakte volledige opdracht uit en commit, push en
deploy wanneer alles gereed is. De bestaande main → staging → expliciete
production-promotie is daarmee geautoriseerd; geen database-reset of nieuwe
credentials op staging/production. Fysieke apparaat-/24-uursproeven blijven
volgens de eerdere afspraak uitgesteld en worden niet als uitgevoerd gemeld.

Baseline: `32b1db6851bcc9a3cc3aa96faa18d63fddc36964`, inclusief S285.
Nieuwe bron: `5ba52a657d6d16ad103ba2fb43b8db18aa83715a` (v9).
Statische layoutreferentie: dezelfde v9-bron, 144 basisbeelden + 16 details.
Aanvullend expliciet gevraagd: contextregels circa 30% groter dan v9.
Menu Studio-referentie: `77eec81092ab829302dd835fb430161fe93be220`.
Het volledige nieuwe pakket wordt byte-ongewijzigd onder
`docs/design/onzetrots-slides/v9/` bewaard. De oorspronkelijke S285-bron en
haar renderer-/assetidentiteiten blijven op hun bestaande paden behouden.

Root is de enige writer. Branch/worktree/PR:
`veyocast/s286-onzetrots-v9`, `/home/codex/repos/castivo-s286`.

## Ownership

- `packages/contracts/src/sync-*`, relevante exports/tests/schema's: expliciete
  nieuwe renderer-/bronidentiteit, headertekst, gedeelde bezoekersschaal,
  rijke feiten/assetgrenzen, duration/page contracten; bestaande identiteiten
  behouden hun betekenis.
- `packages/content-templates/src/sync-*`, exports/tests: gedeelde pure
  composities, v9-subtitel/titel, Rubik Distressed en welkomfit en v7 deterministic scene projection.
- `packages/studio/src/sync.ts` en gerichte tests: opgeslagen authoring,
  revisions/duur/lege starters, zonder verzonnen tenantinhoud.
- Sync-wizard, handmatige/gekoppelde editors, form recovery, templatefixtures,
  Sportlink-binding/policy en gedeelde preview onder `apps/control/`; directe
  theme-/achtergrond-/playlist-preview- en duurconsumers waar vereist.
- De corresponderende native Sync-consumers onder `apps/control-mobile/`,
  uitsluitend voor dezelfde opgeslagen contracten en authoringbediening.
- `apps/media-worker/src/sync-*`, rendererassetloader, de directe posterconsumer
  `studio-render-runner.ts` en relevante tests:
  framegewijze echte v7-intro én gegevensbeweging met ongewijzigde CSP/decode.
- `apps/player/app/_components/sync-studio-media.tsx`, Sync-presentatie,
  assets, capability-, live-score-, cache/preparatiecallers en gerichte tests:
  dezelfde scène, pauze/reduced/replay, volledige fallback en LKG.
- Sync-generators; nieuwe versiegebonden stijl-/assetmanifesten en noodzakelijke
  publickopieën; één of meer nieuwe forward-only migraties en SQL/RLS-tests.
  Historische migraties en originele assets worden niet herschreven.
- `.github/workflows/pr-gates.yml` uitsluitend indien nodig om dezelfde echte
  v9-exportfixture vóór de bestaande Playercohort te produceren; geen tests
  overslaan, toleranties verruimen of veiligheidsgrenzen versoepelen.
  CI-run `39981481136` toont daarnaast dat de bestaande mirrorfix de nieuwe
  `mirror+file`-bron mist: voeg uitsluitend `/etc/apt/apt-mirrors*.txt` toe
  aan dezelfde bronnenlus; geen pakket-/deadline-/testwijziging.
- `.gitattributes` uitsluitend indien bytebehoud van de nieuwe overdracht of
  checksumgebonden assets daar nog een gerichte uitbreiding vereist.
- Na CI-run `39981481150`: `.github/workflows/database-rls-gates.yml`
  uitsluitend de Ubuntu-mirror vóór de echte Chromium-/FFmpeg-installatie.
  RLS en concurrencytests waren groen; de bestaande 30-minutenjobgrens brak af
  op de trage HTTP Azure-mirror. Dezelfde canonieke HTTPS Ubuntu-bron als de
  bestaande Player-job, zonder pakket-/test-/deadlinewijziging.
- Gerichte contract/projector/Worker/wizard/authoring/Player/offline- en
  visuele tests/helpers; bewijs onder `docs/implementation/s286-onzetrots-v9/`.
- Dit prompt, `docs/s286-onzetrots-v9.md`, nieuw referentiepakket,
  eigen aanvulling in `PLANS.md` en eigen rij in `TASK_LEDGER.md`.

## Implementatievolgorde en gates

1. Verifieer pakket/bron/baseline; vergelijk de na de pakketinspectie geleverde
   S285-implementatie. Behoud bestaande rijke data, selectie en fallback.
2. Voeg de expliciete v9-presentatie/configuratie toe: subtitel en titel ieder maximaal 120
   tekens (leeg blijft leeg), default familielabel, bezoekersschaal 100–200
   in stappen van 5/default 150, correcte opslag en bronverversing.
3. Port de v9-eindlayout voor alle 36 families: één aparte kop met logo rechts,
   geen herhaalde decoratieve binnenlogo's, proportionele welcome-fit/captions.
4. Deel v7-intro-/data-/layouttijd en pauze/reduced/intro-finished/replay tussen
   preview, ieder echt exportframe en Player; behoud strenge CSP en LKG.
5. Verifieer 144 basiscombinaties, bezoekersdetails/schaalgrenzen, headeropslag,
   veilige tekst en volledige speciale acceptatiematrix met echte renders.
6. Voer de toepasselijke AGENTS-gates uit, inclusief geïsoleerde database/RLS,
   UI/a11y/Chromium, Worker en Player/offline; leg beperkingen eerlijk vast.
7. Commit/push één concrete PR met bron-/layout-/motionbewijs. Na groene CI:
   normale merge, staging, expliciete productiepromotie met dezelfde images,
   migratie-/gezondheids-/pairing-/herstel- en publieke assetchecks.

Geen framework-/dependencyupgrade, lockfilewijziging, bestaande database legen,
history rewrite, vrije HTML/JS, nieuwe authflow of tweede productrenderer.

Nieuwe v9-delta: geen binnenkoppen behalve drie bij matchday; verjaardag
datum → felicitatie → Rubik-leeftijd → team. Authoringvelden zijn altijd
zichtbaar, onafhankelijk opgeslagen en veilig geëscapet. De context +30%
is vereist door de gebruiker, ook al noemt document 14 dit optioneel.
