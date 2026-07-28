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
- Tablets/resizable windows: vaste navigatierail en begrensde contentbreedte.
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

## Assets

De bestaande locked 512/1024-iconassets voeden app-, adaptive- en splashconfig.
Een monochroom transparant Android-notificatie-icoon en commerciële
store-graphics worden pas toegevoegd na brandgoedkeuring. Een ongekeurde witte
silhouetvariant van het logo zou de locked-assetgrens schenden.
