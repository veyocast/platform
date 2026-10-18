# S234 — Zichtbare en bedienbare Source-templatekeuzes

De gebruiker meldt op 19 oktober dat de echte chooser onleesbaar is en vraagt
alle dynamische families via bruikbare wizards plus vijf volledige controles
vóór oplevering. Zijn screenshot toont 36 kaarten als twaalf platgedrukte rijen
zonder leesbare naam/omschrijving. Dit is een concrete productfout.

Werkbasis S231-commit 6b8b914665cb951e8da6a070ebe7a69336b91b0c, worktree
`/home/codex/repos/castivo-s234`, branch
`veyocast/s234-source-template-wizards`. Lees de gebruikelijke repo-canons,
S226 en S231. S231-PR257 wordt onafhankelijk getoetst; geen merge/deploy hier
voordat zijn normale promotie is afgerond.

Deze eerste toetsbare wijziging herstelt uitsluitend de Source-templatekiezer.
De 36 families, oorspronkelijke namen/omschrijvingen, 3/2-koloms responsive
structuur, Source-assets en echte renderer blijven leidend. De grid met65vh
en impliciete auto-rijen mag kaarten niet tot35px laten krimpen. Natuurlijke
previewverhoudingen en zichtbare tekst moeten blijven bestaan, ook voor de
laatste kaart. Eén gecontroleerde scrollgrens, geen renderer- of Sourcepatch,
geen crop/mask/normalisatie die een defect verbergt.

`release_audit` bezit uitsluitend
`apps/control/app/(shell)/dashboard/studio/sync-studio-create-dialog.tsx`,
nieuw `sync-studio-create-dialog.module.css` in dezelfde map en nieuw
`tests/control/sync-template-picker-layout.spec.ts`. Bewaar alle bestaande
create-, receipt-, actor-/tenant-, cache-, rechten- en navigatiesemantiek.
Geen action/service/SQL/sharedCSS/dependency/workflowwijziging.
Maak eerst een betekenisvolle rode geometrie-/zichtbaarheidstest van de
werkelijke component met echte product-CSS; daarna minimale scoped fix en
dezelfde test. Controleer alle36kaarten, namen/omschrijvingen, previewratio,
scroll naar laatste kaart, groepfilters, toetsenbord, 44px en aXe op390/1440.
Alleen een visuele testcase is geen bewijs van een echte create/publicatie.

Root regelt frozen offline installatie, QA3396/runtime, beschermde auth,
read-only echte routecapture tegen de ongewijzigde Source4291, gezamenlijke
integratie/CI en normale uitrol. Eén browserworker tegelijk, expliciet rootGO.
Geen eigen install, reset, commit, push of deploy. Bewaar rood bewijs en
oorspronkelijke screenshot. Root bezit docs, ledger, vijf-rondenprogramma,
familie-/wizardmapping en vervolgintegratie. De volledige wizardverbetering
wordt afgebakend op basis van de parallelle catalogusaudit; deze kleinschalige
layoutfix claimt geen volledige wizard- of V1-acceptatie.

## Uitbreiding na concrete catalogus- en routeaudit

De gebruiker benadrukt opnieuw dat de UI niet bij het prototype aansluit.
De catalogusaudit bewijst36Sourcefamilies/17Sportlinktypes, maar de huidige
chooser creëert direct een handmatig project en verstopt automatische bronnen
achter een tweede editorroute. Root bezit vóór verdere writes de default-
routecorrectie in `studio/page.tsx`, de Source-only route `studio/new/page.tsx`,
de twee bestaande Studio-links in `sources/sites-sources-overview.tsx`, en
nieuw `studio/sync-create-wizard-types.ts`, `sync-create-wizard-data.server.ts`,
`sync-create-wizard-actions.ts` met eigen gerichte servertests. Root wijzigt
de chooser en Content-canCreate pas na de lopende read-only routecapture en
expliciete terugname van ownership. Oude ongebruikte editor/API/decoderpaden
worden niet verwijderd; bestaande data en gespecialiseerde functies blijven
geïnventariseerd tot hun echte Source-vervanger bewezen is.

