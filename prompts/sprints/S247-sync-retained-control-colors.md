# S247 — Sourcekleuren voor behouden Control-bediening

Voer uitsluitend de drie concrete gebouwde UIbevindingen uit binnen de expliciete
gebruikersopdracht om oude oranje bediening te verwijderen. De actuele gekozen
Sync-presentatie gaat voor de historische algemene Orange-regel. Canonical
huisstijl-, preset-, preview- en canvaswaarden blijven ongewijzigd.

## Basis en ownership

Writer: release_audit. Hergebruik de vooraf schone oude S240-worktree
`/home/codex/repos/castivo-s227`, nieuwe branch
`veyocast/s247-sync-retained-control-colors`, exacte basis
`42d198b7b19f200be34593db8a61a7bfbe5292c2`. Oude branch en bewijzen behouden.
Lees README, PLANS, ledger, technische/design/Publisher/security/offlinecanons.

Exclusief vijf paden:

- `apps/control/app/sync-adapter.css`: uitsluitend `.sync-control .audit-details > summary`.
- `apps/control/app/(shell)/dashboard/dynamic-content.module.css`: uitsluitend
  Sync-gescopeerde `.editorialModeTab`-bediening en de daadwerkelijke
  `.editorialPalettePresets > div > button`-bediening, met geselecteerde UIkleur.
- `tests/control/sync-retained-control-colors.spec.ts`.
- `docs/s247-sync-retained-control-colors.md`.
- Dit sprintprompt.

Root doet ledger, gecombineerde integratie/build/CI en normale uitrol. Geen
commit/push, install, eigen Next-runtime of wijzigingen buiten deze paden.

## Feitelijke grens

Bronbevinding: `/dev/shm/veyocast-s244-integration/actual-orange-tint-candidates-v1.json`.
Commandodetails heeft echte oranje tekst; in het behouden FieldFlow-themascherm
hebben geselecteerd Blauw en Alles licht/Licht oude oranje UI-randen/tekst.
Kritieke statusachtergronden zoals `#fff0ef` zijn geen brandingdefect.

Gebruik bestaande Source-rollen accent/accent-soft/line/text; geen nieuwe
merkhex, geen globale `--vc-action`, geen tokens/sharedCSS/Sourcewijziging.
Root heeft vóór schrijven aanvullend dezelfde drie UIselectoren vrijgegeven
voor primaire tekst14px en minimale44px targets. Dat is een bewuste
bedieningscorrectie, geen claim dat oude UIgeometrie exact blijft.

De auditmarkup komt uit de echte auditlogpagina; de echte TenantThemeEditor en
EditorialThemeEditor blijven hun huidige handlers, verborgen formulierwaarden,
canonical paletgenerator en live previews gebruiken. Presetswatches behouden
`--theme-preset-color`, ook als de gebruiker werkelijk Oranje kiest. Geen
recoloring van inhoud, logo, preview of canvas. Buiten Sync blijft de oude
presentatie bytegelijk van toepassing.

## Uitvoering en bewijs

Eerst uitsluitend prompt/specvoorbereiding, scoped lint en strikte specTSC.
Wacht rootbrowserqueue-GO. Voer daarna exact twee gevallen390/1440 uit met
ongewijzigde productCSS en bewaar rood. Pas pas daarna de begrensde CSSdelta
toe en voer dezelfde twee gevallen groen uit: één worker, nul retry, bestaande
5sverwachtingen zonder verruiming. Echte componenten en actuele wrapper/CSS-
volgorde, betekenisvolle keuzes/config/canvas/swatches en buitenSync-invarianten.
Native auditdetails blijven open/sluiten met toetsenbord, juiste inhoud en geen
mutaties. Controleer14px/44px, focus en gerichte aXe. Bewaar ruwe screenshots,
metingen en alle eerste fouten in een unieke RAMbewijsmap.

Na groen scoped lint/specTSC/diffcheck, werkelijke runnerexit en gesloten
Chromium melden. Geen extra brede audit/testmassa of algemene V1-/pixel-/AA-/
provider-/hardwareclaim. Finale gebouwde integratie/capture/CI/uitrol blijven
rootgates.

## Vooraf vrijgegeven aanvulling — echte neutrale accountstatus

Root heeft de huidige accountcapture0072 en de S245Donker-negative met dezelfde
vaste lichte achtergrond/RGB240243241 als echte bereikbare cascadefout bevestigd.
Aanvullend uitsluitend in de bestaande adapter toegestaan:
`html[data-design-system="fieldflow"] .sync-control .vc-badge--neutral` krijgt
`color:var(--text)`. Geen andere badge-/statuskleur wijzigen. De bestaande dot
blijft currentColor volgen met dezelfde structuur/geometrie; zijn RGB mag de
herstelde voorgrond volgen. Geen dotkleur vastzetten of extra token introduceren.

