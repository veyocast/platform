# S281 — Stabiel eerste Goal Overlay-voorbeeld

Vervolg op de daadwerkelijke S244-beeldreview. De eerste1440-preview op74eb
gebruikt soms0,847px signage-eenheden: headline5,932px/score6,780px. Een gewone
resize met dezelfde data herstelt5,08px en35,56/40,64px. Dat bewijst een gemiste
hermeting; font-/layout-readiness is een gerichte hypothese, geen bewezen volledige
oorzaak. Afzonderlijke CSSOM-tegenproef bewijst wel dat .preview p de minutentekst
van de gedeelde renderer overschrijft. Behoud alle oorspronkelijke bewijzen.

Ownership: uitsluitend goal-overlay/editor.tsx, nieuw
 goal-overlay/goal-overlay-preview.tsx en goal-overlay/goal-overlay.module.css
onder apps/control/app/(shell)/dashboard/studio/led-scores/; nieuw
 tests/control/goal-overlay-preview-readiness.spec.ts; dit prompt,
 docs/s281-goal-preview-readiness.md en de eigen TASK_LEDGER-regel.

Maak uitsluitend een app-lokale previewgrens die de bestaande gedeelde
GoalOverlay monteert wanneer de gebruikte lokale Roboto-gewichten en de layout
beschikbaar zijn. Laden is zichtbaar/toegankelijk, eindig begrensd en heeft een
normale fontfallback. Late succesvolle fontlevering krijgt één nieuwe meting;
geen polling, interval, nieuwe API of dubbele renderer. Behoud alle parent-
formulierstaat en focus. Begrens de bestaande preview-p-regel tot directe UI-
paragrafen. De gedeelde renderer/Player/offline/Static-LG/contracten en locked
assets blijven bytegelijk; geen typografie-natekening of vaste canvas-schaal.

Bewijs twee echte native browsergevallen op390/1440 met vertraagde echte font-
bytes, laad-/fallback-/herstelflow, behoud van invoer/focus en dezelfde renderer-
maatvoering als een zelfstandige referentie. Bestaande scenarioasserties en
budgets blijven behouden. Lint/typen en finale echte Next-build/readbacks volgen;
fixturebewijs vervangt geen werkelijke appacceptatie. Root blijft integrator;
geen vijf-ronden-/algemeneAA-/hardware-/deployclaim vanuit deze feature.

De nieuwe browservergelijking toont daarnaast Source-p-lineheight die de
voorbeeldinhoud bereikt. Isoleer daarom uitsluitend het app-previewcanvas met
een open ShadowRoot en dezelfde gedeelde GoalOverlay; zijn standaardregelafstand
volgt de zelfstandige Player-context. Geen tweede renderer of gewijzigde
inhoudsstyles. De zelfstandige testreferentie krijgt een identiek containing
block: procentuele canvaspadding mag niet tegen de hele browserbreedte rekenen.
Dit corrigeert de referentiecontext, geen tolerantie of afmetingsassertie.
