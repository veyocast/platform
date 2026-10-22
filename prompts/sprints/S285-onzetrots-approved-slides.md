# S285 — goedgekeurde OnzeTrots-slidecollectie

Voer de gebruikersopdracht en de vaste overdracht onder
`docs/design/onzetrots-slides/` volledig uit in de actieve Sync-keten.
Baseline: `3bbb51ac006bbaf8381a11d5dcfd7024d13d3876`.
Goedgekeurde bron: `ae83f2b4312408eacae9f29177d3c743e104185b`.

Root is de enige writer. Eén taakbranch/worktree/PR:
`veyocast/s285-onzetrots-approved-slides`, `/home/codex/repos/castivo-s285`.

## Ownership

- `packages/contracts/src/sync-*`, bijbehorende exports en contracttests:
  nieuwe versiegebonden presentatie, rijke feiten, configuratie, assets en duur.
- `packages/content-templates/src/sync-*`, bijbehorende exports en tests:
  canonical projectie, pure gedeelde composities, stijlen en motion.
- `packages/studio/src/sync.ts`, Studio-schemagrens en relevante tests:
  lege starters, versiecompatibiliteit en pagina-/duurcontract.
- De Sync-wizard, state, templatefixtures en editor onder Control Studio;
  gekoppelde editor en Sportlink-binding/policy onder Control Slides;
  gedeelde `sync-studio-preview.tsx` en hun gerichte styles/tests.
- Native Sync-authoringconsumers onder `apps/control-mobile/`, uitsluitend
  waar de nieuwe gedeelde contracten worden opgeslagen of bewerkt.
- `apps/control/lib/sync-theme-creation-defaults.ts` en de relevante tests:
  expliciete versie bij een nieuw ontwerp/themakeuze; geen documentmigratie.
- De directe Sync-callers voor achtergrondkeuze, playlistvoorbeelden en
  expliciete themakopieën (`sync-background-choice.ts`, `placement-preview.tsx`,
  de Sync-thumbnail in `playlist-editor.tsx`, `sites-placement-theme-actions.ts`):
  behoud van de versiegebonden rijke velden, zonder bestaande documenten te
  herinterpreteren. De bestaande Engage-subcontractcaller blijft dezelfde
  gedeelde pollgrens gebruiken nadat de presentatie een discriminated union is.
- De directe playlistduurconsumers `playlist-media-picker.tsx`,
  `playlist-command-plan.ts` en hun regressietests: gebruik de werkelijk
  gerenderde volledige duur en bewaak de minimale interne bewegingscyclus.
- `apps/media-worker/src/sync-*`, rendererassetloader en relevante tests:
  gecontroleerde capture, framecache en volledige PNG/MP4-uitvoer.
- `apps/player/app/_components/sync-studio-media.tsx`, de Sync-presentation-,
  asset-, live-match- en capabilityhelpers, hun voorbereidings/cachingcallers
  waar strikt nodig en relevante Player/offlinetests.
- Nieuwe versiegebonden goedgekeurde rendererassets/manifesten en noodzakelijke
  byte-identieke publickopieën in Control en Player.
- `.gitattributes`, uitsluitend padgebonden bytebehoud voor deze ongewijzigde
  overdracht en checksumgebonden `onzetrots-approved-v1`-assets. Dit voorkomt
  CRLF-normalisatie zonder extra bestanden in het geauditeerde archief.
- Sync-generatoren, actuele JSON-schema's, één of meer nieuwe forward-only
  migraties en hun SQL/RLS-tests; geen historische SQL herschrijven.
- Gerichte Control-, Player-, Worker- en visuele acceptatietests/fixtures;
  bewijs onder `docs/implementation/s285-onzetrots/`.
- De bestaande Player-fixturevoorbereiding in `.github/workflows/pr-gates.yml`:
  produceer de complete canonieke OnzeTrots-video vóór de browsercohort, met
  dezelfde echte Chromium-/FFmpeg-/checksumgates als de bestaande galerijproef.
- Dit prompt, `docs/s285-onzetrots-approved-slides.md`, de aangeleverde
  referentiemap, `PLANS.md` en de eigen rij in `TASK_LEDGER.md`.

## Volgorde en gates

1. Lees canons, overdracht en actieve keten; leg schone baseline en gates vast.
2. Introduceer expliciete nieuwe renderer-/bronidentiteit en rijke contracts;
   behoud de oorspronkelijke Sync-v1-, Sites- en FieldFlow-decoders.
3. Bouw echte bronprojectie, gecontroleerde bezoekerselectie en samengestelde
   matchday uit één geautoriseerde tenant/team/poule/seizoencontext.
4. Port alle 36 composities, exacte assets, licht/donker en beide canvassen;
   koppel echte wizard/editors en houd voorbeeldfeiten uitsluitend in fixtures.
5. Deel deterministische interne motion tussen preview, capture en Player;
   verifieer geneste assets, complete fallback en last-known-good.
6. Vergelijk 144 basiscombinaties plus speciale acceptatiegevallen, run alle
   toepasselijke AGENTS-gates en lever één concrete PR met beeld-/motionbewijs.

Gebruik uitsluitend een eigen geïsoleerde lokale testdatabase voor reset/RLS.
Deze taak bevat geen zelfstandige productiedeployment, dataverwijdering,
credentialwijziging, framework-/dependencyupgrade of history rewrite.