Dezelfde twee cases gebruiken echte Badge/StatusPill met Eigenaar, werkelijke
SSRControlThemeBootstrap en opgeslagenDonker. Meet de echte rode ratio vóór
de neutralregel; controleer daarna gerichte contrast/aXe, vaste achtergrond,
label/structuur/geometrie en buitenSync. Geen nieuwe cases of deadlines.

De oorspronkelijke desktopcanvas-PNGmismatch blijft expliciet bewaard: dezelfde
canonicalpayload, volledigecanvasHTML en styles kunnen in de native screenshot
na sticky-scroll toch afwijken. Root heeft voorgeschreven dit als pixelgrens
te rapporteren, geen tolerantie/beeldnormalisatie toe te passen. Rawcapturen en
hun verschillen blijven dus bewijs; de inhoud-/style-/configinvarianten blijven
exacte gates, maar er wordt geen canvas-pixel-PASS afgeleid.

## Afsluiting binnen ownership

Finale zelfde2gevallen390/1440:2PASS,0retry/0skip,13.342s, runner27822exit0,
Chrome[]. Neutrale echteDonkerbaseline2FAIL met1.035858/aXe is behouden;
finalecontrast12.850936. ScopeESLint, strikte specTSC en diffcheck groen.
Volledige canvasHTML/config/stijlen exact; raw1440PNGverschil expliciet geen
pixel-PASS. Zie eigen doc en beschermde RAMproof. Geen commit/push; rootreview,
ledger, integratie, gebouwde eindcapture en uitrol volgen afzonderlijk.

## Heropend vóór commit — laatste drie echte editorchromerollen

De eerdere afsluiting hierboven en de bestanden final-proof.json/freeze.json met
SHAce297d75… en38eb8587… blijven als historische exacte cohort behouden.
Root heeft vóór schrijven uitsluitend extra Sync-gescopeerde kleurregels in
het bestaande dynamic-content CSS-pad vrijgegeven voor:

- `.editorialSectionEyebrow`;
- `.editorialTokenDisclosureIndicator`;
- dezelfde focus/hoverrol `.editorialTokenField:focus-within` en
  `.editorialTokenField[data-active="true"]`.

Gebruik Sourceaccent voor metadatatekst/indicator en Sourceaccent/accent-soft
voor focusborder/shadow. Behoud metadatafont/geometrie, echte focus/hover,
HTMLinvalid/aria-invalidgrenzen, canonicalinhoud en alle bestaande assertions.
Geen contentaccent, newsHtmlPreview of templatePreview aanpassen.

De aanvankelijk genoemde vierde rol `.editorialContrastSummary` is op basis van
de echte JSX/cascade door root expliciet uit de patchscope gehaald: deze heeft
altijd data-valid=true/false met bestaande succes-/criticalrollen die de
algemene oranje fallback overstemen. Laat alle oorspronkelijke summaryregels
exact staan. Dezelfde twee echte componentcases toetsen wel valid→invalid→
herstel via daadwerkelijke tokeninvoer; geen verwijderde-attribuutfake.

De statische voorbereiding is vóór de browseruitvoering vastgelegd. Na
daadwerkelijke S248closure gaf root exclusieve queue-GO: de huidige bron werd
rood bewaard, uitsluitend de drie rollen gepatcht en dezelfde gehele twee cases
groen uitgevoerd. Geen extra cases, deadline/tolerantie, broad audit,
foundationherhaling of commit/push. Nieuw bewijs staat onder de eigen aparte
RAMsubmap; de historische freeze en proof blijven exact behouden.

## Finale aanvulling afgesloten

Echte ongewijzigde aanvullende productCSS:2FAIL, runner28446exit1,9.341s;
alle oranje metadatatekst- en focusrollen zijn aantoonbaar geraakt. De extra
invoerherstelcontrole onthulde ook een harnasgrens: werkelijk leegmaken en
terugzetten van een CSS-token verandert bij React de serializeervolgorde van
CSSStyleDeclaration, terwijl alle oorspronkelijke property/valueparen gelijk
blijven. De aanvullende controle bewaart de ruwe strings en vergelijkt de
complete DOM plus elke inline CSS-property, waarde en priority. Een echte
reload herstelt daarna de beginsituatie vóór alle bestaande exacte
canvasHTMLvergelijkingen. Geen pixelnormalisatie, tolerantie of deadlinewijziging.

Finale zelfde2gevallen390/1440:2PASS,0retry/0skip,18.139s, runner3916exit0,
gevolgd door Chrome[]. Zowel echte hover als focus, geldige en syntactisch
ongeldige invoer, contrastongeldige invoer en herstel zijn uitgevoerd. De
Summary behoudt zijn originele succes-/criticalrollen; de afgewezen vierde
CSS-rol is nergens gewijzigd. Metadatafont/geometrie, canonicalpayload en
alle bestaande neutral/critical/14px/44px/buitenSynccontroles blijven gates.
Vier gerichte aXe-controles hebben nul violations én nul incomplete.
ScopeESLint, strikte specTSC en diffcheck volgen de finale exacte bron.
Bewijs/freeze onder three-role-extension; geen integratie-/uitrolclaim.
