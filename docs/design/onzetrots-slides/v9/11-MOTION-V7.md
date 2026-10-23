# Gefaseerde entree v7 — 23 oktober 2026

V7 voegt een vaste entreevolgorde toe aan de goedgekeurde v6-layout. De v7-broncommit van deze behouden motionbaseline is `d5005d8cc7cdb794edb3b1a40cda70a3491b2b0c`. De **160 statische layoutcaptures** en vier contactbladen blijven afkomstig van v6 `bf41fd2861efbf0e6e6af9128012d8062e37344e`; zij tonen de ongewijzigde eindlayout en zijn geen bewijs van de nieuwe tijdlijn. V7-motionbewijs wordt afzonderlijk opgenomen met zijn eigen bronidentiteit en opnamecontext. De VeyoCast-productie-implementatie en productietests zijn hiermee niet uitgevoerd.

## Tijdlijn

Alle tijden zijn seconden sinds een nieuwe scène; beweging is toegestaan. Translate- en blurwaarden gebruiken logische pixels, gelijk aan het referentiecanvas. Paneelindex i begint bij nul; n is het aantal daadwerkelijke bovenliggende inhoudspanelen.

| Onderdeel | Start | Duur | Van → naar | Easing |
| --- | --- | --- | --- | --- |
| Achtergrond | 0 | 0,85 | Opacity 0 → 0,95 licht / 0,6 donker; scale 1,025 → 1 | `cubic-bezier(.2,.65,.25,1)` |
| Aparte kopcontainer | 1,25 | 0,65 | Opacity 0 → 1; translateY −16 → 0; blur 3 → 0 | `cubic-bezier(.16,1,.3,1)` |
| Inhoudspaneel i | `2,1 + i × 0,12` | 0,65 | Opacity 0 → 1; translateY 24 → 0; scale 0,985 → 1; blur 4 → 0 | `cubic-bezier(.16,1,.3,1)` |
| Footer | `2,6 + max(0, n−1) × 0,12` | 0,4 | Verschijnt naar zijn normale zichtbare eindstijl | `ease` |

De footer start bij n≥1 0,15 s vóór het einde van de laatste paneelentree. Voeg dus niet nog een extra wachtstap toe tot alle panelen volledig zijn uitgeanimeerd.

De referentie gebruikt `stageEntrance(screen)`: selecteer binnen `.slide-content` de semantische containers `.panel`, `.photo-panel`, `.pitch`, `.goal-scene` en `.video-layout`. Sluit containers uit die zelf een van deze semantische inhoudscontainers als voorouder hebben, voeg aan de overblijvende bovenliggende containers `scene-container` toe en zet `--scene-delay` per container. `--scene-footer-delay` volgt uit n. De aparte kop en footer hebben hun eigen animatie. Binnenliggende tabellen, rijen, teamregels en geneste panelen worden niet elk apart achter elkaar geanimeerd. Verborgen lege gridslots behoren niet tot deze selectie en tellen niet mee. Bij nul panelen begint de footer op 2,6 s.

Dit is de timing van de entree; bestaande ranglijstscroll, gegevenspaginering en andere toegestane inhoudsbeweging blijven aparte bewegingen binnen dezelfde scène. V7 verandert de eindmaten, vaste zes slots, bezoekersfit of logo-identiteiten niet. V8 behoudt deze tijdlijn maar wijzigt kopfont/headeropbouw volgens `12-WIJZIGINGEN-V8.md`; v7-beelden tonen die nieuwe opmaak niet.

De basisstijl `.scene-container` heeft `animation: none`. De nieuwe entree vervangt zo ook de oude vroege reveal van fotografie, veld, goal en video. Bij pauze/reduced motion staan deze containers direct compleet en stil.

## Pauze, reduced motion en replay

| Actie/toestand | Verwacht gedrag |
| --- | --- |
| Gepauzeerd renderen | Complete eindcompositie direct zichtbaar |
| Reduced motion | Complete eindcompositie direct zichtbaar; geen entree |
| Pauze tijdens entree | Complete eindcompositie zichtbaar; intro wordt als voltooid gemarkeerd met `intro-finished` |
| Hervatten na pauze | Gegevensbeweging gaat verder; intro wordt niet opnieuw gestart |
| Nieuwe render of familie | Nieuwe intro wanneer beweging is toegestaan |
| Expliciet opnieuw afspelen | `replayScene()` schakelt beweging in tenzij reduced motion actief is en rendert opnieuw |
| Studiobediening Opnieuw afspelen | Gebruikt `replayScene()` |
| Fullscreenknop `Opnieuw afspelen ↻` | Gebruikt dezelfde replayfunctie, ook wanneer de scène was gepauzeerd |

Bij een nieuwe render/replay zet de referentie tijdelijk `scene-reset` en forceert een reflow voordat de entree opnieuw start. Dat reset ook het behouden `:before`-achtergrond-pseudo-element: de achtergrond begint opnieuw bij opacity 0/scale 1,025 en loopt niet verder op een oude animatietijd.

Deze toestand hoort bij de actieve scène, niet bij canonical Sportlinkfeiten. Een replay is op zichzelf geen nieuwe inhoudspublicatie. De huidige familie, opgeslagen headerteksten, bezoekersschaal en overige vormgevingskeuzes blijven behouden. De replay rendert de scène opnieuw en zet daarmee de voorbeeldnieuwsindex en de ranglijsttijd terug naar het begin.

## Overnemen in VeyoCast

Gebruik dezelfde deterministische projectie van elapsedMs, layout, paneelvolgorde, thema en expliciete pauze/reduced/intro-finished-toestand in preview, moderne Player en ieder Worker-exportframe. De huidige generieke buitenste exporttransition en het hergebruiken van `settledPng` bewijzen deze interne tijdlijn niet. Pas het bestaande capturepad daadwerkelijk aan; bouw geen tweede losse browserrenderer naast de actieve Sync-keten.

Behoud strenge capture-CSP, verified assets, fonts/decode, checksums, complete fallback en last-known-good. Voer geen opgeslagen HTML/JS uit, gebruik geen eval en versoepel de CSP niet om prototypecode te laten draaien. Stel de tijd/toestand via gecontroleerde eigen rendercode in en neem die waar nodig in de framecache-identiteit op.

Verzamel tijdgecontroleerd bewijs vóór, tijdens en na achtergrond, kop, eerste/volgende panelen en footer. Test enkel/meerdere panelen, matchday, bezoekers 1–4, zesvaksgrids inclusief nul, beide thema’s/orientaties, pauze in elke fase, hervatten zonder herstart en replay in studio/fullscreen met en zonder reduced motion. Vergelijk representatieve preview-, export- en Playerframes op gelijk elapsedMs. De precieze acceptatiematrix staat in `05-ACCEPTATIE-EN-TESTEN.md`. Browserchecks en pakketchecks worden alleen als geslaagd vastgelegd wanneer ze daadwerkelijk zijn uitgevoerd; productiechecks blijven werk voor de VeyoCast-implementatie.

## Meegeleverd browserbewijs

`voorbeelden/motion-v7/01-achtergrond.jpg`, `02-header.jpg` en `03-containers.jpg` tonen de drie opeenvolgende stadia. De bijbehorende `motion-observations.json` vermeldt opnamecontext, waargenomen hosttijden en computed styles. De bronidentiteit van dit historische motionbewijs is de vastgelegde v7-commit. De beelden zijn representatief visueel beoordeeld; de opname claimt geen exacte frame-export. De aanvullende browserchecks en hun grenzen staan in `09-VALIDATIE.md`.
