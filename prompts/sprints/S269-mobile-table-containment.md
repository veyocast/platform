# S269 — Mobiele hoofdruimte blijft op zijn plaats bij gevulde tabellen

De echte S244-captures op390px tonen horizontale hoofdruimtescroll buiten de
bedoelde tabel: Activiteit66px, Team57px, Platformsysteem89px en eigen
tenantdetail36px. Documentoverflow is tegelijk0. De visuele/native-scrollcontrole
heeft daarom een werkelijke afwijking gevonden die de lege responsivefixtures
niet afdekken. Behoud alle rijen, labels, acties en de eigen tabelscroll.

Root is de enige writer in `/home/codex/repos/castivo-s269`, branch
`veyocast/s269-mobile-table-containment`, basis S268
`6ab5ef0d5a0ff43a83aba5eb4b59e28452ed2001`. Eigen PR eerst op S268; na diens
normale integratie mag de PR naar S244 worden gericht. Geen wijziging van de
actieve bevroren S244-runtime/captures tijdens die uitvoering.

Exclusieve ownership:

- `apps/control/app/sync-adapter.css`: de drie bestaande tabelscrollframes als
  positioneringsbasis voor geclipte toegankelijke labels (Team). Alleen mobiel
  mogen bestaande responsiveDataTable-cellen tekst normaal afbreken, lange
  waarden afbreken en hun directe kinderen krimpen. Bestaande contextlijst-items
  en hun tekstdiv mogen binnen hun workspace-section krimpen/afbreken.
  Dit sluit de daadwerkelijk bewezen andere oorzaken in Activiteit, Systeem en
  tenantdetail. Geen overflow verbergen, kleuren/rijen/teksten verwijderen of
  de hoofdruimtebreedte forceren.
- `tests/control/sync-team-workflows.spec.ts`: bestaande lege flow behouden;
  aanvullende bestaande echte Team-pagina met expliciet gevulde gecontroleerde
  leesmodellen op390/1440. Bewijs hoofdruimtebreedte, afzonderlijke tabelscroll,
  vaste titelpositie, semantische inhoud en geen writes.
- `tests/control/sync-platform-mobile-layout.spec.ts`: uitsluitend de exacte
  beschermde adapterhash actualiseren; alle andere guards/asserties blijven.
- dit prompt, `docs/s269-mobile-table-containment.md`, eigen ledgerregel.

Bronhiërarchie/invarianten uit S244 blijven gelden. Geen generieke nieuwe
verstopregel, dependency, shared-UI-, Source-, asset-, schema-, serveractie-,
permission- of Playerwijziging. De gewone Source-tabelscroll blijft bruikbaar.
Eerst daadwerkelijk rood-groen en gerichte native verificatie met gevulde
inhoud; controleer de vier eerder geobserveerde echte paginatoestanden apart.
Controleer vervolgens bestaande platformlayoutcases en normale CI. De oude
8e03-beelden blijven als eigen oorspronkelijke waarneming behouden; nieuwe
correcties krijgen een expliciet afzonderlijk bron-/nativebewijs. Geen vijf-
ronden-, pixel- of V1-compleetclaim op grond van deze beperkte reparatie.
