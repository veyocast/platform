# S237 — Rustige sponsorwerkplek

De sponsorroute stapelde de zichtbare campagnebibliotheek, partnerformulieren,
goedkeuring, materiaal, posities en CRM als grote kaders onder elkaar. De
gekozen Sourcewerkplek heeft vier tabbladen: Campagnes, Partners, Pipeline &
taken en Afspeelregistratie. Eén hoofdtaak en bijbehorende formulieren openen
nu gericht in bestaande toegankelijke dialogen. De werkelijke capabilities,
serveracties, nativePOSTs, campaign-/sponsorIDs en publicatieketen blijven
behouden. CRMonderdelen blijven gemount bij tabwissels; oude hashlinks werken.

De latere gebruikersvraag om minder massale containers is een expliciete
dichtheidsdelta op Source: de campagnebuitenkaart heeft geen tweede padding,
de werkelijke acties en Beheren delen één rij en status staat eenmaal in het
overzicht. Metrics worden ook op desktop compacte feitelijke samenvattingen. De
Sourceillustratie blijft binnen haar eigen kader. Alle controls behouden44px,
primaire copy14px en bestaande bronkleuren; immutable SourceCSS/assets gelijk.

De controle vond ook functionele fouten. Een gewone nieuwe campaigns-array
verwerkte dezelfde hash opnieuw en kon materiaalinvoer sluiten. Dezelfde
reeds verwerkte hash wordt eenmaal toegepast; nieuwe/onbekende latergevonden
hashes blijven werken. Verse campagneprops blijven status/capabilitykeuzes
sturen. De bestaande sponsorId gaat mee in de klant-DTO zodat materiaal voor
campagnevanB ook opB begint, zonder expliciete invoer bij refresh te vervangen.
De activiteiten tonen de echte SQLauditcodes in begrijpelijke taal.

## Validatie en grenzen

De eerdere writerfreeze heeft scopedlint/TSC, elf ongewijzigde CRMunits en
componentbewijs; de eerste huidige vollecohort7PASS/1readinessfixtureFAIL
blijft behouden. Radix verbergt bij directe campagnehash de achtergrondheading
terecht. Alleen die mount vraagt nu dezelfde h1tekst plus de echte zichtbare
dialoog. De partnerregressie faalde eerst met ontvangenA/verwachtB en is na
productcorrectie groen. Na de dichtheidscorrecties8/8PASS zonderretry/skip;
de laatste illustratiecontainmentcheck slaagt in een nieuw volledig huidig
cohort8/8,0SKIP/0retry in18,6seconden.
Alle68gecombineerde foundationtaken slagen (Control1272PASS/34bestaandeSKIP).

Componenttests gebruiken de echte serverpagina, werkruimte, forms en CSS met
expliciete gecontroleerde session/data/actiontransportgrenzen. Zij bewijzen
geen echte databasecommit, publicatie, audiencemeting of algemene pixelpariteit.
Root heeft native390/1440beelden bekeken. Echte AAL2routeacceptatie, exacte
gecommitteerde CI en staging/productie blijven eigen volgende grenzen. De
vijf volledige auditronden en V1 zijn niet afgerond. Fysieke24u/SendGrid/
YouTube/Mollie blijven volgens gebruikersinstructie uitgesteld.

## Laatste visuele vervolgcontrole
De echte1440capture toonde nog160px metrics,575px campagnekaarten en
afgesneden zoektekst. De lokale delta gebruikt nu compacte metriekrijen,
130px campagnebeelden en metadata zonder extra omkadering. Binnenruimte
blijft18px met14px tekst en44px acties. De zoekinput benut zijn werkelijke
breedte. Beide390/1440captures zijn opnieuw gemaakt en beoordeeld; er is
geen immutable SourceCSS gewijzigd.

Het bestaande CRM-Sheet is een bodyportal buiten de pagina. Het krijgt daarom
ook lokaal de Source scope, Manrope,26/24px titel en44px sluitknop. De echte
beideviewportcases controleren het zijpaneel, aXe, Escape en focus, zonder
nieuwe writes. De finale huidige cohort heeft8/8PASS,0retry/0skip,1worker in
19,6s (`/tmp/veyocast-s237-browser-root-current-crm-density-v3.json`).

De eerdere108,39px metricbevinding blijft in het v1rapport bewaard; padding
en gap zijn gericht verminderd, de100px-grens blijft gelijk. Het voorafgaande
volledige actuele foundationcohort heeft68/68PASS,64cached. Geïntegreerde
foundation na normale S234merge, exacte hosted CI en uitrol volgen apart.
