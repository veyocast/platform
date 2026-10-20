# S264 — Bewezen integratiefouten uit CI

De volledige CI op 92cc vond één TypeScriptfout en vier falende browsercases. De save-receipt van het Sourceformulier werd alleen met de eigenschap `configuration` vernauwd. Omdat het commandcontract ook een strikt leeg publishrequest bevat, kon TypeScript daarmee de verplichte bron- en template-ID’s niet bewijzen. De bevestigde save-request wordt nu met de bestaande strikte `syncDynamicRequestSchema` gelezen; de canonical draft krijgt expliciet het bestaande `Draft`-type. Permissions, receipts, herstel, prijsbevestiging en publicatiegedrag blijven dezelfde keten volgen.

Drie testbestanden waren achtergebleven op de geïntegreerde features: de LED-focus verwachtte nog de te lichte mintkleur van vóór S263; de platformlayout pinte de oude Source-CSS-hash; de catalogusfixture kende de vier nieuwe prijsactie-exports niet. De bestaande focusassertie leest nu de goedgekeurde native sRGB-kleur onafhankelijk van CSS Color 4-serialisatie. De CSS-pin is onafhankelijk vergeleken met de eerdere versie: exact één al gereviewde focusregel verschilt. De prijsacties hebben een aparte expliciet weigerende fixturegrens; een onverwachte prijsopdracht wordt nooit als succesvol nagebootst. Alle overige assertions, inhoudspixelvergelijkingen, widths en verloren-antwoordscenario’s blijven behouden.

## Werkelijke verificatie

- Gerichte ESLint op alle vier gewijzigde code-/testbestanden: exit 0.
- Volledige echte Control-typecheck, zonder incrementalcache, Nodeheap2048MiB: exit 0 in 28,236 s.
- De drie bestaande Chromiumbestanden: 11/11 PASS in 39,8 s, één worker, nul retries/skips. Mobiel390 en desktop1440, native focus, ongewijzigde slidepixels en catalogusread-/commandherstel zijn uitgevoerd.
- De bestaande S261 Source-/prijsjourney na de parsercorrectie: 2/2 PASS op390/1440 in21,7s, zonder skips/retries; dezelfde gecontroleerde canonical save/readback en lost-ACK/sourcewissel zijn uitgevoerd. Bewijs: `/home/codex/.local/state/veyocast-s244/s264-scoped-22ba6639-ff20-4e95-81d7-99c2bf0f03a7/`.
- Eigen procesgroepen zijn gesloten; Chrome[] en alle vier bronhashes bleven gelijk.

De bewijzen staan onder `/home/codex/.local/state/veyocast-s244/s264-scoped-504efa67-bca7-40c2-a7c5-0a2ac49aefea/`; de voorafgaande groene lintclosure onder `s264-scoped-b3507b4e-2287-4dc1-bdc8-781d5b46803b/` gebruikt exact dezelfde vier bronhashes.

De eerste lokale start mislukte doordat pnpm11 in de nieuwe werkmap automatisch dependencies controleerde en bestaande gedeelde koppelingen verwijderde. Een gewone offline/frozen-install sloeg herstel eerst over door optimistic-repeatmetadata. De tweede gewone offline/frozen-install met uitsluitend die optimalisatie uit herstelde de koppelingen werkelijk; bron en lockfile zijn bytegelijk. Er zijn geen dependencyversies gewijzigd. Een eerste typecheck met de pure1024MiB-heap stopte op zijn eigen Nodeheaplimiet; de toepasselijke foundationheap2048MiB sloot groen. Alle rode logs en closures blijven bestaan. Nieuwe finale installatieverificatie is vereist vóór de gecombineerde gates.

Dit is geen volledige productacceptatie. S244 houdt de volledige foundation/exact-head CI, a11y, nieuwe productionbuilds, echte capturecohort, negen eerdere React418, vijf complete visuele controles en staging/productie open. Er zijn 0/5 complete visuele rondes afgerond; er is nog niets nieuws gedeployd.
