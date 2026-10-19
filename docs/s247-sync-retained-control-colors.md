# S247 — Sourcebediening in behouden Control-schermen

De echte auditdetails en de behouden huisstijleditor gebruikten nog oude oranje
UItekst en selectieranden. Binnen de gekozen Sync-werkplek gebruiken deze
controls nu de bestaande Sourceaccent-/zachtaccentrollen. Commandodetails,
moduskeuzes en presetbuttons hebben primaire tekst14px en minimaal44px targets.
Dit is een expliciete bedieningscorrectie; oude controlgeometrie wordt niet als
ongewijzigd geclaimd. Buiten Sync blijven de bestaande regels van toepassing.

De wijziging raakt uitsluitend twee CSSbestanden. Auditmarkup, session- en
readmodelguards, editorhandlers, canonical paletgenerator, hidden formwaarden,
formuliertypes en immutable publicaties blijven ongewijzigd. De zes echte
presets en hun swatches blijven hun eigen kleur tonen: ook werkelijk gekozen
Oranje blijft RGB224/106/20 in het palet en canvas. Alleen de geselecteerde
UIrand gebruikt het Sourceaccent. Er is geen globale `--vc-action`-override.

De aansluitende echte accountbevinding is ook afgebakend hersteld. Eigenaar
gebruikte onder opgeslagenDonker lichte tekst op de vaste lichte neutrale
statusachtergrond: contrast1,035858:1. De Sync-neutrale badge gebruikt nu
bestaande vaste Source-inkt, met contrast12,850936:1 in Licht en Donker. De
achtergrond RGB240/243/241, rand, badgegeometrie, labels en dotstructuur blijven
gelijk. De bestaande currentColordot volgt de herstelde voorgrond; bitgelijke
oude dotkleur wordt niet geclaimd. Andere statuskleuren zijn niet aangepast.

## Toetsing en bewaarde grenzen

De twee finale componentgevallen390/1440 slagen2/2 zonderretry ofskip in
13,342seconden. Zij renderen de echte auditlogpagina met expliciet gecontroleerde
sessie/readmodelgrens, de echte TenantThemeEditor/EditorialThemeEditor en alle
actuele rootstyles plus gebundelde lokale CSS. De werkelijke SSRbootstrap leest
opgeslagenDonker bij een licht OS; HTMLattribuut en opslag zijn gecontroleerd.
Er is geen live Auth/RLS/database-/provider-/saveclaim.

Dezelfde huidige testbron werd vóór de neutrale kleurregel echt rood: beide
gevallen maten1,035858:1 en aXe bevestigde de fout. Na uitsluitend die regel is
dezelfde bron groen. Eerdere ongewijzigde productCSS bewees daarnaast de echte
oranje/12px/32px/36px-afwijkingen. De eerste fontloaderfout vóór browseruitvoering
blijft afzonderlijk bewaard; het harnas bundelt nu de werkelijke lokale fonts.

Getoetst zijn Sourcekleuren,14px/44px, keyboard open/sluiten/focus van de native
auditdetails, echte modus-/presetkeuzes, volledige canonical payload en
canvasHTML/stijlen, vaste presetkleuren, vier gerichte aXe-controles met nul
violations én nul incomplete, de kritieke status als negatieve controle en
ongewijzigde buitenSyncregels. De pure paletverwachting gebruikt dezelfde echte
generator; previewacties veroorzaken geen POST. Bij deze eerste afsluiting:
verwijder uitsluitend de vier
nieuwe CSSmoduleregels en twee adapterregels, dan zijn beide bestanden exact
bytegelijk aan basis42d198b7. SourceCSS, tokens, gedeelde styles, handlers,
package- en lockfilehashes zijn gelijk aan de basis.

Strikte specTypeScript, scoped ESLint en diffcheck slagen. Runner27822 eindigt
werkelijk metexit0 en na afsluiting zijn geen chrome/chromiumprocessen aanwezig.
Er is geen eigen Nextbuild, runtime, installatie, databaseactie, commit ofpush
gestart. Root verwerkt ledger, review, gecombineerde CI en normale uitrol.

## Ruwe pixelgrens

