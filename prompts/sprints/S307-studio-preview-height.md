# S307 — Niet-lege Studio-preview in een container met automatische hoogte

ROOT-opdracht van 10 november 2026, basis gecombineerde S305/S306-head `0de91d599637d3adb7be949be56a6c01a403dc25`. Aparte branch/worktree `veyocast/s307-studio-preview-height`; ROOT integreert gewoon in PR337 en beheert main/deploy.

Echte read-only PREVIEW9 op staging M `a46c56f` toont een 0 × 0-frame/SVG, een stage van 1050 × 10 met clientHeight 0 en een ResizeObserver-container van 1040 × 0. De programmacards bestaan in de SVG-foreignObject, maar de zichtbare overflowclip verbergt ze. Echte Playeracceptatie blijft afzonderlijk; dit is geen grid-, logo-, provider-, database- of publicatieprobleem.

Ownership database_matchday: uitsluitend het hoogtecontract tussen SyncStudioFrame en de gedeelde SyncSlidePreview, betekenisvolle rood → groen-browsertest in de bestaande echte StudioEditor-fixture, eigen prompt/doc/evidence en ledgerregel naast S306. Gebruik de bestaande intrinsic-optie voor de autohoogtecaller; behoud fixed-slotcontainment, renderer, motion, paginering, ontwerpen en immutable bytes. Geen CSS-injectie of versoepeling van de private hostedprobe of Playerguards. Geen dependency-installatie, lockfile-, SQL-, Worker-, Player-, workflow- of hostedmutaties.

De regressie laadt echte broncomponenten en Control-CSS zonder hoogte op de defecte child te forceren. Meet niet-nulframe, juiste 16:9/9:16-verhouding, volledige card-/tekstbounds, natuurlijke volle6/laatste3 respectievelijk 5/4, resize en beide oriëntaties. Behoud bestaande preview/play/pause/reduced-motion/manual/historische gevallen. Scoped lint, Control-types en relevante tests lokaal; normale gecombineerde elf CI-gates en nieuwe hostedpreview pas op de uiteindelijke tree. Geen push/PR vóór ROOT-review.

ROOT heeft de afzonderlijke terugbladlus laten vergelijken met de exacte oude caller. Ook die oude bron faalt na Volgende → Vorige met Maximum update depth. Daarom is zij expliciet bestaand/open gedocumenteerd en valt een paginalogicawijziging buiten deze opdracht. Geen testtimeouts of bestaande asserties versoepelen.
