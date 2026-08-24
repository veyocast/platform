# Fase 6 — Studio en dynamische slideflows

Datum: 24 augustus 2026  
Status: `DONE`

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
- Vrije Studio-bronvideo is een first-class, begrensd achtergrondelement. De
  editor plaatst maximaal één tenantvideo atomair, vergrendeld op laag 0 en
  schermvullend op het transparante artboard. De inspector biedt fit,
  focus/startpunt en bronwissel; mobiele quick edit kan de bron veilig wisselen.
- Preview gebruikt uitsluitend een kortlevende tenant-signed bron-URL. De
  immutable renderrevision claimt voor video uitsluitend de gevalideerde
  `player_1080p`-variant; audio wordt verwijderd en FFmpeg composeert de lokale
  loopende bron onder de deterministische RGBA-overlay. PNG gebruikt dezelfde
  compositie als posterframe en wordt expliciet naar sRGB genormaliseerd.

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
- Het documentschema blijft versie 1 en is additief: bestaande documenten
  parsen identiek. De database valideert de volledige video-geometrie,
  tenantownership, normalized variant en media-manifestrelatie opnieuw.

## Gates

| Gate | Resultaat |
|---|---|
| `pnpm lint` | 30/30 taken groen |
| `pnpm typecheck` | 30/30 taken groen |
| `pnpm test` | 30/30 taken groen; Studio 16, templates 40, UI 18, Control 182, worker 87 en Player 153 tests |
| `pnpm build` | 18/18 taken groen; Control auth- en secretbundleguards groen |
| `pnpm db:reset` | alle 86 migraties inclusief `20260824190000_s123_studio_source_video.sql` groen |
| `pnpm test:rls` | 57 bestanden, 1.160 assertions groen; video create/revision/claim/ACL bewezen |
| Studio demo browsermatrix | 6/6 groen; desktop, mobiel, keyboard, reduced motion, Journey Shell en RSS-prerequisite |
| Studio editor regressie na video-uitbreiding | 4/4 groen; overview/create, desktop, mobile quick edit en keyboard/a11y |
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

## Vervolgpoort

De lokale host bevat geen `ffmpeg`-binary. Contract-, filtergraph-,
variantclaim-, checksum-, MIME- en sRGB-tests zijn groen; de bestaande
production-image FFmpeg-smoke voor landscape en portrait blijft onderdeel van
de release-/hardwarematrix in fase 13. Dit is geen ontbrekende productadapter:
de workercompositor, foutclassificatie en verificatiepad zijn geïmplementeerd.
