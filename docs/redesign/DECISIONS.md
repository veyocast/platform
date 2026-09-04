# FieldFlow beslislog

## D001 — Twee opdrachten vormen één programma

De platformhandoff reserveert slidepixels voor later; het gelijktijdig
aangeleverde autonome slideprompt autoriseert en specificeert precies dat latere
domein. S144 voert daarom beide werkstromen uit. De hogere repo-invarianten
blijven ongewijzigd.

## D002 — Merkcanon wint van een afwijkende accentregel

FieldFlow-productoppervlakken gebruiken de rustige canvas-, petrol-, groen- en
semantische kleuren uit de handoff. De locked designcanon blijft hoger: primaire
VeyoCast-acties gebruiken Electric Orange `#FF5C20` met Ink Black tekst. Het
orange `#E98A4A` uit de handoff wordt alleen een secundaire warme semantische
tint; het slidecanvas gebruikt zijn eigen outputtokens.

## D003 — Geen vierde ontwerplaag

FieldFlow vervangt de zichtbare Atelier/Vector-presentatielaag. Bestaande
exports en CSS-variabelen mogen alleen tijdelijk als deprecated alias naar
FieldFlow wijzen, met S144 als owner en merge als deadline. Historische
slide-renderers zijn geen product-UI-laag maar permanente immutable
compatibiliteit.

## D004 — Informatiearchitectuur

Tenantgroepen zijn Vandaag, Content, Uitzenden, Bronnen, Groei en Organisatie.
Platformgroepen zijn Operatie, Klanten, Support, Product en Toegang &
governance. Mobile gebruikt Vandaag, Schermen, Content, Maken en Meer.
Marketing gebruikt Product, Voor clubs, Inspiratie, Prijzen en Support.

## D005 — Menselijke routecopy, stabiele domeincontracten

De UI noemt releases `Publicaties`, tenant templates `Playlist-sjablonen` en
dynamische templates `Renderformats`. Interne tabel-, RPC- en immutable
releasebenamingen veranderen niet. Oude deep links krijgen één-hop
serverredirects met querybehoud.

## D006 — Themecompatibiliteit is additief

`fieldflow` is de enige zichtbare keuze en de default voor nieuw/muteerbaar
werk. De tien bestaande IDs blijven valide voor frozen historische snapshots.
Onbekende IDs falen expliciet; ze worden niet stil naar een willekeurig thema
omgezet. Er is geen backfill.

## D007 — Eén resolved snapshot, twee renderers

Modern, static LG, editorpreview, thumbnail, poster en fallback consumeren
dezelfde gevalideerde en bevroren resolved viewmodel/snapshot. Static LG blijft
een zelfstandige Chrome-79-veilige renderer en wordt niet vervangen door React.

## D008 — Fotografie is generiek, geen klantbewijs

De tien aangeleverde AI-beelden zijn goedgekeurde generieke sfeerbeelden.
Alt-tekst beweert geen echte vereniging, persoon of klant. Er wordt geen UI in
schermen gecomponeerd voordat een echte, actuele productcapture beschikbaar is.

## D009 — Historische S144-deploymentautoriteit en externe bescherming

De S144-gebruikersopdracht autoriseerde push, PR, merge, staging en production.
Rode gates, Environment approval, secrets, GitHub Billing en fysieke hardware
werden niet omzeild. De toen vastgelegde Actions-billingblokkade bleef extern;
dit historische besluit verleent S145 geen visuele of releasegoedkeuring.

## D010 — De actuele gebruikersreferenties leiden de zichtbare S145-uitvoering

De v1.6-regressiebaselines vereisen een gerichte correctie van Control Vandaag,
Studio Nieuw en de marketinghome. De laatste expliciete gebruikersinstructie
maakt vijf PNG's leidend voor Overzicht, Planning, Schermen, Studio en
Marketing. Daarmee zijn de zichtbare S144-uitvoering en conflicterende oudere
visuele canon voor deze surfaces vervangen. S145 wijzigt de betrokken
presentatie en bewijsvoering, maar geen database-, RLS-, Player-, offline-, locked-brand-,
toegankelijkheids- of immutable-releasecontract. Historische S144-slidegoldens
blijven uitsluitend technisch regressiebewijs en worden niet vernieuwd.

## D011 — Visuele fixtures zijn development-only

