# S300 · Wedstrijddag

Deze optionele werkplek staat los van de bestaande automatische **Onze wedstrijddag**-slide. Vandaag en Planning tonen de ingang alleen als de geautoriseerde kleine availability-read die vrijgeeft. De eerste pilotbediening gebruikt `/dashboard/matchday` in de bestaande mobiele webshell. Geen klantplanning of productiebron is voor de ontwikkeling gewijzigd.

## Configureren en bedienen

Een concept bewaart exacte bron-, verbinding-, team-, competitie-, poule-, seizoen- en fase-identiteiten en expliciet gekozen wedstrijden. De hoofdwedstrijd moet exact bij de hoofdcontext horen. Andere bewust gekozen parkwedstrijden mogen een ander team of andere poule hebben binnen dezelfde clubverbinding. Een canoniek opgelost leeg seizoen blijft leeg; er wordt geen jaartal verzonnen. Twee wedstrijden met dezelfde teams en aftrap worden in keuzes door hun officiële wedstrijdcode onderscheiden.

Publiceren bevriest de gekozen releaseversies en fysieke doelen voor Entree, Clubmuur, Kantine en LED. Nieuwe groepsleden en playlistversies worden niet vanzelf opgenomen. Overlap, actuele winnaar, herstelplanning, ontbrekende fallback en ontbrekende Playerondersteuning worden in preflight per doel getoond. De bestaande resolver blijft leidend. Publicatievoorbeelden zijn expliciet bevroren voorbeelden, geen live screenshots.

Bediening vraagt een expliciete wedstrijd/productplaatsing, doelen, reden en exclusieve eindtijd. Een globale hoofdwedstrijdactie vraagt expliciet alle bevroren doelen en een volledige bevoegdheid; de UI selecteert ze nooit zelf. Veldmeldingen en andere wedstrijden kunnen op een toegestane subset werken. Een delegatie bevat uitsluitend het betreffende draaiboek, object, soort actie, doelen en eindtijd. De gedelegeerde leesprojectie toont alleen toegewezen wedstrijden, doelen en bewijs. Catalogus, prijs, Twelve-import en providerrecords worden niet beschreven.

Alle mutaties zijn gebonden aan de oorspronkelijke `tenantId:userId`, de exacte object-ID's en dezelfde verzoeknonce bij antwoordverlies. Ontvangstbewijzen worden op verzoek, draaiboek, publicatie en actie vergeleken. Operationele publicatie-CAS gebruikt `objectRevisions[publication:<id>]`; het immutable publicatieversienummer blijft apart.

## Tijdelijk Playercontract

`matchday-expiry-v1` is opt-in. De geautoriseerde manifestbootstrap bevat het actuele tijdelijke venster en twee afzonderlijke gewone uitkomsten: **NU (A)** en **EINDE (B)**. Een ouder profiel krijgt vóór ETag/304 uitsluitend de gewone uitkomst van NU. Het krijgt nooit de toekomstige uitkomst vroeg. LG/legacy adverteert deze nieuwe capability niet en wordt bij preflight voor tijdelijke S300-doelen geblokkeerd. Bestaande publicaties en TTL-doelpunten blijven hun eigen contract volgen.

Een moderne Player ontvangt volledige tijdelijke, NU- en EINDE-envelopes voor hetzelfde device, scherm en tenant, met alle compositiezones en assets. Hij verifieert alle drie en beschermt die assetsets tegen garbage collection. Nieuwe requests hebben een unieke nonce. De serverobservatie bepaalt een conservatieve monotone deadline vanaf de start van de aanvraag; transporttijd wordt afgetrokken. Een herhaalde response kan de deadline niet verlengen. Een verlopen venster kan niet door een oude response herleven. Observatietijden, nonces en signed URLs veranderen de contentidentiteit niet.

