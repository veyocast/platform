# Sites v17 bronintegratie

## Identiteit en scope

Deze integratie gebruikt de werkelijke Sites-bron op commit
`6800bc858436ba0843eaea89b682cd5b43c3521d`. De ontvangende VeyoCast-basis was
`ca621ec6e5a8024da8d6f45bb33b398966b580ab`. De bestaande App Router,
tenantautorisatie, Supabase-opslag, publicatieketen en Players blijven de
productieruntime; de hash-router, mockdata en lokale opslag uit het prototype
zijn niet overgenomen.

De meegeleverde overdrachtsmap bevat geen `tools/verify-package.py`. Daarom zijn
de broncommit, schone bronwerkmap, CSS-bytes en alle gekopieerde brushassets
rechtstreeks gecontroleerd. De actuele bron-CSS is in de originele cascade
samengevoegd:

- `sports-renderer.css` → `club-renderer.css` → `slide-renderer.css` →
  `brush-theme.css`: 82.601 bytes, SHA-256
  `86577e4dbb4b0905eba6905bbc57226863a00d56591aeab7c6f6d60d2307d7f7`;
- `studio.css` → `ui.css`: 17.620 bytes, SHA-256
  `209df95ad22ffe3fdd896bd0eb9ecead3009dd36bf1861ed912b73b4a7239563`.

Deze hashes staan ook als regressietest vast. Sites v11 blijft leesbaar via zijn
eigen gekoppelde renderer/source-identiteit; nieuwe ontwerpen gebruiken alleen
de gekoppelde v17-identiteit.

## Bron naar doel

| Bron | Productiedoel | Data-adapter en toetsing |
|---|---|---|
| `unified/model.ts` | `packages/contracts/src/sites-presentation.ts` | Getypeerde v17-familie, opties, echte logo- en rijvelden; ongeldige renderer/source-paren worden geweigerd. |
| `unified/slide-renderer.tsx` | `packages/content-templates/src/sites-unified-v17.tsx` en `sites-unified-v17-markup.tsx` | Eén gedeelde React/static compositie voor preview, playlist en Player. |
| `unified/sports-renderer.tsx` | `sites-unified-v17-markup.tsx` en `sites-dynamic-projector.ts` | Database-snapshots worden naar team-, wedstrijd-, stand-, bezoeker- en LED-velden geprojecteerd; geen providerrequest vanuit de slide. |
| `unified/club-renderer.tsx` | `sites-unified-v17-markup.tsx` | Agenda, RSS, verjaardagen, vacatures, kantine, partners, welkom en vrij ontwerp gebruiken hetzelfde contract. |
| vier renderer-CSS-bestanden | `packages/content-templates/src/sites-v17-styles.ts` | Byte-afgeleide cascade met bronhash; editor en Player laden dezelfde CSS. |
| `unified/studio.tsx` | `packages/studio/src/sites.ts` en Control Studio-routes | 32 v17-starttemplates: 16 families × liggend/staand; opslaan blijft serverbevestigd en revision-guarded. |
| `unified/wizard.tsx` | `apps/control/app/(shell)/dashboard/studio/sportlink/new/` | Bestaande geautoriseerde vijfstappenflow gebruikt v17-configuraties en alle 17 productie-Sportlinkfamilies. |
| prototypegroepen/-picker | bestaande playlistworkspace en serveracties | Studio-ontwerpen en dynamische snapshots blijven via stabiele IDs selecteerbaar; conceptwijzigingen vervangen geen publicatie. |
| `public/onzetrots/website-brush/*` | Control, Marketing en Player `public/onzetrots/website-brush/` | Zes byte-identieke assets met checksumgebonden offlinecache. |
| browserpreview | moderne Player plus Static LG-adapter | React gebruikt dezelfde renderer; Static LG ontvangt bevroren markup, CSS en assettokens met v17-provenance. |

De bestaande serverroutes voor overzicht, Studio, groepen, playlists, schermen,
zones en planning blijven leidend. Daarmee blijven RLS, capabilities,
revision guards, private media, audit en serverbevestigde mutaties actief. Het
prototype levert voor die routes alleen de visuele/interactionele bron en wordt
niet als parallel product of opslagmodel uitgevoerd.

## Familie- en providermapping

De zestien unified families zijn `competitie`, `programma`, `uitslagen`,
`matchday`, `agenda`, `rss`, `verjaardagen`, `trainingen`, `vacatures`,
`kantine`, `partners`, `welkom`, `bezoekers`, `led`, `sportlink-extra` en
`vrij`. Voor elke familie bestaan liggende en staande templates.

De 17 Sportlink-productietypen mappen als volgt:

| Sportlinktype | v17-familie | Variant |
|---|---|---|
| programma | `programma` | — |
| uitslagen | `uitslagen` | — |
| stand | `competitie` | — |
| periodestand | `sportlink-extra` | `periodestand` |
| wedstrijd van de dag / volgende wedstrijd | `matchday` | — |
| afgelastingen | `sportlink-extra` | `afgelastingen` |
| kleedkamers | `sportlink-extra` | `kleedkamers` |
| officials | `sportlink-extra` | `officials` |
| teaminformatie | `sportlink-extra` | `teaminfo` |
| sponsors | `partners` | — |
| clubactiviteiten | `agenda` | — |
| trainingen | `trainingen` | — |
| vrijwilligers | `vacatures` | — |
| verjaardagen | `verjaardagen` | — |
| bezoekende teams | `bezoekers` | `welkom-bezoekers` |
| scheidsrechters | `sportlink-extra` | `welkom-scheidsrechters` |

