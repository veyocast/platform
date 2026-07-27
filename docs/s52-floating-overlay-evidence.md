# S52 — Clippingvrije Control-overlays

## Aanleiding

Overflowmenu’s werden op enkele routes absoluut binnen een kaart, lijst of
scrollpaneel geplaatst. `z-index` kon daar niet tegen helpen: een voorouder met
`overflow: hidden` of `overflow: auto` bleef de menu-inhoud en soms zelfs de
focusring afsnijden.

## Gecontroleerde overlay-inventaris

De volgende runtime floating panels gebruiken nu hetzelfde portalcontract:

- Studio-projectacties;
- Studio-laagacties;
- Playlist-itemacties;
- playlistsectie aanmaken;
- playlistsectie bewerken;
- tenant-/platformcontext wisselen.

Dialogs, sheets, accountmenu’s, themakeuze, globale creatie en uploadflows
gebruikten al de bestaande Radix-portal en zijn ongewijzigd gebleven.

De resterende native `details`-elementen zijn echte inline disclosures voor
onder meer MFA, auditdetails, uploaduitleg, revisievergelijking en
lifecyclebevestiging. Die horen inhoudelijk in hun container en zijn daarom
niet als zwevende overlay behandeld.

## Gedeeld contract

`FloatingPanel`:

- rendert de inhoud rechtstreeks onder `document.body`;
- positioneert met `position: fixed` op de canonieke dropdownlaag `300`;
- lijnt start/einde uit op de trigger;
- kiest automatisch boven of onder op basis van beschikbare ruimte;
- bewaakt rondom een viewportrand van 12 px;
- begrenst hoge inhoud en maakt alleen het panel verticaal scrollbaar;
- herberekent bij scroll, resize en contentwijzigingen;
- sluit bij buitenklik;
- sluit als bovenste laag met Escape en geeft focus terug aan de trigger;
- behoudt correcte `aria-expanded`, `aria-controls` en `aria-haspopup`.

De Studio-projectkaart clippt de action-trigger niet langer; de
preview-afbeelding behoudt zijn eigen begrensde afgeronde uitsnede.

## Verificatie

- Control lint, typecheck en 99 unit-tests;
- Control productiebuild en auth-/secret-boundarychecks;
- Studio desktop- en mobile-E2E;
- portaal-, z-index-, viewport- en Escape/focustests op 320, 390, 768, 1024 en
  1440 px;
- visuele controle van het Studio-laagmenu en de mobiele tenantwisselaar.

De browsertest bewijst naast zichtbaarheid expliciet dat de overlay een direct
kind van `document.body` is, `position: fixed` gebruikt en volledig binnen het
viewport blijft.