Tijdens de tijdelijke vertoning bevat de bestaande permanente active/previous-cache uitsluitend de volledig geverifieerde gewone NU-release A. Tijdelijke releases worden daarin nooit opgeslagen. Een koude offline start of een ouder cachedecoderpad gebruikt daarom A en geen tijdelijke of toekomstige B-release. Alleen een verse geautoriseerde online response kan weer een tijdelijk venster activeren. Deze keuze behoudt de bestaande offline-LKG-semantiek bij een onbekende of teruggedraaide systeemklok.

Bij werkelijk verval wordt de reeds geverifieerde EINDE-release B op de bestaande natuurlijke item-/paginagrens geactiveerd; gezonde onafhankelijke zones leveren hun eigen grens. Een tijdelijk frame dat nog nooit zichtbaar was mag na zijn deadline niet voor het eerst verschijnen. Het herstel wacht dan niet op een ontbrekende hoofditemtimer. Een vroeg afgevuurde browser-timeout wordt voor de resterende fractie opnieuw gezet. Bij corrupte EINDE-assets wordt achtereenvolgens de gewone actieve en de vorige volledige LKG geverifieerd. Historische lokale inhoud is geen bewijs dat de actuele serverplanning al is hervat.

De server archiveert maximaal acht verschillende immutable herstelidentiteiten per uitgegeven venster. De manifestlaag registreert het aanbod pas na volledige envelope-opbouw en de laatste targetcontrole. Duplicaten tellen niet opnieuw; datachecks en observatietijden maken geen nieuwe immutable identiteit. Een negende nieuwe identiteit blokkeert alleen het nieuwe tijdelijke aanbod met een herstelbare fout. Het bestaande LKG en gewone manifestverkeer blijven beschikbaar.

## Frame- en herstelbewijs

Een ontvangen of voorbereide opdracht wordt nooit als weergegeven aangemerkt. Windowbewijs koppelt publicatie, doel, window-ID, hash, release en de werkelijke first-frame-tijd aan de uitgegeven identiteit. Compositiebeelden vereisen afzonderlijk bevestigde zones en de exacte compositie-ID, revisie en serverhash. Een onbekende historische compositiehash blijft onbevestigd.

Veld-, uitstel- en afgelastmeldingen komen uit de nieuwe device-RPC, met exact device/scherm/publicatie/doel, objectrevisie en monotone vervaltijd. Het scherm toont uitsluitend de uitgegeven teams en tijdelijke melding. De zichtbare kaart meldt haar eigen ontvangen/voorbereid/weergegeven/hersteld-fase. Werkelijke layout, twee animation frames, zichtbaarheid en occlusie worden gecontroleerd. Goal Overlay en fullscreen sponsors behouden hun voorrang. Een geldige lege respons verwijdert de zichtbare set; een technische fout bewaart geldige meldingen tot hun eigen eindgrens. Correcties hebben hun eigen immutable delivery-ID en oudere objectrevisies worden geweigerd.

ACK's behouden bij netwerkfouten, 429 en tijdelijke serverfouten dezelfde nonce en tijd. De herhaalroute blijft na terugkeer naar een gewone publicatie actief. Permanente 4xx-afwijzingen worden niet eindeloos opnieuw verzonden en leveren geen bevestigingsclaim op. Na een koude start worden tijdelijke overlaymeldingen niet uit een cache hersteld.

## Grenzen en koppelingen

- De Playerproeven gebruiken het echte gebouwde webplayerpad, echt geverifieerde lokale assets, CacheStorage/IndexedDB en echte zichtbare frames, met gecontroleerde geautoriseerde origin-responses. Het browser-LG-pad controleert de oude gewone cache; het ondersteunt geen tijdelijke S300-vensters.
- Chromium-browserbewijs is geen fysiek Android-, LG- of LED-hardwarebewijs. De 1280×320-output is een browserviewport. Voor de feitelijke pilot zijn een ter plaatse gecontroleerd ondersteund Playerprofiel en leesbaar ingestelde marges vereist.
- SQL/RLS en werkelijke RPC→UI-capture worden afzonderlijk geregistreerd. Een HTTP- of componentfixture is geen productie-frameclaim.
- S298 levert de bestaande planningpreview en kandidaatvolgorde; S301 levert de draft-only seizoensadapter. Die onderdelen moeten geïntegreerd zijn vóór de feature wordt ingeschakeld. De nieuwe werkplek blijft standaard uit.
- Een reeds gepubliceerde klantplaylist, catalogus of bronconfiguratie is niet als fixture gewijzigd. De normale staging-/releasegates en integratiereview blijven verplicht.

