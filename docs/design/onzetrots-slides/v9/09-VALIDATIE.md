# Validatie van deze overdracht — v9

Bijgewerkt op **23 oktober 2026**. De definitieve slidebron is `5ba52a657d6d16ad103ba2fb43b8db18aa83715a`; de bijbehorende Sites-publicatie is geslaagd. De afzonderlijke Menu Studio-bron is `77eec81092ab829302dd835fb430161fe93be220`, gepubliceerd als Sites-versie 18. Deze validatie betreft de prototypes en het overdrachtspakket. **VeyoCast-productietests zijn niet uitgevoerd.**

## Actuele bron en beelden

| Onderdeel | Vastgelegd resultaat |
| --- | --- |
| Slidebron | Definitieve v9-commit `5ba52a657d6d16ad103ba2fb43b8db18aa83715a` |
| Bronkopie | 261 bestanden / 9.969.905 bytes; exacte bestandshashes in de actuele assetaudit en checksumlijst |
| Catalogus | 36 unieke families uit de gelezen VeyoCast-catalogus |
| Basiscollectie | 144 verse v9-captures: 36 families × licht/donker × liggend/staand |
| Bezoekersdetails | 16 verse v9-captures: 1–4 wedstrijden × licht/donker × liggend/staand |
| Contactbladen | Vier overzichten van de actuele basisbeelden |
| Menu Studio | Vier afzonderlijke actuele bewijsbeelden: liggend/staand × licht/donker |
| Menu Studio-snapshot | 32 bestanden / 4.933.285 bytes; minimale bron-/import-/assetreferentie, geen zelfstandig draaiende volledige app |

Alle 160 individuele slidebeelden zijn opnieuw opgenomen met v9. Oude v8-opnamen zijn niet onder een nieuwe bronidentiteit behouden. De drie aparte v7-motionframes houden hun oorspronkelijke broncommit en historische status. De capture-inventaris registreert de daadwerkelijk meegeleverde beelden, clipmaten, bronidentiteiten en observaties. Browsercaptures van het geschaalde canvas zijn geen native 1080-render of productie-exporttest.

## Nieuwe v9-controles

Vooraf zijn 72 controles uitgevoerd. Daarnaast zijn tijdens het vastleggen van **alle 160 actuele slideframes** de bijbehorende DOM-metagegevens gecontroleerd. De opnamecontroles zijn afzonderlijk van de voorcontrole vastgelegd.

| Controle | Vastgesteld bereik en uitkomst |
| --- | --- |
| Buitenheader | Ieder opgenomen frame heeft precies één buitenheader en één eigen clublogo daarin; het logo staat rechts. |
| Extra binnenkoppen | `matchday` heeft precies drie `.panel-head`-binnenkoppen; alle andere families hebben er nul. |
| Kopfont / passende header | De geobserveerde kopfont is het lokale Rubik Distressed 400; de buitenheader heeft geen overflow in de vastgelegde frames. |
| Verjaardagsvolgorde | De felicitatie staat vóór de leeftijd. De daadwerkelijke leeftijdstekst gebruikt Rubik Distressed 400; daarna volgt de teaminformatie. |
| Verjaardagsdatum | Links bovenin, geobserveerd op 13 logische pixels liggend en 12 staand. |
| Verjaardagsnaam | De zichtbare voorbeeldnaam gebruikt voornaam en achternaaminitiaal met punt, zoals `Sam K.`. |

Semantische context, kolomlabels en inhoudstitels van features blijven onderdeel van het ontwerp. De controle op `.panel-head` is geen opdracht om alle HTML-headings of alle tekst boven een kaart te verwijderen.

## Afzonderlijk Menu Studio-bewijs

Voor de vier actuele Menu Studio-combinaties zijn in het bijbehorende bewijs-JSON werkelijk geobserveerd:

- Rubik Distressed met gewicht 400 als kopfont;
- één header met het clublogo rechts;
- geen headeroverflow;
- het witte footerwoordmerk op een transparante achtergrond.

Deze controles horen bij Menu Studio-commit `77eec81092ab829302dd835fb430161fe93be220`. Zij worden niet als controles van de hele VeyoCast-app of van de zelfstandige werking van de minimale snapshot voorgesteld.

## Historisch bewijs, met oorspronkelijke grenzen

De eerdere handmatige **v6-controles** betroffen onafhankelijke familiekoppen, bewaren bij wisselen/herladen, escaping en passend verkleinen van lange tekst. Ook zijn toen zestien UI-grensgevallen van bezoekersschaal gecontroleerd: 1–4 kaarten × liggend/staand × 100%/200%, zonder overflow in die gevallen. Dat was geen volledige afzonderlijke thema-/schaalmatrix. Deze handmatige controles zijn niet opnieuw als vandaag uitgevoerde v9-controles gelabeld.

Het **v7-motionbewijs** hoort bij commit `d5005d8cc7cdb794edb3b1a40cda70a3491b2b0c` en bestaat uit drie representatieve frames met geobserveerde hosttijden en opacitywaarden: achtergrond, kop en complete compositie. De font-/headerlay-out in die beelden is ouder. De toenmalige controles van pauze/hervatten, replay en semantische entreecontainers blijven historisch bewijs; ze zijn niet opnieuw als v9-motiontest uitgevoerd. Reduced-motion-regels zijn destijds in CSS beoordeeld; er is daarmee geen afzonderlijke browsercontrole met gewijzigde OS-voorkeur bewezen.

## Bron- en pakketcontrole bij definitieve verpakking

De definitieve bron wordt opnieuw gecontroleerd met:

```bash
node --check broncode/app.js
node --test codevoorbeelden/reference-behavior.test.mjs
python3 tools/verify-package.py
```

De vijf pure gedragsvoorbeelden behandelen selectie van geldige eigen thuiswedstrijden, zes stabiele slots, vervolgpaginering zonder verlies, de tijdscyclus van de stand en de begrensde eigen rij. De vijf tests zijn opnieuw uitgevoerd tegen de uiteindelijke levering en alle vijf geslaagd. Ze testen geen echte productieprovider, geen browseropslag en geen font-/layoutpixels. De JavaScript-syntaxcontrole en pakketverifier zijn opnieuw geslaagd. De verifier controleert de exacte bron, daadwerkelijke browsermetadata, beeldafmetingen, hashes, galerijlinks, Menu Studio-bronnen en volledige checksumlijst. De definitieve ZIP is daarnaast op CRC en iedere archiefentryhash gecontroleerd.

## Nog uit te voeren in VeyoCast

De geobserveerde prototypeweergaven zijn geen verklaring dat de VeyoCast-implementatie, Worker, Player, database, live Sportlink, publicatieflow, native export of fallback getest is. Die productie- en integratietests zijn niet uitgevoerd. Codex moet de acceptatiematrix uit `05-ACCEPTATIE-EN-TESTEN.md` uitvoeren tegen de daadwerkelijke actieve renderketen en bewijs opnemen in de implementatie-PR.

De technische repo-inspectie blijft die van **22 oktober 2026**, VeyoCast main `3bbb51ac006bbaf8381a11d5dcfd7024d13d3876`. Controleer latere repowijzigingen voordat de implementatie start. De losse contextregelprompt in `14-AANVULLENDE-PROMPT-CONTEXTREGEL.md` is nog niet geïmplementeerd en maakt geen deel uit van het actuele v9-capturebewijs.
