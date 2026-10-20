# S281 — Eerste Goal Overlay-voorbeeld blijft leesbaar

Control monteert het bestaande Goal Overlay-voorbeeld zodra de gebruikte lokale
Roboto-fonts en de layout gereed zijn. Het toont tijdens laden een status, laat
het formulier bedienbaar en valt na maximaal drie seconden terug op beschikbare
fonts. Late fontlevering veroorzaakt één nieuwe meting zonder parentformulier,
invoer of focus te resetten. Een open ShadowRoot houdt beheer-CSS buiten dit
canvas; de basisregelafstand gebruikt de bestaande Vector-bodytoken. De UI-
paragraafregel is bovendien tot directe previewcopy begrensd.

De gedeelde GoalOverlay/DOM-renderer, Player, Static LG, configuratie, publicatie,
providers en offline-LKG blijven bytegelijk. Control heeft geen tweede renderer,
nieuwe API, poller of interval gekregen.

## Bewijs en grenzen

De daadwerkelijke74eb-desktopweergave had soms0,847px signage-eenheden:
headline5,932px/score6,780px. De echte resize-tegenproef1c0d herstelt met dezelfde
gegevens5,08px en35,56/40,64px. Dit bewijst de gemiste hermeting; de volledige
font-/layoutoorzaak is daarmee niet bewezen. De afzonderlijke CSSOM-proef toont
wel een overschrijvende preview-p-regel. Nieuw nativebewijs bevestigt ook de
Source-p-regelafstand die het ongeïsoleerde voorbeeld bereikte.

Twee native Chromiumgevallen gebruiken de echte previewcomponent, echte
vertraagde fontbytes, Source-stijlen en de ongewijzigde DOM-renderer. Zij toetsen
zichtbaar laden, eindige fallback terwijl fontrequests vaststaan, latere
hermeting, behoud van getypte invoer/focus en nul writes/browsererrors. De
zelfstandige referentie heeft dezelfde containing-block-afmetingen en dezelfde
renderer-CSS. Zowel fontsizes als regelafstanden zijn exact gelijk; alle inhoud
blijft binnen de kaart. Dit is gecontroleerd component-/fontbewijs en geen echte
Auth/RLS-/provider-/publicatie-/fysieke playbacktest.

- Oude directe rendering via een transparante alias naar exact de bestaande
  GoalOverlay, met het oorspronkelijke editor-CSS:2/2 werkelijk rood14,472s.
- Eerste definitieve kandidaat2/2PASS9,001s; na de tegenproef2/2PASS9,384s.
- Finale Source-tokenversie dezelfde2/2PASS8,909s, één worker,0skips/retries.
  Closure:/dev/shm/veyocast-s281-native-candidate-7e26c1a9-0160-4c38-8838-09a11fa1a9a0/closed.json.
  Headline/score:22,524/25,742px op390 en35,56/40,64px op1440. Beide originele
  kandidaatbeelden door Root bekeken; tekstomvang, regelafstand en kaartgrenzen
  zijn afzonderlijk in de native bijlagen vastgelegd.
- Gerichte lint en volledige Control-typecheck plus strikte spec-typecheck zijn
  werkelijkexit0. Alle tijdelijke SDK-aliases verwijderd, fysieke normale Next-
  manifesten en Root74bron vóór/na gelijk; geen herinstallatie of DB-wijziging.

Alle eerdere nul-case-harnasfouten en rode runs blijven behouden: expliciete
ESM-requireconfiguratie, echte fontassetloaders/-routes, het onderscheid tussen
laadstatus en bestaande Goal-status, een ontbrekende referentiestylesheet en de
juiste procentuele referentiecontext. Geen deadline, inhoudsgrens of fontgrootte-
assertie is versoepeld. Het algemene scope-label van de private nativehelper was
nog van het vroegere platformharnas; argv, testcase-ID's en deze review binden
het bewijs aan uitsluitend deze twee Goal-previewgevallen. Originele closures
zijn niet herschreven.

## Integratie

De actuele echte Next-build en volledige pagina met diensten moeten deze
correctie nog bevestigen. Deze feature sluit geen volledige matrixreview of
algemene AA-/pixel-/hardwareacceptatie. De finale gezamenlijke bron/gates,
reviews4–5 en bestaande staging-/productiepromotie blijven S244. De afhankelijke
feature-CI gebruikt nog een oudere wizardtestbasis; Root74 bevat de reeds
bewezen S275-readinesscorrectie. Alleen de uiteindelijke gecombineerde CI is
releasebewijs; oude CI-rood blijft als zodanig bewaard.