De exacte uitgevoerde gates, case-ID's, buildbinding en geselecteerde frames staan in de bijbehorende bewijsindexen. Mislukte tussentijdse proeven worden apart bewaard en niet als eindbewijs gebruikt.

## Gecontroleerde runtimecorrecties

Twee echte regressies zijn met rood/groenbewijs opgelost. De globale `100vw`-breedte van gewone media liet afbeeldingen en video binnen een smallere compositiezone buiten hun canvas vallen. Alleen bestaande compositiewrappers begrenzen die media nu op de eigen breedte; de fullscreenregel, object-fit en bronbestanden blijven gelijk. Dezelfde SVG-bytes, decoded video en beide oriëntaties worden op werkelijke bounds gecontroleerd.

Daarnaast kon na een geslaagde conditionele manifestcontrole een latere heartbeat-transportfout de compacte offlinestatus wijzigen terwijl de afspeelstatus `PLAYING/online` bleef. De runtime gebruikt nu hetzelfde geverifieerde origin-event voor de offline-afleiding, ook wanneer eerdere assetvoorbereiding later afrondt. Een browserhint of positief event alleen bewijst geen actuele publicatie; herstel blijft aan de bestaande manifestcontrole gekoppeld. De correctie herstart geen afspeelbeurt.

Het definitieve Playerbeeldbewijs staat in [player-runtime-evidence.json](player-evidence/player-runtime-evidence.json), met bronhashes en build-ID. De tien tijdelijke-publicatiegevallen zijn op het gebouwde Playerpad geslaagd. De zes originstatusgevallen zijn elk drie keer geslaagd. De volledige bestaande Player/browsergate wordt hiermee niet geclaimd; de aanvullende scopes en integratiegates worden in de eindvalidatie apart vastgelegd.

## Lokale validatie en buildbinding

De functionele bron en de S296/S297/S298/S299/S301-afhankelijkheden zijn geïntegreerd. Op de eigen S300-bron slaagden alle754 Playerunits,2080 Controlunits (34 bestaande skips),214 contracttests en85 domaintests. De volledige workspace-lint en -typecheck waren30/30 groen; de volledige testgate slaagde30/30 met seriële pakketuitvoering, zonder wijziging van assertions of individuele testdeadlines. De eerdere parallelle poging en scheduling-timeouts blijven in de logs bewaard. De geïntegreerde herhaling en normale CI blijven afzonderlijke verplichte gates.

De oorspronkelijke geïsoleerde databasegate omvat218 verse migraties en154 bestanden/5.306 assertions, met nul lint-/security-/prestatieadviseursfouten. [Het databasebewijs](../../s300-matchday-database.md) bindt de betreffende migratie en logs. [Het Controlbewijs](control-evidence/README.md) registreert32 unieke componentgevallen met echte genormaliseerde RPC-uitvoer en320/1440px. De eigen device-API heeft57 gerichte units. De latere integratiereview corrigeert uitsluitend Controlbevestigingsmetadata: een herstelde release krijgt haar eigen bevestigingstijd. Die nieuwe DTO-/SQL-/Controlbron en bijbehorende herhalingen hebben hun eigen eindgate; de oorspronkelijke hashes worden daarmee geen bewijs voor de gewijzigde bron.

De definitieve lokale Playerscopes sluiten **110 unieke gevallen met110 PASS en0 open**, verspreid over expliciet geïndexeerde runs:

