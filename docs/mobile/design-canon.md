# VeyoCast Control Mobile — Atelier Ivory Native

## Visuele regels

- Canonieke actie- en merkkleur: Electric Orange `#FF5C20`.
- Roboto is het standaardlettertype voor alle apptekst en invoervelden, met
  expliciet geladen gewichten 400, 500, 600 en 700.
- De compacte native schaal gebruikt 14/20 voor bodytekst, 15/20 voor
  kaarttitels, 18/23 voor sectietitels, 24/29 voor paginatitels en 26/30 voor
  prominente waarden.
- Standaardcards gebruiken een rustige 10-dp radius, één warme border en geen
  decoratieve schaduw. Herhaalde instellingen staan in één surface met
  interne scheidingslijnen in plaats van als losse kaartmozaïek.
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
  primaire maakactie; de compacte dock is 58 dp hoog vóór de safe area,
  respecteert systeeminsets en bedekt de laatste inhoud nooit.
- Vanaf 768 dp gebruiken tablets en resizable windows een vaste
  donkere navigatierail, compacte organisatiecontext en begrensde
  contentbreedte.
- De paginakop bevat organisatiecontext, notificaties en accounttoegang zonder
  op 320 dp buiten de viewport te lopen.
- Systeemfontschaling, light/dark, safe areas en Android back blijven native.
- Geen desktop-three-panel-editor op mobiel.
- Playlistdetail en playlistcreatie blijven binnen de Content-tab, zodat de
  hoofdnavigatie op telefoon en tablet tijdens authoring beschikbaar blijft.

## Interactie

- Zichtbare controls mogen compact zijn, maar het interactieve touch target
  blijft minimaal 44 dp volgens WCAG 2.2.
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
- De cockpit zet herstelbare acties vóór samenvattende cijfers. Vier statussen
  delen één compacte summary-surface met interne lijnen; afzonderlijke
  KPI-cards domineren de eerste viewport niet.
- Playlistitemacties vormen één bedieningsrail: verplaatsing als segment,
  weergavemodus als secundaire actie en verwijderen als rustige critical-actie
  met zichtbaar tekstlabel en bevestiging.
- De bedieningsrail gebruikt vaste semantische kolommen. `Vullen` en `Passend`
  nemen dezelfde breedte in, de critical-actie blijft per kaart op dezelfde
  rechterlijn en alle drie de controlgroepen blijven 44 dp hoog.

## Assets

De bestaande locked 512/1024-iconassets voeden app-, adaptive- en splashconfig.
Een monochroom transparant Android-notificatie-icoon en commerciële
store-graphics worden pas toegevoegd na brandgoedkeuring. Een ongekeurde witte
silhouetvariant van het logo zou de locked-assetgrens schenden.