De dashboardstate-matrix gebruikt expliciete fixtures uitsluitend wanneer
zowel `NODE_ENV !== production` als `FIELDFLOW_VISUAL_QA=1` geldt. De gewone
route blijft door serverdata en één centrale operationele state-machine gevoed;
een queryparameter kan productiegedrag niet simuleren.

## D012 — Advisorfouten krijgen een eigen database-eigenaar

De verse S145-reset en RLS-suite zijn groen, maar de Supabase-linter vindt zes
bestaande fouten in platform-role- en RSS/Sportlinkfuncties. Vier actieve
beheerfuncties roepen een niet-bestaande private autorisatiehelper aan:
supportrollen aanmaken/toewijzen, een verwijderverzoek beoordelen en retention
uitvoeren. Zij falen transactioneel gesloten, maar de betreffende functie is
niet beschikbaar. De twee andere meldingen zitten in verouderde RSS- en
Sportlink-completionfuncties waarvan de `ON CONFLICT`-sleutel niet meer bij de
actuele unique constraint past; de actuele workers gebruiken nieuwere versies,
maar deze compatibilityfuncties blijven ongeldig. Een corrigerende forward-only
migratie zou het expliciet uitgesloten high-conflict databasepad raken. S145
registreert daarom oorzaak en gevolg, maar neemt geen stilzwijgende schemafix op.
Dit was de juiste stopbeslissing vóór nieuwe autorisatie; D019 supersedeert haar
nadat de gebruiker database-ownership expliciet heeft uitgebreid.

## D013 — Captured is niet hetzelfde als approved

De 73 current-statebeelden — 71 primaire state-/routecaptures en twee
opstellingsdetailcaptures — en negen contact sheets zijn na de laatste
codewijziging reproduceerbaar en technisch gecontroleerd. De Playwrighttest
controleert contracten, runtimefouten, overflow, shellopbouw, controlhoogtes en
de twee expliciet gemelde geometrische details; de generator maakt
side-by-sidebeelden maar geen automatische pixeldiff. Alle negen sheets hebben
na de gebruikersbeslissing van 4 september 2026 status
`ACCEPTED_BY_USER_2026-09-04`; Codex heeft deze goedkeuring niet zelf ingevuld.

## D014 — Exacte rasterreferentie wijzigt geen waarheid of locked assets

De exacte ronde/orbit-lock-up en de exacte hero-, volwassen teamhuddle-,
tactiek/vrijwilligers- en onderste CTA-bronfoto's uit de rastertargets zijn
niet als goedgekeurde bronassets aangeleverd. De officiële locked
VeyoCast-lock-up wordt daarom niet gereconstrueerd. Waar een targetkleur afwijkt,
blijven de officiële semantische
tokens leidend totdat de merkeigenaar een wijziging goedkeurt. In Studio blijft
de actie `Genereren` heten: zij maakt een render/media-item en publiceert nog
geen immutable release. Deze begrensde afwijkingen waren blockers voor een
claim van exacte menselijke visuele goedkeuring. D018 supersedeert die
assetidentiteit met de expliciete keuze voor het huidige icon en de beschikbare
approved foto's; het technische capturecontract blijft ongewijzigd.

## D015 — Native broken-imageartefacten zijn een productfout, geen reviewgrens

Marketingafbeeldingen worden via één robuuste wrapper pas zichtbaar nadat het
beeld daadwerkelijk is geladen. Een foutstatus blijft visueel onzichtbaar en
laat de bestaande layout intact. Daarmee zijn native broken-imageglyphs en
onbedoeld zichtbare alttekst opgelost. Bij een synthetische totale beeldfout
verdwijnen image-based header- en footer-lock-ups echter ook; een nagemaakte
tekst-/vectorfallback is verboden zolang het officiële locked targetasset
ontbreekt. Dat is geen herintroductie van het browserartefact; D018 registreert
deze schone totale-foutstate als expliciet geaccepteerde P2.

## D016 — Onzekere historische screenshotdiffs blokkeerden de commit

Vijf gewijzigde historische PNG's in de gedeelde worktree kunnen niet zonder
bewijs aan S145 worden toegeschreven. Zij tellen niet mee in de actuele set van
90 S145-PNG's en worden niet stilzwijgend overgenomen of teruggedraaid. De
primaire agent classificeert hun ownership vóór commit; tot die tijd blijft de
branch ongecommit en worden push, PR, merge en deployment niet gestart.
Dit was de juiste stopbeslissing zolang menselijke classificatie ontbrak;
D020 supersedeert uitsluitend deze releaseblokkade nadat de gebruiker opname
expliciet heeft geaccepteerd.

