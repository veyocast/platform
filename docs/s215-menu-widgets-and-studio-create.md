# S215 — Menuwidgets en Studio-creatie

## Aangetroffen oorzaken

De browseractie gebruikte dezelfde idempotency-UUID voor de Studio-serie en haar
eerste project. Beide commando's schrijven in dezelfde receipt-tabel; productie
registreerde `23505` op de unieke receipt-sleutel (14 oktober, 11:36 en 11:49 UTC).
S214 gebruikte in zijn SQLproef twee verschillende sleutels en miste deze browseraanvraag.
De seriecommando's leiden nu zelf onafhankelijke, stabiele sleutels per project af.
Create, save, extra slide en replay zijn met de echte authenticated RPC getest.

De Menu-wizard bouwde bij iedere ontwerpwijziging een nieuw vlak document uit de
productselectie. Pagina's, widgetplaatsingen en subregels verdwenen daarmee. Ook
de presentatieprojector maakte alleen een vlakke prijslijst. De wizard bewaart nu
het volledige MenuDocument; alleen de gekoppelde bronproducten worden ververst.
De bestaande databasevalidatie wordt uitgebreid met expliciet getypeerde
widgetvelden. Alle andere identiteit-, prijs-, tenant- en assetchecks blijven gelden.

## Gedrag

- Categorie- en menuwidgets met aanpasbare naam/subtitel en één/twee productkolommen.
- Pagina's met één/twee kolommen; widgets over de breedte, links of rechts.
- Producten in een gekozen kolom, verplaatsen en verwijderen; productafbeelding.
- Vetgedrukte productnaam en normale subregels: vrije tekst of gekoppelde artikelen.
- Afbeeldingswidgets met 16:9/9:16, contain/cover/fill; deals met tekst en afbeelding.
- Extra pagina's, afzonderlijke previewnavigatie en inhoudsafhankelijke paginering.
- Achtergrond, contrast, accent, uitlijning, tekstgrootte, marge en formaat renderen
  daadwerkelijk. Te grote widgetinhoud krijgt dezelfde gemeten fit in preview,
  PNG en LG. Afbeeldingsframes behouden hun gekozen verhouding, ook op Chrome 79.
- Opslaan blijft een expliciete, revision-aware opdracht. Een concept wordt pas
  gereedgemaakt voor de playlist na serverbevestiging. Iedere menupagina krijgt
  haar ingestelde duur; de playlistplaatsing bewaart de totale duur.

## Behouden grenzen

Geen providerimport in slides, nieuw autosaveproces, nieuwe winkelbron,
dependency, workflow of wijziging aan immutable releases/offline-opslag. Het
frozen v17 CSS-bestand en alle locked assets blijven bytegelijk. De widgetcompositie
is een door de gebruiker gevraagde uitbreiding met dezelfde bronfonts en tokens;
er is geen onafhankelijke pixel-golden voor deze nieuwe compositie aangeleverd.
De oude bronlayouts behouden hun eigen renderer. De Player activeert uitsluitend
gecontroleerde lokale assets en behoudt zijn LKG.

## Validatie en uitrol

- Geïsoleerde verse database-reset: 164 migraties; volledige pgTAP/RLS-suite:
  107 bestanden, 3.029 assertions PASS. Inclusief echte menu create/save/heropen,
  configuratiemarker, immutable publicatiekandidaat en Studio receipt-replays.
- Workspace lint/typecheck/test: elk 30/30 PASS; bestaande optionele skips blijven
  als skips gerapporteerd. Een resourcegevoelige bestaande 20 ms cachedeadlineproef
  miste tijdens parallelle browserbelasting één aanvraag; de volledige seriële
  foundationrun is daarna opnieuw geslaagd zonder wijziging aan die proef.
- Source-wizardmatrix: 58 daadwerkelijke Chromiumproeven PASS. De drie nieuwe
  widgetcases dekken mobiel/tablet/desktop, volledige main-axe, prijs-/subregel-
  behoud, beeldverhouding, vormgeving, opslag/heropenen en playlistvoorbereiding.
- Werkelijke Chromium PNG-capture: 11 PASS, beide thema's en oriëntaties,
  onderscheiden pagina's, gecontroleerde assets en geometrie binnen het canvas.
- Trusted Player markup: 7 PASS, alle widgetpagina's met cachetokens en eigen CSS.
- Offline-suite: 7 PASS, waaronder LKG-startup, corrupte pending bytes en SW-ranges.

Een brede lokale Player-run liep na 200+ proeven tegen de gedeelde inotifylimiet
van de developmentservers aan. De betrokken proefserveerders zijn beëindigd;
vervolgcontroles gebruiken één productiebuild, zoals de CI: 30 PASS, waaronder
de twee nieuwe LG-widgetproeven en alle betrokken eerdere uitval. De exacte volledige
CI, staging en production zijn de laatste gates vóór afronding; hun resultaten
staan bij de pull request en deploymentrun.

Rollback gebeurt met een forwardmigratie. De configuratiehelper kan aan zijn
voorganger delegeren; bestaande widgetdocumenten moeten bij renderrollback
leesbaar blijven. De onafhankelijke receipt-afleiding kan behouden blijven.
Geen bestaande data wordt door deze migratie verwijderd of herschreven.