Een desktopcanvas-PNGvergelijking week reeds bij de ongewijzigde productCSS af
na een bewerkingstabwissel, ondanks gelijke canonicalconfiguratie en stijlen.
De bestaande desktoppreviewrail is sticky; aanvankelijk waren viewportposities
verschillend. Ook na terugkeer naar dezelfde natuurlijke scrollpositie,
volledige Lichtstaat, gelijke canvasHTML/bbox en font-/animationreadiness bleef
een ruwe native rasterafwijking bestaan. Er is geen volledige oorzaakfix bewezen.

Alle oorspronkelijke PNGs, hashes, traces en metadata zijn behouden. De
voorafgaande diagnose telt voor twee313×177beelden12.284 en11.168afwijkende pixels
met maximumkanaalverschil255. De finale390beelden zijn onderling exact; de
finale1440beelden blijven afwijkend en expliciet `pixelPassClaimed:false`.
Geen tolerantie, resize, maskering of pixelnormalisatie is toegevoegd. De
inhoud-/payload-/canvasHTML-/style-invarianten blijven exacte gates; deze taak
claimt geen canvaspixelpariteit, algemene AA, volledige V1 of vijf ronden.

Bewijs: `/dev/shm/veyocast-s247-retained-control-colors/final-proof.json` en
`product-invariants.json`; alle eerdere pogingen en ruwe resultaten blijven
naast de finale rapportage staan. Finale actuele routecapture en release volgen
als afzonderlijke S244-gates.

## Laatste editorchromerollen

Na visuele review is de taak vóór commit smal heropend. Alleen de werkelijke
editorsectielabels, open/sluitindicator en gecombineerde hover-/focusrol van
het tokenveld gebruiken aanvullend Sourceaccent/accent-soft. Labels en
indicator behouden hun oorspronkelijke font en geometrie. De focusregel geldt
uitsluitend zonder ongeldige HTMLinvoer of aria-invalid; bestaande foutrollen
blijven van toepassing. Buiten Sync blijven de oorspronkelijke regels werken.

De aanvankelijk voorgestelde ContrastSummary-aanpassing is bewust niet gedaan:
echte JSX zet altijd data-valid=true/false en de bestaande specifieke
succes-/criticalrollen overstemen de generieke fallback al. Dezelfde twee
componentgevallen controleren daadwerkelijk geldige invoer, leegmaken,
contrastongeldig wit en volledig herstel. Er is geen gefingeerde attribuutloze
samenvatting en geen brandingoverride over een statuskleur.

De uitgebreide eerste rode uitvoering is behouden:2FAIL in9,341s. Na alleen
deze drie kleurrollen en een aantoonbare harnascorrectie slagen dezelfde twee
gevallen390/1440:2PASS in18,139s, nul retry/skip, runner3916exit0, Chrome[].
Vier gerichte aXe-rapporten bevatten nul violations en nul incomplete. Echte
Donker-neutrale Eigenaarstatus blijft12,850936:1; kritieke stijlen,14px/44px,
toetsenbordbediening, canonicalpayload, contentaccent/presets en buitenSync
blijven gecontroleerd. Geen extra browsercohort, build of foundationrun.

De harnascorrectie betreft uitsluitend CSSserializeervolgorde na de nieuw
toegevoegde echte invoerherstelcyclus. React voegt een verwijderde en herstelde
--vc-text-property achteraan toe. Ruwe voor/na-HTML en stijlstrings blijven
behouden; de nieuwe herstelcontrole vergelijkt de complete DOM met alle
inline CSS-property/value/priorityparen exact. Een werkelijke reload brengt
dezelfde beginsituatie terug vóór de oorspronkelijke volledige
canvasHTMLvergelijkingen. De eerder gedocumenteerde rastergrens blijft gelden;
er volgt geen pixel-PASS uit deze controle.

De oorspronkelijke proof ce297d75… en freeze38eb8587… zijn onaangeroerd.
Nieuw bewijs staat apart in
`/dev/shm/veyocast-s247-retained-control-colors/three-role-extension/`.
Verwijder de uiteindelijke zes aanvullende CSSmoduleblokken en twee
adapterblokken, dan zijn beide productbestanden bytegelijk aan basis42d198b7.
Geen handler-, token-, Source-, content-, dependency- of statusregelwijziging.
Finale actuele gebouwde routecapture, gecombineerde CI en uitrol blijven
afzonderlijke rootgates; er is geen algemene V1-/AA-/vijfrondenclaim.
