# Sites v11: exacte overname in de productieruntime

De producteigenaar heeft op 11 oktober 2026 de volledige overname en vervolgens
commit, push, staging en production geautoriseerd. De presentatiebron is Sites
v11, `b1cae899af19fc39908217253094c5240d7359fc`. De onderzochte platformbasis
uit de overdracht is `6fcc26f02c8050b7244e3660a93b85f02491e121`; de daadwerkelijke
implementatie begint bij `c3ef6b504dcd534b1988e2a96df102be08ce1118`, inclusief
S189 (vorm voor alle teams) en S190 (duurzame live integraties en versieopruiming).

Dit is een gerichte design-delta. Sites bepaalt de zichtbare componentstructuur,
effectieve CSS-cascade, fonts, assets, templates, mobiele navigatie en taakflows
voor de in de matrix genoemde oppervlakken. Conflicterende eerdere
Publisher-/FieldFlow-/Royal-Current-presentatievoorschriften zijn daarvoor
vervangen. De oude canons en historische releases blijven bestaan.

Server-side capabilities, actieve tenant, AAL2, RLS, private media, locked
VeyoCast-assets, toegankelijkheid, immutable publicatieconfiguraties,
monotone targets, volledige assetverificatie en offline last-known-good blijven
bindend. Providerdata gaan via worker en database naar gepubliceerde datasets;
bronupdates maken geen nieuwe playlist- of slideversie en resetten geen timer.
S190 verwijdert uitsluitend niet meer gebruikte vorige versies na controle
van actieve apparaten, toewijzingen, ontwerpen en jobs.

De Marketingcontainer ontvangt de bestaande serversleutel uitsluitend via de
server-side `VEYOCAST_SETUP_INTENT_SIGNING_SECRET`-alias. De echte calculator
kan daardoor zijn getypte, vervallende configuratie veilig meenemen; de
deploymentvalidator weigert ontbrekende configuratie. Een negatieve controle
met de echte Compose-config is geslaagd, zonder nieuwe credentials of
browserblootstelling.

De technische uitvoer blijft Next.js/Supabase, met bestaande beschermde
SHA-image-deployment. De Sites-hashrouter, demo-opslag en hostingconfiguratie
zijn referentie. Er komt geen tweede productieplatform.

## Vastgelegde bron en inventaris

De originele overdracht is byte-ongewijzigd gecontroleerd met de eerst gelezen
standaardbibliotheek-verifier: 280 pakketbestanden, 253 Sites-bronbestanden,
82 public-assets en alle CSV-aantallen zijn geldig. De oorspronkelijke pakket-
en provenancegegevens staan in `handoff/`. Alle 82 assets zijn vervolgens
byte-identiek naar de public-mappen van Control, Player en Marketing gekopieerd.
`system-assets.json` bevat hun versie, SHA-256, MIME en omvang.
De 253 oorspronkelijke Source-bestanden staan tevens byte-ongewijzigd in
`reference/sites`; `scripts/verify-sites-reference.mjs` controleert ze tegen het
ongewijzigde overdrachtsmanifest. De productiecontainer sluit deze onafhankelijke
testreferentie uit. Een aparte CI-matrix vergelijkt alle 548 broadcastgevallen
in vier begrensde groepen, met nul pixeltolerantie en veertien dagen readbacks.
Daarbij worden ook alle 76 letterlijke startervarianten en de oorspronkelijke
66 responsive interfacegevallen per criterium gecontroleerd; een ontbrekend
paneel, afbeelding, font of bereikbare primaire actie kan geen PASS opleveren.
De guard controleert alle negen v3-criteria, de vastgelegde paginering onafhankelijk
van de productiehelper en de werkelijk gebruikte extra beeldvarianten. Negen
regressietests bewijzen dat weggevallen criteria, pagina’s of varianten worden
geweigerd; alle 644 opgenomen broadcastframes zijn opnieuw via hun opgeslagen
SHA gecontroleerd. Dit is expliciet samengevoegd runbewijs, geen nieuwe
volledige rendererherhaling.

De matrices in `inventory/` behouden alle oorspronkelijke records en bevatten
aanvullend implementatiepad, status en bewijs. Een opgenomen case is geen
geslaagde test. Alleen werkelijk uitgevoerd bewijs verandert die status.

## Contentzones

De schema-ID's zijn `main`, `side`, `bottom`; layouts zijn `full`, `sidebar`,
`bottom`, `three`. Mainbreedte is 50–80% in stappen van 5, standaard 70%;
onderbalkhoogte 15–35% in stappen van 5, standaard 20%. Iedere zone gebruikt
contain en een eigen item-/paginaklok. De assetset is de unie van alle zones.
Alleen main produceert gewone audio. Een planning vervangt uitsluitend main;
side/bottom blijven bij hun gepubliceerde binding. Defaultcontentwijzigingen
beëindigen geen lopende planning.

LED-events en sponsorlagen zijn schermbreed. De bestaande pause-policy pauzeert
alle zoneklokken en video's en hervat hun resterende tijd. Events en Proof of
Play worden niet per zone vermenigvuldigd. Nieuwe composities activeren als
geheel op een natuurlijke grens; incomplete output behoudt last-known-good.

## Acceptatie

De volledige opdracht en criteria zijn bewaard in `handoff/`. Bronvergelijking,
browserpariteit, echte serveropslag, stagingreadbacks en fysieke hardware zijn
afzonderlijke bewijzen. Ontbrekende fysieke apparaten of externe providers
worden als concrete blokkade vermeld. Ze worden niet afgeleid uit een build,
heartbeat of geslaagde lokale screenshot.