`scenario_audit` bezit uitsluitend nieuw
`studio/sync-create-wizard.tsx`, `sync-create-wizard.module.css`,
`studio/sync-create-wizard-state.ts` plus eigen state-unit en nieuw
`tests/control/sync-create-wizard.spec.ts`. De typed interface wordt door root
eerst neergezet; daarna volgt een aparte schrijf-GO. Hergebruik de bestaande
Source-field-/button-/preview-/team-/Engage-/YouTubecomponenten en de echte
canonieke broncompile/preview. Geen tweede schema/provider of demoresultaten.
De stappen Bron, Inhoud, Vormgeving en Controleren behouden invoer, undo naar
een eerdere stap, actor/tenant/familiegebonden journal en de volledige originele
opdracht vóór POST. Een verloren antwoord herhaalt dezelfde body/nonce; geen
eerste projectaanmaak vóór bevestiging. Een echte bronpreview is vereist voor
de connected-opdracht. Ontbrekende dataset/toestemming/team/template geeft
een concrete herstelactie en biedt waar toegestaan handmatige invoer.
Vier handmatige families en Engage/YouTube gebruiken hun eigen echte controles;
de30canonieke bronfamilies maken rechtstreeks een Syncbronontwerp, zonder
vooraf een ongebruikt handmatig project aan te maken. Goalkaart en echte
eventoverlay worden in begrijpelijke producttermen onderscheiden.
Desktop/mobiel worden op de gekozen Source-compositietaal getoetst; geen
oude Sites-v17builder of technische template-ID's in de klantflow.
Geen SQL, renderer, Player, package/lock, sharedCSS of workflowwijziging.
Browserchecks wachten op vrijgave na de huidige echte chooser-Sourcecapture.

Ronde1 van de echte modalvergelijking heeft de geometryfix bevestigd maar
concrete Sourceverschillen gevonden in panelwidth, radius, headerhoogte,
titeltypografie en plaatsing van de beschrijving. `release_audit` krijgt vóór
verdere writes dezelfde3chooserpaden opnieuw vrij voor exact die modalgrenzen.
Gebruik de oorspronkelijke Source Modal-structuur/stijlen: titel en close in
eigen header, beschrijving boven de filters in de body, oorspronkelijke
desktop960px en mobiele viewportgrenzen. Behoud DialogTitle/Description-
semantiek, focus/Escape,44px en alle callbacks/journals/brondata. Alleen lokale
moduleCSS/classNames en de noodzakelijke description-DOMplaatsing; geen
shared Dialog-, Source-, globaleCSS- of rendererwijziging. Bewaar round1raw-
rapport/PNGs en componentvoor/na; na dezelfde zes browsercases volgt een
nieuwe echte Sourcevergelijking. Vijf viewports zijn geen vijf auditronden.

Root bevestigt vóór writes ook de chooser-only overlay in dezelfde lokale
module via de siblinggrens van dit specifieke dialog. De oorspronkelijke
Source-overlaykleur/blur wordt overgenomen zonder shared Dialog- of globale
CSSwijziging. Andere modals blijven hierdoor onaangeraakt en worden apart
daadwerkelijk met Source vergeleken.

