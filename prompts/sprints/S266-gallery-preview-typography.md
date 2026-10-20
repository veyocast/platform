# S266 — Galerijlabels blijven buiten slidepreviews

Gerichte correctie binnen de volledige visuele rebuildopdracht. Eigen branch en
worktree `veyocast/s266-gallery-preview-typography` / `castivo-s266`, basis
`177e5d02e5bf953e70676ee7db3fcb9e696c6d04`.

Ownership: `apps/control/app/sync-source.css`,
`tests/control/sync-template-picker-layout.spec.ts`,
`docs/s266-gallery-preview-typography.md`, deze prompt en uitsluitend de eigen
S266-regel in `TASK_LEDGER.md`. Geen dependency-, token-, renderer-, database-,
asset- of Playerwijzigingen. Nieuwe scope is gemeld vóór de wijziging.

De echte ongewijzigde galerijcapture op 177e toont een te grote clubslogan.
De globale kaartselectors voor `strong` en `small` raken ook deze elementen
binnen de gedeelde slide-renderer. Beperk de zes kaarttypografieregels tot de
directe metadata onder de preview, voor alle drie bestaande breakpoints. Dit
geldt voor zowel Nieuw ontwerp als de bestaande Template kiezen-dialoog.

Bewijs eerst native rood op de bestaande CSS: vergelijk alle sterke/kleine
tekstelementen van alle 36 previews met dezelfde renderer zonder kaartomhulsel,
bij exact dezelfde canvasbreedte, op 390, 700 en 1440 px. Controleer na de fix
ook de bestaande volledige galerij-, keyboard-, aXe-, receipt- en viewergevallen.
De test gebruikt de echte UI/CSS/renderer, met uitsluitend gecontroleerde
servertransporten; dit is geen daadwerkelijke publicatie- of volledige
prototypeacceptatie. Bewaar rood/groen en eigen PNG's. Eén eigen browserworker,
nul retries, CPU4,5/heap1024 en de bestaande geheugenondergrens.

Gebruik alleen exact bewaakte tijdelijke dependencylinks en de concrete CLI;
geen pnpm run/exec met gedeelde links. Verwijder uitsluitend de eigen links na
readlink/inodeguards. Lint/typecheck, relevante native tests en scopecontrole
vóór commit. Integrale gates en vijf volledige reviews blijven S244.
