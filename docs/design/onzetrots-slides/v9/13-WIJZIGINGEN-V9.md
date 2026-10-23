# Wijzigingen v9 — 23 oktober 2026

Dit is de laatste inhoudelijke aanpassing binnen hetzelfde overdrachtspakket. De definitieve broncommit is `5ba52a657d6d16ad103ba2fb43b8db18aa83715a`; gepubliceerd als Site-versie9. Rubik Distressed, de bewerkbare buitenkop en de v7-beweging blijven behouden.

## Extra binnenkoppen verwijderen

Verwijder de extra `.panel-head`-secties binnen `.slide-content` op **alle niet-matchday-slides**. Het gaat om de aparte eyebrow/titelblokken zoals `Samen in de race` en `De uitslagen`; de bewerkbare buitenkop met subtitel, titel en rechter clubcrest blijft staan.

**Enige uitzondering: Onze wedstrijddag (`matchday`) behoudt precies drie binnenkoppen**, één voor uitslagen, één voor de stand en één voor het programma.

Semantische gegevens-/contextstroken, wedstrijdinformatie en tabelkolomlabels blijven bestaan. Daadwerkelijke inhoudstitels van feature-artikelen blijven ook. Verwijder dus geen headings op basis van alleen het HTML-element of iedere tekst bovenin een kaart. In productie wordt dit expliciet familiegebonden in de gedeelde renderer gebouwd; de prototype-DOM-bewerking is geen afzonderlijke productierenderstap.

## Verjaardagskaarten

Iedere gevulde kaart toont:

1. Een grotere datum linksboven.
2. De felicitatie met de zichtbare naam, bijvoorbeeld **`Gefeliciteerd, Sam K.`**.
3. Daaronder de leeftijd in **Rubik Distressed 400**.
4. Daarna de teaminformatie.

De naam is voornaam plus achternaaminitiaal met punt. Gebruik bestaande toegestane bronvelden of de gecontroleerde displaynaam; vraag geen nieuwe persoonsgegevens op en verzin geen ontbrekende achternaam/initiaal. De exacte datummaat komt uit de definitieve bron. Het vaste 3×2-raster, de zes voorbeeldkaarten en lege restslots blijven gelden.

## Bewijs en verpakking

Alle160 individuele voorbeelden zijn opnieuw vastgelegd op v9 `5ba52a657d6d16ad103ba2fb43b8db18aa83715a`:144basisbeelden en16bezoekersdetails. Het browserbewijs bevestigt per frame één buitenkop en één koplogo, nul extra binnenkoppen behalve de drie bij matchday, Rubik Distressed en geen kopoverflow. Verjaardagen zijn op volgorde, leeftijdsfont, datumgrootte en naaminitiaal gecontroleerd. De daadwerkelijke pakket-/testuitkomsten staan in `09-VALIDATIE.md`. VeyoCast-productietests zijn niet uitgevoerd.