Root heeft de ruwe1440Source/actualcaptures zelf visueel vergeleken: naast de
modalchrome ontbreekt de inhoud van alle templatevoorbeelden. De productie-
starter blijft terecht leeg, maar mag niet als identiek leeg voorbeeld voor
alle36opmaken dienen. `media_db` bezit vóór writes uitsluitend nieuw
`studio/sync-template-preview.ts` en zijn `.test.ts`: pure canonieke
presentatievoorbeelden uit de immutable Source-defaults/voorbeeldrijen, met
dezelfde bestaande renderer en officiële referentieassets. De kiezer noemt
dit expliciet een opmaakvoorbeeld; het is geen live klant-/bronclaim. Geen
voorbeeldvelden, namen of prijzen worden doorgegeven aan een nieuw ontwerp,
de writer, snapshot, provider of database. De echte lege starter blijft
bytegelijk en wordt apart getest. Alle36families moeten schema-valid en hun
oorspronkelijke verschillende Source-opmaak herkenbaar zijn. Geen import van
de reference App/store in product, externe requests, nieuwe assets, renderer-
of sharedCSSwijziging. Root integreert deze helper pas nadat de lopende
chooser-Sourcecapture en writerownership zijn vrijgegeven.

Root bezit ook uitsluitend de twee compatibiliteitsroutes
`studio/sportlink/page.tsx` en `studio/rss/page.tsx`: oude zichtbare sluglinks
gaan naar dezelfde echte Source-wizard zonder ze als project-UUID te laden.
Geen verandering aan de UUID-route of bestaande projecten.

Na freeze van de chooser neemt root diens integratie over. `release_audit`
bezit daarna uitsluitend aanvullend de Beheer-dialoggrens in
`app/(shell)/_components/control-shell.tsx`, nieuw
`sync-management-dialog.tsx` en `.module.css` in die map, plus nieuw
`tests/control/sync-management-dialog.spec.ts`. Port de werkelijke gekozen
Source managementgrid, titel, beschrijving, icon-/kaartvorm en responsiveflow.
Gebruik uitsluitend de al server/capabilitygefilterde navigationitems en
bestaande echte hrefs; geen nieuwe permissiecatalogus of verborgen adminactie.
Alle bestaande toegestane domeinen moeten bereikbaar blijven via hun passende
Sourcekaart/vervolgactie; geen functie stil verwijderen om het aantal kaarten
gelijk te maken. Geen verticale oude secondary-nav als vervanger van het
Sourcegrid. Behoud Dialog-focus/Escape/44px, mobiele scroll en geselecteerde
route. Andere shellcontrols, sessies, rollen, contexten en acties blijven
ongewijzigd. Eerst concrete route-/itemmapping aan root, daarna smalle markup/
CSSimplementatie en echte componentvergelijking. Browsercoördinatie: de nieuwe
wizard krijgt eerst zijn browserworker; managementtests pas na nieuwe rootGO.

Root neemt na de definitieve chooserhandoff ook zijn bestaande layoutspecificatie
over voor de nieuwe keuze→wizardroute. Root bezit ook uitsluitend de nieuwe
`sync-create-wizard-data.server.test.ts` voor verse sessierechten, eigen
tenantbronfilters, gepubliceerde templates, LED-verbindingen en gesloten
foutgrenzen van de eigen readloader. Een kaart opent alleen een wizard en
schrijft geen project. Oude v1-keuzejournals hadden geen actoridentiteit: ze
blijven bytegelijk bewaard en worden nooit onder een ander account opnieuw
uitgevoerd. Root mag uitsluitend in de eigen wizardaction een read-only
receiptcontrole toevoegen die de bestaande RLS-beveiligde studio_receipts op
actuele tenant+actor+nonce leest en alleen een geverifieerde interne project-
href teruggeeft. Geen nieuwe SQL, nieuwe legacywriter of nonce. Nieuwe writers
blijven in het actor-/tenant-/familiegebonden wizardjournal. De oude directe
create-replaytest wordt daarom expliciet vervangen door nulwrites bij keuze,
behouden oude opdracht en read-only receiptcontrole; het nieuwe wizardbewijs
toetst echte volledige same-body/nonce-replay na ontbrekend antwoord.

