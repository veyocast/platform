# S241 — Leesbare Studio en bewaarde portalflows

Status: lokale implementatie en relevante gates groen; eigen commit, integratie
van S234 en een draft-PR zijn aanvullend geautoriseerd. Branch
`veyocast/s241-source-studio-portals`, basis
`f05a6cf5d1e480206e1dacfd9046264a2d79a557`. De gemergde S231-branch en het
eerdere S231-bewijs blijven behouden; een mainmerge of uitrol is niet toegestaan.

De statische peerreview
`/tmp/veyocast-s239-static-orange-portal-density-peerreview.json` identificeert
twee actieve, ondersteunde Studio-paden: de hernoemflow vanuit
`/dashboard/studio?advanced=1` en revisieherstel voor een generiek Studio-document.
Beide gebruiken een bestaande rechtstreekse `document.body`-portal; de gedeelde
`DialogPortalProvider` geeft deze nodes geen Source-scope. Dit bewijst niet
dat de huidige tenant zulke generieke projecten heeft.

De beoogde lokale projectie is:

| Bestaande surface | Bestaande Source-authority | Lokale wijziging |
| --- | --- | --- |
| `ProjectActions` → `FloatingPanel` bodyroot | `.sync-control`, Manrope/Inter, `--surface`, `--text`, `--line`, `--accent`, `--mint` | Expliciete lokale scope op de bestaande portalroot; 14 px en minimaal 44 px voor de echte hernoemformulieren en acties |
| Generieke revisie-/previewbackdrop | Dezelfde Source-rollen | Alleen portalclasses/presentatie; bestaande sluiting en restorecommand blijven behouden |
| Opgeslagen Sync-ontwerp → properties | Immutable Source `content.css` projecteert 11 px desktopinputs en labels | Eigen moduleclass op de bestaande fieldset met begrensde 14 px/44 px-leesbaarheidsoverrides; geen canvas-/previewselectoren |

De actuele gebruikerskeuze voor Sync/petrol is leidend boven de oudere
Orange-primaireregel. De frozen Source-CSS wordt niet herschreven; dit is een
zichtbare, lokale leesbaarheidsafwijking van de kleinere Source-invoer.

`tests/control/sync-retained-studio-surfaces.spec.ts` gebruikt echte
`ProjectActions`, `StudioEditorWorkspace`, `SyncStudioEditor`, `FloatingPanel`,
Konva en product-CSS. Alleen Next-navigatie en de server-actiontransportgrens
worden gecontroleerd. De proef bewaakt op 390/1440 px de bodyportal,
computed palette/font/44px-geometrie, aXe, toetsenbord/Escape, conflictinvoer,
restore-CAS en immutable fixturehistorie. De Sync-case verliest de eerste
save-respons en herhaalt de exacte bestaande opdracht. Dit is componentbewijs,
geen bewijs van echte tenantdata, geauthenticeerde routes of databasereceipts.

De bestaande generieke editor had zijn revisietrigger alleen in het
desktopeditorpaneel. De 390 px-revisiecase opent echt met het toetsenbord
op desktop en verkleint daarna de viewport, als afzonderlijke layoutregressie.
Een aanvullende entry in de bestaande `MobileQuickEdit`-sectie gebruikt één
secondary History-knop naar de bestaande
`setRevisionPanelOpen(true)`-callback. De achtste case controleert de directe
390 px-ingang en de ongewijzigde readonlygrens. `canRestore`, `onRestore`, de
immutable revisiebron, CAS en nonce blijven dezelfde bestaande code.

De oorspronkelijke bronhashes zijn vóór productwijzigingen bewaard in
`/tmp/veyocast-s241-studio-proof/before-hashes.json`. De product- en test-ESLint,
Control-TypeScript en afzonderlijke spec-TypeScript zijn groen. De relevante
editorstate-/Konvacontracttests zijn 9/9 PASS met maximaal twee Vitestworkers.
De actuele browser-eindrun is 8/8 PASS, 0 skips en 0 retries op één worker in
20,5 seconden. De volledige workspace lint/typecheck/test zijn elk 30/30 PASS.
Eindhashes en de afzonderlijke integratie-/releasegates blijven expliciet.
Er is geen algemene pixel-, V1- of vijf-rondenclaim.

De werkelijke nieuwe fixturebundle is vóór productwijzigingen apart
gecompileerd. De eerste fixturecompile ving door een te brede transportresolver
ook het echte `ProjectActions`-component; alleen die resolver is gecorrigeerd.
De oorspronkelijke harnessfout staat in
`/tmp/veyocast-s241-studio-proof/harness-first-compile-error.txt` en telt niet
als productregressiebewijs.

De oorspronkelijke achtcase-browsernulmeting is 7 FAIL / 1 PASS zonder skips
of retries. Vijf concrete fontasserties vonden 12 px hernoeminvoer, 13 px
herstelacties en 11 px desktop-Sync-invoer. Eén case vond de ontbrekende
mobiele geschiedenisentry. De mobiele Sync-case stopte op een fout in de
nieuwe relatieve labellocator; de 12 px mobiele labels uit de Source-CSS zijn
daarmee geen afzonderlijk browsermeetresultaat. De originele run blijft in
`first-red/` bewaard.