| Scope | Laatste unieke uitkomst | Buildbinding |
| --- | --- | --- |
| Bestaande bron-, compositie- en Goal-gevallen |73 PASS |70 op `afx4WTMdRokUAATS7ARkh`, drie exacte herhalingen op `Z_tgM-l9qx8rCVRUmtFrT` |
| Nieuwe tijdelijke publicatie, frame, herstel en geometrie |10 PASS |`Z_tgM-l9qx8rCVRUmtFrT` |
| Gecontroleerde originstatus |6 unieke gevallen, elk driemaal PASS |`Z_tgM-l9qx8rCVRUmtFrT` |
| Player-toegankelijkheid |11 PASS |`Z_tgM-l9qx8rCVRUmtFrT` |
| Expliciete offlinegevallen |10 PASS |negen in de batch, één exacte herhaling op `Z_tgM-l9qx8rCVRUmtFrT` |

De geïntegreerde build gebruikt commit `67e369ee39977bdcc86b9ece0a18f904d7308354` en bevat ook de geërfde LG-pageshowcorrectie. De drie oorspronkelijke fouten in de73-batch blijven bewaard; alle drie dezelfde gevallen slaagden op deze build. Eén toegankelijkheids-/offlinebatchgeval crashte tijdens `browser.newContext`, vóór de testinhoud, met Chromium-SIGSEGV en `inotify_init EMFILE`. Het exacte ongewijzigde geval slaagde daarna in1,2s. De index behoudt alle155 uitvoeringen:151 PASS en vier historische fouten. Deze110-case-unie is geen claim dat één volledige Playergate zonder fouten is uitgevoerd.

De nieuwe18 frame-/correlatiebestanden staan onder [integrated-67e369ee](player-evidence/integrated-67e369ee/expiry-frame-evidence.json): tien visueel gecontroleerde PNG’s en acht JSON-bestanden met verzoek-, frame-, cache-, geometrie- en ACK-koppelingen. Beide oriëntaties tonen de volledige hoofd-, zij- en voettekst binnen hun echte compositierechthoeken. Het videogeval meet432×648px voor zowel media als zijzone; de fullscreenafbeelding behoudt1280px breedte. De eerdere beelden en hashes blijven intact.

De Player- en browsertestbestanden zijn bytegelijk aan de opgegeven67e-build. De daaropvolgende optionele `confirmedAt`-contractuitbreiding en Control-/SQL-correctie zitten niet in dat historische artefact; er is geen Playergedragswijziging aan ontleend. De normale CI moet de exacte uiteindelijke bron opnieuw bouwen. Hosted staging-/productieacceptatie en fysieke Android-, LG- of LED-controle worden hiermee niet geclaimd.

## Laatste onafhankelijke broncontrole

Herstelversie en bevestigingstijd gebruiken nu hetzelfde daadwerkelijke Playerbewijs (`confirmedAt`); de eerdere tijdelijke frametijd blijft historisch beschikbaar. Twee nieuwe SQL-tegenproeven rood op de vorige definitie, daarna154focus en154bestanden/5308asserties groen. Alle372SQL-bestanden zijn bytegelijk aan de verse testassembly. De definitieve18RPC-payloads en twee aanvullende herstelprojecties valideren strikt; alle36werkplekbrowsergevallen slagen op de nieuwe capture.

Normale CI vond bovendien een uitsluitend type-import uit een server-only service. Het resultaatcontract staat nu in een clientveilige pure typemodule; bestaande acties, typenexports en rechten blijven behouden. De oorspronkelijke veiligheidscontrole bleef ongewijzigd en slaagt rechtstreeks3/3. De eerdere Turbocache was voor deze repositorybrede Configcontrole onvoldoende; de finale lint/typecheck/test zijn daarom volledig opnieuw uitgevoerd met `--force`: elk30/30,0cachehits (22,641/21,428/86,159s). Zie [het finale controlebewijs](integration/final-confirmation-evidence.json). Nieuwe exacte CI/build en hosted acceptatie blijven de uitrolgrens.