Na de afgeronde wizardfreeze bezit `scenario_audit` uitsluitend aanvullend
`apps/control/app/_components/auth-brand.tsx`,
`apps/control/app/register/page.tsx` en `apps/control/app/onboarding/page.tsx`.
Vervang alleen het oude authlogo door het reeds goedgekeurde byte-identieke
Sourceasset `/assets/full-dark.svg`, natuurlijke ratio887.98:210 en
Sourcebreedte210px. Register en beide onboardingbranches hergebruiken
dezelfde AuthBrand. Geen SVG/assetverandering, reconstructie, filter of
auth-/formulier-/actie-/session-/wachtwoord-/MFA-/herstelwijziging. De echte
beveiligingsflow blijft behouden; Source-democode mag nergens product worden.
Root behoudt de overige auth-/accountchrome als afzonderlijk open vervolg.

Na de managementfreeze bezit `release_audit` uitsluitend aanvullend de
Source-Schermenpresentatie: `dashboard/screens/screen-setup-dialog.tsx`,
`dashboard/screens/new/page.tsx`, `dashboard/screens/[screenId]/page.tsx`,
`dashboard/screens/screens-page.tsx`, `dashboard/screens/sync-fleet-view.tsx`,
nieuwe `sync-screen-detail.tsx`/`sync-screen-detail.module.css` en
`sync-screen-setup.module.css` binnen screens, plus eigen gerichte
`tests/control/sync-screen-source.spec.ts` en eventuele zuivere
`sync-screen-detail.test.ts` in die map. Eerst de werkelijke Sourceopbouw:
platforminstructie vóór koppelcode/schermgegevens, preview naast eerlijke
gezondheid en vijf hoofdtabs. Gebruik uitsluitend bestaande echte
loaders/actions en `syncPlaybackEvidence`: toegewezen is niet in beeld.
Geen demo-VYO482 of gesimuleerde pairing/online/bevestiging, geen nieuw
pairingprotocol, geen writer/SQLwijziging. Behoud bestaande twee fasen,
idempotency, codes, rollen, limieten, invoer, extra resolutie/content en
geavanceerde bediening; breng die binnen de passende hoofdtaak onder.
Oude detailtabdeeplinks inclusief `player` krijgen een compatibele mapping;
content/planning/activiteit verdwijnen niet. Platformfilter gebruikt alleen
werkelijk gerapporteerde FleetDevice.platform. Gebruik scoped lokale CSS,
bestaande immutable previews duidelijk als publicatievoorbeeld en geen
claim van een live screenshot. Inline composition/automation editors zijn
nog geen vrijgegeven schrijfownership; rapporteer de noodzakelijke grens.
Eerst code/statics, browser alleen na rootGO; daadwerkelijke Sourcecapture
en veilige pairing/readback blijven afzonderlijk nodig.

Root draagt de twee afgeronde Studio-hrefs in sources expliciet over aan
`media_db`; die blijven behouden. `media_db` bezit aanvullend uitsluitend
`dashboard/sources/sites-sources-overview.tsx`, `sites-sources-model.ts`,
`sites-sources-data.ts`, nieuw `sync-source-dialogs.tsx`/`.module.css` en
`source-detail-data.server.ts` binnen die map, plus
`dashboard/data-sources/page.tsx`, de bestaande drie Source-model/data/
overviewtests en nieuw `source-detail-data.server.test.ts` en
`tests/control/sync-sources-dialogs.spec.ts`. Realiseer Source540pxcreate
en960pxdetail met Overzicht/Gegevens/Instellingen, daadwerkelijke velden en
bestaande echte bediening binnen de passende tab. Alleen de geselecteerde
tenantbron laden, whitelist veilige leesvelden, providerlabels nooit als
resource-UUID gebruiken en ruwe config/credentials nooit naar client.
Controller blijft over tabs gemount zodat nonce/proof/pending behouden blijven.
Geen fakepauze/autoSync/feedmutatie,17displayfamilies zijn geen datasetrechten.
Onbestaande bediening is expliciet open domeinwerk, geen nagebootste werking.
Bestaande acties/RPC/SQL/Source/globalCSS/assets blijven bytegelijk.
Vóór extra providercomponent-/pagina-extracties eerst exacte pathnamen en
smalle lees-/presentatiegrens aan root rapporteren; pas na vastlegging writes.
Browser uitsluitend rootGO, echte create/readback en Sourcecapture apart.

