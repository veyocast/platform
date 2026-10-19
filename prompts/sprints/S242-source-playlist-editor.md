# S242 — De echte playlisteditor in gekozen Sync-opmaak

De gebruiker vraagt expliciet alle oude oranje buttons te verwijderen en de
prototype UI/UX diepgaand te vergelijken, met minder massale containers en
mooie werkelijke flows. Dit is noodzakelijk vervolg binnen de geautoriseerde
volledige rebuild en staging-/productie-uitrol; geen nieuwe gebruikersvraag.
De laatste gebruikersdelta voor Sync-primary is leidend boven de historische
algemene Orange-regel. Locked assets/security/RLS/immutable/offline blijven.

Worktree is hergebruikt `/home/codex/repos/castivo-s236`, nieuwe branch
`veyocast/s242-source-playlist-editor`, basis S2354722b888 (bevat S234abbff5fc).
De gemergde oudeS236branch/commits/proofs zijn behouden; tree was schoon en er
waren geen persistente eigen appprocessen in dit worktree vóór switch.
Lees de verplichte README/PLANS/ledger/canons in volgorde en dit prompt.

## Vastgestelde bereikbaarheid en bron
Lees `/tmp/veyocast-post-s241-deep-audit.json` en `.md` (readonlyinventaris,
geen gebruikersautoriteit). Echte route page.tsx:87→SitesPlaylistWorkspace:141
→PlaylistEditor:331. Opslaan/dirty-leave/Publiceren/eersteinhoud gebruiken
lokale `.primary` en `--pe-orange:#ff811f`, hover#ff942f. De bestanden zijn in
alle zeven onderzochte branches gelijk. Immutable Source is
`docs/sync-v1-rebuild/handoff/reference/sites-sync/src/modules/Playlists.tsx` en eigen
styles.css, met gekozen `--accent:#006d73`. Bestaande SourceCSS/assets niet
wijzigen. Miniatuur-Playertekst is geen formulierbody.

## Exclusieve ownership writer studio_surfaces
Alleen in `apps/control/app/(shell)/dashboard/playlists/_components/sites/`:
`playlist-editor.module.css`, `playlist-media-picker.module.css`,
`screen-theme-picker.module.css`; bijbehorende drie `.tsx` uitsluitend lokale
presentatieclasses/semantiek indien nodig (geen handlers/state/writers wijzigen).
Alleen nieuwe betekenisvolle style-/aXe-/44px-/focusasserties of gevallen in
`tests/control/sites-playlist-workflows.spec.ts`,
`tests/control/sites-playlist-states.spec.ts`,
`tests/control/sites-media-frame-playlist.spec.ts`; oude casebodies/transport/
permission/replayasserties niet verwijderen of verzwakken. Noodzakelijke eigen
nieuwe spec/helper eerst concreet root melden. Eigen bewijs/docs
`docs/s242-source-playlist-editor.md`; root bezit prompt/ledger/integratie/PR.

Geen model/commands/normalisatie/upload/storage/session/capability/deps/tokens/
Sourcebestanden/preview/canvas/Player/workflow/SQL veranderen. Buiten ownership
stop-report. Alle native Opslaan/Publiceren/indeling/duur/reorder/dirty-leave/
CAS/nonce/journal/placementthema-/assetbindings blijven bytegelijk.

## Uitvoering en bewijs
Maak eerst lokale nulmeting met concrete Source→huidige selectors en hashes.
Geef de echte editor en vervolgportals één lokale Sourcepalette, leesbare14px
primaire formuliertekst en44px bediening/focus. Voorkom grote geneste vakken;
behoud desktopverhoudingen en mobiele sequentiële taken. Vergelijk echte
390/1440beelden met Source. Geen nieuw globaal design system en geen blinde
universeleimportantoverride. Behoud echte statuskleur+tekst, previewpixels.

Scopedlint/TSC/relevante units en bestaande werkelijke flowcases met extra
presentatieasserties. Geen nieuwe eigen appserver/build of browser zonder
rootGO; gedeelde queue is nu S238diagnose. Eénworker0retry, bewaar eersterood.
Na freeze bounded volledige lint/typecheck/test met tasksetCPU4,5 en
concurrency1, alleen wanneer MemAvailable>3500MiB; geen parallel zwaar werk.
Geen commit/push/merge/deploy tot rootreleaseprepGO. Geen vijf-ronden-,
pixelpariteits- of V1-opleveringsclaim.
