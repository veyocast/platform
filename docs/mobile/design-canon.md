# VeyoCast Control Mobile — Atelier Ivory Native

## Visuele regels

- Canonieke actie- en merkkleur: Electric Orange `#FF5C20`.
- Light: warm ivory canvas, bijna-witte verhoogde vlakken, Ink Black tekst en
  warme stone borders.
- Dark: carbon canvas, charcoal surfaces, warm wit en terughoudende lijnen.
- Locked logo- en iconmasters uit `assets/brand` blijven ongewijzigd.
- Nieuwe merkvarianten worden niet gereconstrueerd.
- Primaire actie is oranje met donkere tekst; gevaarlijke actie is expliciet
  rood en vraagt bevestiging.
- Status gebruikt label plus kleur/icoon en vertrouwt nooit alleen op kleur.

## Responsiviteit

- 320-dp telefoons: één kolom, vijf primaire tabs, volledige verticale scroll.
- Grote telefoons: dezelfde informatiehiërarchie met ruimere cards.
- Telefoons gebruiken een zwevende donkere navigatiedock met één verhoogde
  primaire maakactie; de dock respecteert safe areas en bedekt de laatste
  inhoud nooit.
- Vanaf 768 dp gebruiken tablets en resizable windows een vaste
  navigatierail, compacte organisatiecontext en begrensde contentbreedte.
- De paginakop bevat organisatiecontext, notificaties en accounttoegang zonder
  op 320 dp buiten de viewport te lopen.
- Systeemfontschaling, light/dark, safe areas en Android back blijven native.
- Geen desktop-three-panel-editor op mobiel.

## Interactie

- Minimaal touch target: 48 dp.
- Pairing, publicatie en herstelacties hebben concrete labels en haptische
  bevestiging waar passend.
- Netwerk- en API-fouten tonen oorzaak, herstelactie, foutcode en request-id.
- Skeleton, leeg, offline, denied-permission en globale crashfallback zijn
  afzonderlijke states.
- Push- en cameratoestemming worden pas gevraagd na een relevante
  gebruikersactie.
- Drag-and-drop wordt alleen toegepast waar ruimtelijke volgorde betekenis
  heeft. Playlistitems zijn via een zichtbare greep en long-press te
  verslepen, tonen de doelpositie en geven haptische startfeedback.
- Iedere dragactie heeft een gelijkwaardige expliciete bediening en
  accessibility-adjustable actie. Upload, instellingen en schermacties krijgen
  geen decoratieve draginteractie zonder betekenisvol ordeningscontract.

## Assets

De bestaande locked 512/1024-iconassets voeden app-, adaptive- en splashconfig.
Een monochroom transparant Android-notificatie-icoon en commerciële
store-graphics worden pas toegevoegd na brandgoedkeuring. Een ongekeurde witte
silhouetvariant van het logo zou de locked-assetgrens schenden.