LED Scores mapt naar `led`; menu en prijslijst mappen naar `kantine`; nieuws
mapt naar `rss`.

## Data, versies en veiligheid

Sportlink, LED Scores, RSS en menu-inhoud worden eerst gesynchroniseerd en in
Supabase opgeslagen. De projectie leest alleen de opgeslagen, tenantgebonden
snapshot. Externe URL's worden niet vanuit een slide opgehaald. Providerlogo's
komen als checksumgebonden assets mee; initialen zijn alleen de zichtbare
fallback wanneer een geldige asset ontbreekt.

De v17-wijziging maakt geen nieuw databasepad en geen migratie. De bestaande
invarianten blijven gelden:

1. een ontwerpwijziging maakt uitsluitend via de geautoriseerde ontwerpactie
   een nieuwe configuratieversie;
2. een bronrefresh actualiseert de genormaliseerde snapshot of gepubliceerde
   live data en maakt geen slide-, playlist- of releaseversie;
3. een publicatie verwijst naar de vastgelegde release/configuratierevisie;
   latere conceptwijzigingen veranderen die verwijzing niet;
4. de Player activeert pas een volledig gevalideerde release en behoudt zijn
   last-known-good bij tijdelijke uitval;
5. bestaande retentie/pruning ruimt niet meer gerefereerde voorgangers op,
   terwijl actieve, rollback- en last-known-good-verwijzingen beschermd blijven.

QR-codes worden lokaal als SVG uit de opgeslagen URL opgebouwd. Er staat geen
klikbare externe link in de vertrouwde Playermarkup. De service-role key blijft
server-only en de integratie wijzigt geen RLS- of capabilitygrens.

## Viewport en visuele verificatie

De broncanvas blijft 1920×1080 of 1080×1920. De moderne Player meet zowel
breedte als hoogte en gebruikt `min(containerWidth, containerHeight × ratio)`.
Daardoor blijft de volledige slide binnen telefoons, tablets, 16:9-schermen,
9:16-schermen en 4K-schermen, inclusief wanneer scherm en slide een andere
oriëntatie hebben. De auteurspreview behoudt de vaste aspectratio. Static LG
gebruikt dezelfde native afmetingen en schaalt de bevroren pagina in de
bestaande Playerhost.

De viewportfunctie is getest met 320×568, 390×844, 768×1024, 1080×1920,
1280×720, 1920×1080, 2160×3840 en 3840×2160, voor beide oriëntaties. Handmatig
zijn met geladen fonts en gedecodeerde assets vergeleken:

- competitie, liggend, wit: 7 volledige rijen en vorm voor elk team;
- competitie, staand, blauw: 9 volledige rijen en vorm voor elk team;
- RSS, liggend, wit: brongeometrie, tekst, beeld en QR-vlak;
- bezoekers, staand, wit: vier kaarten, logo/watermerk, aftrap en details.

Het ingebedde slidecanvas gebruikt geen documentlandmarks. Daardoor blijft in
Studio en preview exact één `main`-gebied aanwezig, ook wanneer meerdere
v17-previews tegelijk zichtbaar zijn. De mobiele Control-matrix heeft alle 30
route-/viewportcombinaties zonder horizontale overflow doorlopen.

De CSS- en assetidentiteit is exact. De bovenstaande vier composities zijn
visueel gecontroleerd; dit document claimt geen uitgevoerde vergelijking van
alle 176 inventariscases en geen fysieke LG- of Android-hardwareproef.

## Finale verificatie

- workspace lint en typecheck: elk 30/30 taken groen;
- workspace unit: 30/30 taken groen met concurrency 2; één bestaande
  deadline-timingtest is na een belaste eerste run afzonderlijk en in de
  volledige begrensde run groen;
- productiebuild: 18/18 taken groen;
- toegankelijkheid: alle 36 actieve cases groen, plus één bestaande opt-in
  livecase overgeslagen;
- Player: 230 groen en 15 productie-omgevingcases overgeslagen;
- afzonderlijke offlinegate: 7/7 groen;
- Chromium: de volledige taakscope en de mobiele route-/viewportmatrix zijn
  groen. Eén ongewijzigde Control-shelltest zoekt een achtergrondkop via de
  accessibility tree terwijl de geopende modale dialoog die achtergrond
  terecht verbergt; productroute en test zijn buiten deze taak ongewijzigd;
- de historische Sites-responsiviteitsmatrix: 66/66 groen. Voor Studio blijft
  de ongewijzigde shell tegen de bevroren bron gemeten; de bewust vervangen
  galerij controleert aanvullend 16 unieke v17-families, geladen
  checksumassets, één oriëntatie en canvasbegrenzing.