## D017 — De ingeklapte shell heeft een eigen zichtbaarheidscontract

Een tenantspecifieke regel met hogere specificiteit maakte de labels in de
72px-zijbalk na inklappen opnieuw zichtbaar en duwde de tenantmarkering tegen de
railgrens. FieldFlow verbergt in collapsed desktopmodus nu expliciet alle
navigatie- en tenantcopy, centreert de markering binnen de rail en bewijst beide
eigenschappen in de release-evidencetest. De post-fix capture en het opnieuw
gegenereerde shellreviewblad zijn visueel schoon.

## D018 — De gebruiker accepteert de S145-review en kiest beschikbare assets

Op 4 september 2026 heeft de gebruiker de actuele reviewuitvoering expliciet
als “Perfect” geaccepteerd, met twee bindende assetkeuzes: behoud het huidige
officiële VeyoCast-icon en vervang ontbrekende referentiefoto's door een kleine
selectie uit de aangeleverde, beschikbare set. Het huidige icon en de locked
logoassets blijven daarom bytegelijk. De reeds zichtbare selectie wordt
definitief: FF-PHOTO-01 voor de hero, FF-PHOTO-06 voor team-/clubmomenten,
FF-PHOTO-05 voor het tactiek-/vrijwilligersblok en FF-PHOTO-04 voor de onderste
CTA. Deze menselijke beslissing accepteert alle negen actuele S145-reviewbladen
en supersedeert de ontbrekende targetidentiteit van logo en foto's; geometrie,
layering, spacing, waarheid, toegankelijkheid en hogere technische invarianten
blijven ongewijzigd. Codex kent deze status niet zelf toe maar registreert de
expliciete gebruikersbeslissing.

## D019 — Expliciete database-ownership herstelt de zes lintfouten forward-only

Op 4 september 2026 heeft de gebruiker expliciet gevraagd de Supabase-errors op
te lossen. Dat breidt S145 uitsluitend uit met één forward-only migratie en één
gerichte pgTAP-suite; andere high-conflict databasepaden blijven uitgesloten.
De drie menselijke ownercommands hergebruiken de bestaande
`private.require_platform_owner_aal2()`-grens. Retention blijft via ACL én
requestrol uitsluitend voor `service_role` beschikbaar en registreert de
scheduled worker. RSS-v1 behoudt zijn oude payload-/no-opcontract, maar laat
snapshotqueueing alleen aan de actuele versiegebonden revision-trigger over.
De historische Sportlink-helper accepteert alleen de lege standingsarray die
de actuele wrapper doorgeeft; obsolete nonempty writes falen met `22023`.

Er worden geen oude unique constraints hersteld, geen historische snapshots of
releases herschreven en geen RLS-policy of tabel gewijzigd. Alle zes functions
behouden hun signature, `SECURITY DEFINER`, `search_path = ''` en expliciet
beoordeelde ACL's. Een verse reset, 38 gerichte assertions, de volledige suite
van 70 bestanden/1.624 assertions en error-level db-lint met nul resultaten
vormen het acceptatiebewijs.

## D020 — De gebruiker accepteert de resterende S145-releasegrenzen

Op 4 september 2026 heeft de gebruiker de vijf afzonderlijk benoemde
historische PNG-diffs expliciet geaccepteerd voor opname als
`ACCEPTED_FOR_INCLUSION_BY_USER_2026-09-04`. Hun herkomst blijft historisch en
zij worden niet alsnog als onderdeel van de 90 S145-evidencebeelden of als
bewezen nieuwe S145-provenance gepresenteerd.

De fysieke LG 43UL3J-EP is niet door Codex of repositorybewijs bediend en
blijft daarom feitelijk `EXTERNAL_UNTESTED`. De gebruiker heeft uitsluitend de
S145-releasegate voor deze ontbrekende hardwaremeting expliciet geaccepteerd
als `WAIVED_BY_USER_2026-09-04`; dit is geen claim dat installatie, autostart,
pairing, online/offline boot, LKG, reconnect of recovery op een toestel zijn
geslaagd.

De gebruiker heeft tegelijk push en de beschermde immutable
staging→productionuitrol geautoriseerd. PR-gates, merge, stagingvalidatie,
exacte image-identiteit, productieapproval en productionreadback blijven
verplicht en mogen niet door deze menselijke acceptatie worden omzeild.
