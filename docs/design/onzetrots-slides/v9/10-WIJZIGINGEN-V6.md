# Wijzigingen v6 — 23 oktober 2026

**Historisch:** v8 vervangt de onderstaande v6-fontkeuze en headerhoogtes met Rubik Distressed en subtitel boven titel. Gebruik voor actuele waarden `12-WIJZIGINGEN-V8.md`; de overige behouden regels blijven gelden.

Dit document legt de goedgekeurde v6-layoutwijziging vast; de aanvullende v7-entree staat in `11-MOTION-V7.md`. De v6-keuze vervangt de v5-regel zonder buitenheader. De v6-broncommit is `bf41fd2861efbf0e6e6af9128012d8062e37344e`. De VeyoCast-repository is voor deze wijziging nog niet aangepast; de technische repo-inspectie blijft die van 22 oktober 2026 op main `3bbb51ac006bbaf8381a11d5dcfd7024d13d3876`.

| Onderdeel | Nieuw goedgekeurd gedrag |
| --- | --- |
| Slidekop | Iedere slide heeft precies één aparte kopcontainer boven de inhoud |
| Koptekst | Altijd zichtbaar veld `HEADERTEKST`, aria `Headertekst voor deze slide`, maximaal 120 tekens, standaard `family.label`; onafhankelijke opslag per familie |
| Lege kop/reset | Leeg blijft leeg; `Standaard herstellen` herstelt alleen de huidige familie |
| Eigen clublogo | Helemaal rechts in de aparte kopcontainer; generieke decoratieve eigen-logo’s worden niet in binnencontainers herhaald |
| Inhoudelijke logo’s | Echte thuis-/uitteamlogo’s, ranglijstlogo’s, bezoekerscrests en sponsorlogo’s blijven bij hun inhoud |
| Bezoekersgroep | `WELKOMSBLOK`, aria `Grootte bezoekerslogo en welkomstekst`, 100–200%, stap 5, standaard 150% van de v5-basis; crest/naam/begroeting schalen gezamenlijk |
| Wedstrijdcaption | Volledige wedstrijd blijft apart, gewicht 800 en +3 logische pixels per bijbehorende v5-compositie |
| Fit | Alle 1/2/3/4-composities blijven passen, ook bij toegestane schaalgrenzen, in licht/donker en liggend/staand |

De eerdere keuzes blijven onderdeel van de opdracht: maximaal vier geldige aankomende eigen thuiswedstrijden; klokchip boven score; vaste 3×2-grids met lege restposities; bewegende stand met begrensde eigen rij; witte kleine OnzeTrots-footer zonder achtergrond. De aparte slidekop neemt wel ruimte in: vergelijk daarom de hele v6-compositie met de vernieuwde bron en voorbeelden.

Koptekst en bezoekersschaal zijn authoringconfiguratie. Koppel ze in VeyoCast aan gevalideerde opslag, revisions/publicatie, preview, Worker en Player. Koptekst wordt als tekst gerenderd, met veilige escaping. Bronrefresh mag een aangepaste kop niet overschrijven. Het prototype bewaart deze instellingen onder `localStorage`-sleutel `onzetrots-studio`. De bezoekersschaal is gedeeld door `visitors` en `welcome`. De gevraagde schaal wordt bewaard; de werkelijk getoonde schaal is `min(gevraagdeSchaal, beschikbareBreedte / natuurlijkeBreedte, beschikbareHoogte / natuurlijkeHoogte)` van de v5-identiteitsgroep.

De kopcontainer is 104/112 logische pixels hoog (liggend/staand), met 18/22 marge eronder en padding 16×30/18×25. Het logo meet 58×68/56×66. Permanent Marker begint op 42/38 en kan verkleinen tot 18 om in de beschikbare teksthoogte 72/76 te passen. De exacte captionwaarden per aantal en oriëntatie staan in `02-VISUELE-SPECIFICATIE.md`. Deze maten zijn overgenomen uit de geïmplementeerde v6-bron; de logische canvasschaal blijft gelden.

De Markdown-opdracht, visuele specificatie, integratiekaart, datanotities, acceptatiecriteria, catalogus, assetnotities, voorbeeldbediening en validatie-instructies zijn op deze besluiten aangepast. Oude v5-screenshots en eerdere regels over decoratieve logo’s in binnenkoppen zijn geen v6-eindreferentie. Voor v7 blijven de 160 v6-layoutcaptures behouden omdat de eindlayout gelijk blijft. De actuele v7-bron (`d5005d8cc7cdb794edb3b1a40cda70a3491b2b0c`) en nieuw motionbewijs worden afzonderlijk vastgelegd; de 160 v6-captures behouden hun v6-bronidentiteit. De verpakkingsstap vernieuwt broninventaris, manifest en checksums en vult het daadwerkelijke v7-bewijs in.
