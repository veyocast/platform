# S242 — De echte playlisteditor in Sync-opmaak

De bereikbare route `/dashboard/playlists/[playlistId]` rendert
`SitesPlaylistWorkspace` en de native `PlaylistEditor`, inclusief de bestaande
mediakiezer, thema-keuze, dirty-leavecontrole en schermselectie. De wijziging
richt alleen deze lokale presentatielaag op de gekozen Sync-bron.

## Bron en nulmeting

De immutable bron staat in
`docs/sync-v1-rebuild/handoff/reference/sites-sync/src/modules/Playlists.tsx`
en `src/styles.css`. De gekozen primaire kleur is daar `--accent`; echte
formulierbediening krijgt lokaal de toegankelijke 14px-/44px-grens. Miniaturen,
themaswatches en uitgezonden content hebben hun eigen typografie.

De oorspronkelijke drie CSS-, drie TSX- en drie browserbestanden zijn vóór
wijziging gekopieerd en gehasht, met drie immutable bronbestanden. Manifest:
`/tmp/veyocast-s242-playlist-proof/baseline-manifest.json`, SHA-256
`5e3631ef3f73c7d9f1e3857380d752476fa08aefb1e6f2df684c9ccd06d3f9d1`.

De twee nieuwe native componentjourneys op 390 en 1440px zijn eerst werkelijk
uitgevoerd: 0 PASS / 2 FAIL, 20,8s, één worker, nul retries/skips. Beide kwamen
langs alle zes vastgelegde toestanden; twaalf captures en oorspronkelijke
readbacks/spec/resultaten blijven onder `first-red/` bewaard. Gemeten: echte
labels en uitleg 11–13px, selectiehitbox 31px mobiel / 36px desktop, andere
focuskleur en contrastproblemen in Details en Publiceren.

Een concreet verschil tussen statisch en browserbewijs blijft expliciet:
`--pe-orange:#ff811f`, de hoverkleur en de pickerbevestiging waren nog oranje
in de broncode, maar de sterkere globale `.sync-control button`-reset maakte
de gemeten primaire achtergronden transparant. De lokale selectorprioriteit
is daarom onderdeel van de correctie. De nulmeting bewijst geen zichtbaar
oranje primaire knop in deze fixture.

## Wijziging en behouden grenzen

De drie lokale CSS-modules gebruiken bestaande Source-rollen voor primaire
acties, hover, oppervlakken, tekst en focus. Werkelijke labels, uitleg,
herstelcopy en acties zijn 14px; selectievakken hebben een aanklikbaar doel
van minimaal 44px. Alleen de reeds belangrijke fontdeclaraties van zes
pickercontrols vragen een afgebakende belangrijke tegenregel. Een afzonderlijke
fieldsetregel doorbreekt uitsluitend de bestaande inline `padding:0`-reset;
zo staan de echte velden en hun focusring volledig binnen de selectiekaart.

Het voorbeeld staat zonder extra gekleurd buitenvak naast de inhoud. De
playlistthemasection heeft een gewone scheiding en de publicatiesamenvatting
vormt een compacte regel. De bestaande desktopverhoudingen en mobiele
sequentiële taken blijven aanwezig. Een kleine mobiele regel verdeelt de
publicatie-acties gelijkmatig en stapelt de duurkeuze leesbaar.

Alle drie TSX-bestanden zijn byte-identiek aan de nulmeting. Daardoor blijven
handlers, state, opslag/publicatie, commands, CAS, nonces, journal/replay,
immutable bindings, permissions, upload/storage, indeling, herordenen en
keyboard/close/recovery dezelfde implementatie. De geselecteerde oorspronkelijke
thumbnail-, previewframe- en swatchdeclaraties zijn afzonderlijk bytegelijk
gecontroleerd in `product-invariants.json`. Er zijn geen Source-, renderer-,
canvas-, Player-, database-, dependency- of workflowwijzigingen.

## Verificatie en open grenzen

