# Slide-outputscope en compatibility seam

De platformhandoff reserveerde deze scope voor een latere opdracht. De tegelijk
aangeleverde `CODEX_AUTONOMOUS_PROMPT.md` is die opdracht en maakt slide-output
onderdeel van S144. Dit document bewaakt de seam; het schuift de uitvoering niet
door.

## In S144

- `fieldflow` als enige zichtbare theme-id voor nieuw/muteerbaar werk;
- tien verborgen legacy IDs voor bestaande frozen releases;
- alle 64 coverage-rijen in modern, static LG, preview, thumbnail, poster en
  fallback;
- alle editorconfiguratie aantoonbaar door snapshot en assetclosure;
- 22 categoriespecifieke Studio-systeemtemplates;
- motion-state-machine, beide logical canvases, paginering en safe areas;
- volledige menu-, nieuws-, sport-, LED-, Engage-, YouTube- en sponsorpariteit;
- Player system states zonder wijziging aan LKG/immutable/offlinecontracten.

## Permanente compatibility seam

Een frozen item selecteert op zijn opgeslagen theme-/snapshotversie:

1. `fieldflow` gebruikt de nieuwe resolved viewmodel- en rendererfamilie;
2. een bekende legacy ID gebruikt de bestaande historische renderer;
3. een onbekende of corrupte ID activeert nooit een nieuwe release en krijgt
   een expliciete fout/fallback, niet stil `editorial`;
4. raw image/video gaat door de bestaande pixelbehoudende mediarenderer;
5. static LG krijgt dezelfde data en assets, maar eigen ES5/Chrome79-veilige
   outputcode.

Historische records, publicaties en user designs worden niet gemuteerd. Nieuwe
templateversies en defaults zijn additief.

## Buiten softwarebewijs

- fysieke LG 43UL3J-EP-, Android TV-, telefoon- en tabletacceptatie;
- winkel-/Play Console-publicatie en screenshots;
- juridische/merkbevestiging vóór publiek gebruik van AI-fotografie;
- langdurige productie-soak.

Deze punten blijven `EXTERNAL_UNTESTED`; emulatorbewijs verandert die status
niet.
