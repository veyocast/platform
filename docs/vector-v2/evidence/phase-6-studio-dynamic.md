# Fase 6 — Studio en dynamische slideflows

Datum: 24 augustus 2026  
Status: `IN_PROGRESS`

## Opgeleverd in dit checkpoint

- Eén gedeelde Journey Shell voor Menu/Twelve, Sportlink bulk en RSS/nieuws,
  met een blijvend zichtbare preview, voortgang, geselecteerd aantal en
  responsive preview-first gedrag op mobiel.
- De bestaande RSS/nieuws-authoring is weer bereikbaar vanuit Unified Studio.
  Een algemene route-redirect onderschepte eerder ook geldige
  `family=news`-navigatie; de route is nu expliciet RSS-only en leest echte
  tenantbronnen, templates, snapshots en tenanttheme server-side.
- De bestaande gedeelde `ThemePicker` is aangesloten op RSS/nieuws; theme-ref,
  mode en expliciete versioned tokens blijven onderdeel van de slideversie.
- Studio-preview heeft een expliciete `Beweging beperken`-modus. De preview
  respecteert standaard de OS-voorkeur en toont de volledige gecomponeerde
  slide zonder entry-, exit- of continue animatie.
- Demo-autosave valideert demo-ID's niet meer onterecht als productie-UUID.
- Ingebedde Player-previews gebruiken geen genest `main`-landmark en kleine
  preview-/datakwaliteitslabels voldoen aan de contrastgrens.

## Behouden contracten

- Studio-documenten, revisions, optimistic autosave, conflict/recovery en
  renderjobs zijn niet gemigreerd of mutabel gemaakt.
- PNG/MP4-output blijft een normale media-ingest van een exact bevroren
  bronrevision; de Player importeert geen Studio-runtime.
- Dynamic providerdata blijft via snapshots vernieuwen zonder ontwerpversie te
  maken. Menu- en Sportlinkversies, releases en last-known-good blijven
  immutable.
- De productiepreview gebruikt dezelfde Editorial Arena-renderer als de
  Player; alleen de semantische wrapper is in embedded context een `div`.

## Gates

| Gate | Resultaat |
|---|---|
| `pnpm lint` | 30/30 taken groen |
| `pnpm typecheck` | 30/30 taken groen |
| `pnpm test` | 30/30 taken groen; Studio 15, templates 40, UI 18, Control 181, worker 85 en Player 153 tests |
| `pnpm build` | 18/18 taken groen; Control auth- en secretbundleguards groen |
| Studio demo browsermatrix | 6/6 groen; desktop, mobiel, keyboard, reduced motion, Journey Shell en RSS-prerequisite |
| Live RSS production-build | 1/1 groen tegen echte lokale Supabasebron; desktop/mobile Axe nul violations |
| Live Menu/Twelve production-build | 1/1 groen; categorydialog, alfabetische producten, productgroep, optionele vrije regel, portrait 2-koloms, theme, revisionconflict, immutable publish en mobile Axe |

## Visueel bewijs

- `docs/screenshots/vector-v2/studio/menu-journey-1440x900.png`
- `docs/screenshots/vector-v2/studio/sportlink-journey-1440x900.png`
- `docs/screenshots/vector-v2/studio/sportlink-journey-390x844.png`
- `docs/screenshots/vector-v2/studio/rss-journey-live-1440x900.png`
- `docs/screenshots/vector-v2/studio/rss-journey-live-390x844.png`
- `docs/screenshots/vector-v2/studio/menu-twelve-live-1440x960.png`
- `docs/screenshots/vector-v2/studio/menu-twelve-live-390x844.png`

De captures zijn handmatig gelezen. De mobiele preview staat bewust vóór het
formulier, er is geen horizontale overflow, Playerdata is echte fixturedata en
geen screenshot bevat geheimen of klantdata.

## Nog af te ronden binnen fase 6

- Vrije Studio-bronvideo als first-class element ontbreekt nog in het huidige
  documentschema en de frame-renderbackend. Bestaande Menu Studio-video en
  gegenereerde Studio-MP4-output werken wel; deze twee capabilities worden niet
  ten onrechte als vrije canvasvideo gepresenteerd.
- De live Twelve-readback is groen. De test herlaadt de desktoprevision na een
  mobiele wijziging voordat hij publiceert; daarmee wordt de revisionguard
  bewezen in plaats van omzeild.