De eerste run na de productcorrectie is 3 PASS / 5 FAIL in 45,4 seconden.
Hernoemen op beide breedtes is groen; de twee screenshots zijn bekeken.
Vier gevallen stopten op twee eigen fixtureaannames: de relatieve labellocator
zocht ten onrechte opnieuw naar de properties-ancestor, en de generieke
restorecase verwachtte copy uit een gesloten RenderPanel. De gecorrigeerde
proef controleert de werkelijke conflictbanner en de opnieuw geopende
conceptrevisie. Alle command-, nonce-, immutable-history-, focus-, Escape- en
aXe-asserties blijven behouden. Een vijfde geval vond werkelijk een bestaande
aXe `aria-prohibited-attr`: de Konva-viewport had een `aria-label` zonder role.
De extra goedgekeurde wijziging voegt uitsluitend `role="group"` toe aan die
bestaande wrapper. Drawcode, geometrie en events blijven exact gelijk.

Ook deze rode run blijft onaangeroerd in `final/`. Beide oorspronkelijke
specbestanden zijn met hun opgeslagen SHA-256 geverifieerd en apart bewaard
als `original-spec.ts`; `fixture-corrections.json` onderscheidt de eigen
harnesscorrecties van productcorrecties. De statische exacte diffcontrole in
`logic-and-source-invariants.json` bewijst de afgesproken class-/entrydiff,
de ene propertiesclass, de ene Konva-role en de bewaarde zes beschermde
bronhashes. Er zijn geen database-, credentials-, dependency-, Source-CSS-,
service-worker- of Playerwijzigingen uitgevoerd.

De eerste correcte achtcaserun is 8/8 PASS in 19,8 seconden (`final-v2/`).
Alle zeven captures zijn daadwerkelijk bekeken. Die visuele review vond dat
één checkpoint door de bestaande gridstretch bijna de hele revisiekolom vulde;
de bestaande lijst heeft daarom alleen `align-content: start` gekregen.
De oorspronkelijke achtcases controleren nu aanvullend dat de geselecteerde
checkpointkaart tussen 44 en 120 px hoog blijft. Bovendien wacht de
capturehelper na aXe twee animationframes op de bestaande
ResizeObserver-positionering, zodat descriptor en screenshot dezelfde
uitgelijnde popover meten. De viewportgrens heeft geen pixelmarge.

De finale huidige versie in `final-v3/` is opnieuw 8/8 PASS in 20,5 seconden,
zonder retries of skips. Alle zeven huidige captures zijn opnieuw bekeken:
leesbare properties, compacte revisiekaart, bruikbare restoreactie op 390 px,
zichtbaar uitgeschakelde readonlyactie en rustige petrol-hernoemformulieren.
Alle zeven aXe-controles hebben nul overtredingen. De ontbrekende generieke
canvasinhoud is de expliciete lege documentfixture; er wordt geen feitelijke
klantcontent of pixelpariteit mee geclaimd. Browser en Playwright zijn na
iedere run afgesloten; er is geen eigen Next-runtime gestart.

Na de bronfreeze zijn de volledige workspacegates sequentieel uitgevoerd met
`taskset -c 4,5` en Turbo `--concurrency=1`: lint 30/30 PASS met 29 cached,
typecheck 30/30 PASS met 29 cached, test 30/30 PASS met 28 cached. Control
voerde 1.272 tests uit; de 34 bestaande conditionele skips zijn niet als nieuwe
uitgevoerde browserproeven geteld. De logs staan onder
`/tmp/veyocast-s241-studio-proof/foundation/`. De actuele bron- en capturehashes,
exacte scopecontrole en visuele review staan naast de behouden rode runs in
hetzelfde bewijsdirectory; `final-hashes.json` is het overdrachtsmanifest.

Deze taak levert geen nieuw productieaccount, database-/providerbewijs,
productionbuild, algemene a11y-/E2E-suite, Sourcepixelvergelijking of volledige
V1-acceptatie. De bestaande generieke restorecopy zit in het renderpaneel;
de proef beweert geen nieuwe zichtbare succesmelding. Echte tenantflows en
de gecombineerde CI-/releasegates blijven afzonderlijk. Na deze lokale
bewijsafsluiting is de writer aanvullend geautoriseerd om de eigen wijziging
te committen, de bestaande S234-branch via een normale merge te integreren en
na groene geïntegreerde gates uitsluitend de eigen branch te pushen en een
draft-PR te openen. Mainmerge en deployment blijven uitgesloten.

Releasevoorbereiding: de product-/test-/documentatie-eenheid is vastgelegd als
`c54b34e6`. De normale merge van S234 op
`abbff5fc4b608e54944c2b8390fa2887103c3e1c` is automatisch conflictvrij.
Beide ledgerbijdragen zijn exact behouden. Het gedeelde
`sync-studio-frame.tsx` is exact die upstreambron met alleen de S241-fieldsetclass
toegevoegd; de bestaande filmstrip- en navigatiecallbacks blijven behouden.
De staged en gewone diffchecks zijn groen, zodat geen inherited EOF-helpertrim
nodig was. Er was geen productcodeconflict; de acht laatste S241-browsercases
blijven daarom het expliciete pre-integratiebewijs en zijn niet ten onrechte
als nieuwe meting van de merge gepresenteerd. De geïntegreerde volledige
foundationgates worden hieronder afzonderlijk geregistreerd.