Na authlogofreeze bezit `scenario_audit` aanvullend uitsluitend de bestaande
`AccountMenu`-presentatie in `app/(shell)/_components/control-shell.tsx`,
`control-theme-switcher.tsx` in die map, nieuw
`sync-account-dialog.module.css` en eigen
`tests/control/sync-account-dialog.spec.ts`. Management en andere shellcontrols
zijn frozen en blijven bytegelijk. Port de Source-profielmodal met eigen kop
Mijn werkplek, profiel/avatar55px en taakgerichte echte links/voorkeuren.
Behoud naam/mail/customrol, persoonlijk `/dashboard/account`, clubinstellingen,
MFA/privacy en veilige signOut/clearTenantScopedLocalData. Werkelijke
theme/system/storage-event/dichtheidvoorkeuren blijven behouden; geen
demorol/reset. Source-modalchrome scoped lokaal,44px/focus/Escape en passende
mobiele flow. Geen globale CSS,authactions,sessionlogica,assets of metadata-
writerwijziging. Root bezit een afzonderlijke daadwerkelijke shellwide
contrastdiagnose; stem selectors af, wijzig geen andere shellcode.
Eerst code/statics; browser alleen rootGO.

De daadwerkelijke1440px AAL2-wizardroute geeft vier aXecontrastfouten in de
gedeelde shell: twee nav-heading labels#94a29f en twee oude sidebar-footerlinks
#a0c3c1 op wit. De eigen modaltests hadden de shell niet bewezen. Root bezit
vóór verdere writes uitsluitend de noodzakelijke kleurenoverride in
`apps/control/app/sync-adapter.css` voor `.nav-heading`, `.vx-side-settings`
en `.vx-website`: bestaande canonieke `--muted`, geen nieuw merk-/Source-
asset of wijziging van immutable sync-source.css. Ruwe echte rode aXe en
oude tabelhashes blijven bewaard; daarna dezelfde volledige routecontrole.

Voor de Source-brontabs krijgt `media_db` vóór writes ook uitsluitend
`dashboard/data-sources/sportlink/page.tsx`,
`sites-sportlink-connection-wizard.tsx` en nieuw
`source-workspace.server.tsx`/`source-data.server.ts` binnen die map;
dezelfde vier namen voor `dashboard/data-sources/led-scores` met
`sites-led-connection-wizard.tsx`; en uitsluitend
`dashboard/integrations/youtube/sites-youtube-workspace.tsx` en `data.ts`.
Bestaande private leesloaders worden zonder writersemantiek naar server-only
extracties verplaatst zodat oude route en nieuwe echte Source-dialogtabs
dezelfde bediening gebruiken. Alleen optionele echte sourceIdfilter in de
YouTubeleesloader; geen configgeheimen of providerlabels als UUID.
Inline presentatiemodus houdt dezelfde controller/nonce/proof/pending gemount
over tabs; geen genest tweede dialoog of dubbele writer. Alle bestaande
geboortedag/policy/mapping/test/delivery/pause/resume/deleteacties behouden,
uitsluitend waar echte rechten/toestand dat toestaan. Actions/RPC/SQL/assets
blijven bytegelijk. Bestaande nonce-in-ref vormt geen duurzaam reloadbewijs;
claim dat niet en registreer een concrete recoverygap afzonderlijk.

Voor de gedeelde server/client-detailprojectie bezit `release_audit` ook
nieuw `dashboard/screens/sync-screen-detail-model.ts`: één zuivere
tabalias/evidenceadapter met de al vrijgegeven gerichte test. De serverroute
importeert zo geen functie uit een clientboundary; geen eigen domeinwriter.