Scoped ESLint en TypeScript van de uitgebreide workflowspec zijn groen.
De drie bestaande commandplan-, mediaversiejournal- en duurtests zijn groen:
34/34, maximaal twee workers. Alle oorspronkelijke browsercasebodies blijven
als byte-identieke prefix in de workflowspec staan; twee aanvullende
presentatiecases meten echte kleur, veldtekst, doelgrootte, focus, aXe en
strikte viewportbegrenzing in content/item/picker/details/dirty-leave/publicatie.

De eerste kandidaat slaagde voor de twee nieuwe cases: 2/2 in 13,7s. Alle twaalf
captures zijn werkelijk bekeken. Twee zichtbare problemen bleven ondanks de
groene assertions bestaan: de inline fieldsetreset liet de focusring afknippen
en de lange eerlijke schermstatus kneep de mobiele schermnaam samen. De lokale
fieldsetinset en een mobiele kaart met naam/metadata/status onder elkaar
herstellen dit zonder TSX-wijziging. De bestaande twee cases meten daarom nu
ook de volledige outline binnen de clipgrens en de naam-/statusgeometrie.

Finale v2: 2/2 PASS, 14,0s, nul retries/skips, twaalf captures en twaalf aXe-metingen
zonder overtredingen. De focusring blijft op beide breedtes binnen de kaart;
de mobiele naam is één regel en de status staat na de metadata. De drie gewijzigde
finale captures en de desktoppublicatie zijn werkelijk bekeken; negen van de
twaalf finale beelden zijn byte-identiek aan de al bekeken kandidaatbeelden. De gecontroleerde
vergelijking staat in `visual-comparison.json`. De overige finale afbeeldingen
bevatten de werkelijk beoordeelde inset-/statuscorrecties.

De oorspronkelijke brede 133-run werd afgebroken met exit143 en een leeg
JSONeindrapport. Eén trace bevat `PLAYLIST-0001` op 360×800: 30s timeout en
`page.evaluate: Target crashed` tijdens de bestaande font-/beeld-/2RAF-wachtstap.
De oorzaak van die oorspronkelijke SIGTERM/crash is niet vastgesteld; er wordt
geen ongefundeerde resourceoorzaak toegekend. Het volledige resterende
trace-/log-/capturebewijs blijft bewaard. Een kortstondige eigen overlap van
twee vervolgrunners is direct gestopt, afzonderlijk gedocumenteerd en niet als
vereist serieel eindbewijs meegeteld.

Hetzelfde oude 360px-geval slaagt afzonderlijk in 2,4s met dezelfde casebody,
assets en transport. Daarna zijn de 132 overige oorspronkelijke gevallen in
vijftien strikt opeenvolgende cohorten afgerond, maximaal acht oorspronkelijke
visualcases per browser. Alle zestien gebruikte oude-runners zijn exit0, met
eigen complete JSON-, livecase-, browserlifecycle-, geheugen- en exitlogs. De
exacte union is 133 unieke oude PASS plus twee nieuwe PASS, nul retries/skips,
duplicaten, ontbrekende of extra gevallen. De tijdsintervallen bewijzen de
seriële uitvoering. Manifest: `final-browser-union.json`. Het oude incomplete
rapport is daardoor niet stilzwijgend tot groen verklaard.

De volledige foundation is na productfreeze groen: lint, typecheck en test,
68/68 Turbo-taken, 64 cached, 1m37,11s. De opdracht gebruikt alleen CPU4,5 en
concurrency1; vooraf was meer dan 3500MiB beschikbaar. Control: 1637 PASS en
34 bestaande conditionele SKIP. Log: `full-foundation.log`; exacte opdracht,
exit0 en hash staan in `foundation-summary.json`. Er is geen appserver of
productiebuild gestart. Na groen is geen extra browserrun herhaald.
Dit document claimt geen authenticated tenantpublicatie, receipt-/RLS-acceptatie,
Source-pixelpariteit, vijf volledige visuele rondes of V1-oplevering.
