# Atelier Ivory — implementatiehandboek

Datum: 27 juli 2026

Branch: `veyocast/s50-atelier-ivory`

Bronnen: Atelier Ivory Design Canon v1.0, Component Library v1.0 en de
vijftien unieke referentiebeelden uit `Screenshots.zip`.

## Resultaat

Atelier Ivory is de presentatie- en interactielaag van Control en Studio.
Productlogica, tenantgrenzen, capabilities, server-actions, immutable releases,
Playercontracten en de bestaande Studio-documentengine zijn niet gewijzigd.
De interface gebruikt uitsluitend echte routegegevens of expliciet afgeschermde
lokale testfixtures.

De oplevering omvat:

- semantische light- en dark-tokens met de officiële Electric Orange-merkkleur;
- een vaste 232 px desktopsidebar, 80 px compacte rail en 72 px header;
- een 56 px mobiele header en een safe-area-bewuste zwevende navigatie van
  58 px met exact Overzicht, Schermen, Playlists, Studio en Meer;
- herontworpen Overzicht, Schermen, Playlists, Media, Planning en Studio;
- een responsive Playlist Builder met desktopwerkzones en mobiele sheets;
- een desktop-first Konva Studio-editor en een bewuste mobiele quick-editflow;
- consistente beheer-, support-, instellingen-, integratie- en platformroutes;
- Atelier PWA-startkleuren;
- zichtbare focus, minimaal 44 px mobiele touchdoelen en reduced motion;
- visuele controles op overflow, samenvattingsgeometrie, client exceptions,
  hydrationfouten en console-errors.

## Centrale implementatie

De productspecifieke semantische laag staat in
`apps/control/app/atelier-ivory.css`. De bestaande `--vc-*`-contracten blijven
de API voor gedeelde componenten en worden daar aan `--ai-*` gekoppeld. Dit
voorkomt route-eigen kleur- en radiusvarianten en houdt bestaande consumers
compatibel.

Belangrijke maten:

| Contract | Waarde |
| --- | --- |
| Desktopsidebar | 232 px |
| Compacte sidebar | 80 px |
| Desktopheader | 72 px |
| Mobiele header | 56 px |
| Mobiele navigatie | 58 px plus safe area |
| Cardradius | 12 px |
| Controlradius | 8 px |
| Mobiel touchdoel | minimaal 44 × 44 px |

Light gebruikt Ivory `#F5F1E8` als achtergrond en Ink `#171714` als tekst.
Dark gebruikt `#151411` als achtergrond en `#F6F1E7` als tekst. Letterlijke
manifestkleuren zijn noodzakelijk buiten CSS en worden in een getest,
gecentraliseerd object afgeleid.

## Routevertaling

| Referentiegebied | Implementatie |
| --- | --- |
| Overzicht | Actie-inbox, live inhoud, onboarding en vier operationele metrics |
| Schermen | Desktopdatagrid, mobiele statuscards, filters en bestaande detailjourney |
| Playlists | Bibliotheek, contextacties en responsive driezonebuilder |
| Media | Bibliotheek, upload, filters en bestaande inspector/sheet |
| Planning | Desktopkalender, mobiele agenda en compacte statusstrip |
| Studio browser | Projecten, templates, renderstatus, merkset en create-flow |
| Studio editor | Bestaande Konva-engine, lagen, inspector, timeline en revisies |
| Studio mobiel | Preview, naam/data/media aanpassen en genereren; geen mini-canvas |
| Overige Control | Gedeelde headers, surfaces, formulieren, feedback en responsive shell |
| Platform | Zelfde shelltokens en contrast; informatiearchitectuur functioneel behouden |

## Responsive gedrag

- Tabellen blijven desktop-first en worden onder 1024 px bestaande cards of
  gestapelde rijen.
- 768 px gebruikt de compacte drawer-shell en geen uitgerekte desktopsidebar.
- Drawers presenteren mobiel als bottom sheet.
- Planning gebruikt mobiel de bestaande agendaweergave.
- Playlist- en Studio-actiebalken staan boven de mobiele hoofdnavigatie.
- De volledige Studio-canvaswerkplek blijft desktop-first. Mobiel toont alleen
  functies die op aanraking betrouwbaar te bedienen zijn.
- Lange Nederlandse tekst mag afbreken; interactieve labels worden niet
  horizontaal afgeknipt.

## Visuele bewijsvoering

De primaire live matrix bevat acht workspaces in vier viewports en twee thema's:

- Overzicht;
- Schermen;
- Playlistbibliotheek;
- Playlist Builder;
- Media;
- Planning;
- Studio browser;
- Studio create-flow.

De Studio-editor heeft daarnaast een afgeschermde demomatrix. Samen zijn
72 eindbeelden vastgelegd onder:

- `docs/screenshots/atelier-ivory/final`;
- `docs/screenshots/atelier-ivory/final-demo`.

De aanvullende review van schermgroepen, releases, templates, integraties,
instellingen, team, support, auditlog en platform is met dezelfde runner in
390 × 844 en 1440 × 900, light en dark uitgevoerd.

## Verificatie

| Gate | Resultaat |
| --- | --- |
| `pnpm lint` | 25/25 Turbotaken groen |
| `pnpm typecheck` | 25/25 Turbotaken groen |
| `pnpm test` | alle 16 workspace-suites groen; Control 99/99 |
| `pnpm build` | 15/15 Turbotaken groen |
| Accessibility | 29/29 Control/marketing/Player-checks groen |
| Playwright | 100 tests groen in de seriële totaalrun; resterende marketing-overflowcheck na passende timeout afzonderlijk groen; 8 expliciete environment-skips |
| Visueel | 72/72 eindbeelden zonder overflow, KPI-clipping of clientfouten |

De Control-build toont al vóór deze sprint aanwezige Autoprefixer-waarschuwingen
voor `start` in `screen-automation.module.css`. De build en runtime blijven
groen; dit is geen Atelier-regressie.

## Bewuste beslissingen

- De echte data- en permissionarchitectuur heeft voorrang op fictieve inhoud
  uit mock-ups.
- De bestaande Konva- en Playlist-statearchitectuur is behouden; alleen chrome,
  layout en responsive gedrag zijn gewijzigd.
- Platformbeheer erft het nieuwe visuele systeem, maar krijgt zonder
  productspecificatie geen nieuwe informatiearchitectuur.
- De visuele runner maakt uitsluitend in een lokale Supabase-omgeving één lege
  playlistfixture aan wanneer geen editorrecord bestaat. Productiecode bevat
  geen placeholderdata.

## Resterende technische schuld

- De historische Control-CSS blijft omvangrijk. Atelier Ivory is bewust als
  productscope boven de bestaande contracten geplaatst; ongebruikte legacyregels
  kunnen pas na route-voor-route usage-analyse veilig worden verwijderd.
- De browsermatrix gebruikt Chromium. Safari/WebKit- en Firefoxvalidatie is een
  aanvullende releasegate wanneer die browsers officieel worden ondersteund.
- Fysieke apparaatvalidatie van Control op bijzondere kiosk- of embedded
  browsers valt buiten deze UI-sprint.

Er zijn geen open productbeslissingen die deze oplevering blokkeren.