`release_audit` bezit in bestaande
`tests/control/sites-screens-planning-workflows.spec.ts` uitsluitend de zes
WIZARD47–52 setupinteractiegevallen: pas hun stappen aan naar de echte
Sourceintro→code/schermgegevens-flow. Behoud alle finale invoer/preview/
submit/rechten/grensasserties, case-aantallen, deadlines en andere tests.
Leg de oude verwachte drie stappen en de concrete nieuwe interactie vast;
geen skips, ruimere toleranties of vervangen product door mockup.
Alleen de `mode=setup`-fixturebranch in hetzelfde bestand krijgt de echte
`.sync-control.app-shell`-ancestor, sync-source/sync-adapter CSS en originele
asset-GETs; composition/planningfixtures en hun asserties blijven bytegelijk.

De huidige onboarding-DTO verliest device_id terwijl zijn query dat al leest;
een oude Playerheartbeat kon daardoor een herkoppeling voortijdig voltooien.
`release_audit` bezit vóór writes uitsluitend aanvullend
`dashboard/screens/data.ts` voor `ScreenHeartbeat.deviceId` en zijn bestaande
rowmapper plus een gerichte `data.test.ts` in die map. Geen queryscope, grants,
writer of andere DTOwijziging. Onboarding gebruikt uitsluitend heartbeat van
de momenteel gekoppelde echte device-ID; onbekende/voorgaande device toont
geen voltooiing. Eventuele fixturepaduitbreiding eerst rapporteren.

De werkelijke1440x900-route bewijst dat de oorspronkelijke SourceCSS de
Beheertrigger verbergt zodra de acht gewone beheerlinks zichtbaar zijn. De
echte capabilityfilter bevat aanvullende toegestane taken buiten die acht;
die mogen daardoor niet alleen via zoeken bereikbaar worden. Root bezit
uitsluitend aanvullend de triggerclass in `control-shell.tsx` en een lokale
override in `sync-adapter.css`: als toegestane managementitems buiten de
zichtbare secondaryNavigation vallen, blijft de bestaande Beheertrigger
zichtbaar. Geen nieuwe taken, permissies, grid, navigatiecatalogus of Source-
CSS wijzigen. De oorspronkelijke Source900px-onbereikbaarheid wordt als
functionele referentiegrens bewaard; echte compare gebruikt daarnaast de
oorspronkelijke805px-state waar hetzelfde modal wel bereikbaar is.
Root bezit hiervoor ook uitsluitend de bestaande echte-shell-customrolcase
in `tests/control/sync-management-dialog.spec.ts`: toets dezelfde noodzakelijke
Beheertoegang op1440x900, waar de eerder gebruikte800px de CSSfout niet vond.

Na de definitieve Sourcesfreeze neemt root uitsluitend
`sources/sync-source-dialogs.tsx`/`.module.css`, `sites-sources-model.ts`,
`source-detail-data.server.ts`/`.test.ts` en
`tests/control/sync-sources-dialogs.spec.ts` over voor de concrete fouten uit
de echte RSSvergelijking. De oorspronkelijke Adminmodal erft26pxh2,18pxstackgap
en accent-soft metricicons; de port gebruikte ten onrechte de19pxalgemene
modalregels en afwijkende kleuren/spacing. Herstel alleen die gemeten Source-
regels lokaal, met14pxprimaire body/44pxcanon behouden. Een mislukte bron moet
ook in Overzicht een zichtbare fout-/cachewaarschuwing met herstelactie tonen,
niet alleen een generieke informatietekst. Geef uitsluitend bestaande veilige
foutcopy door, geen rawconfig/providererror. Geen controller/action/RPC/SQL-
wijziging. Oude ruwe PNG's en oorspronkelijke mislukte harnasrapporten blijven
behouden; daarna dezelfde echte routes opnieuw vastleggen.
