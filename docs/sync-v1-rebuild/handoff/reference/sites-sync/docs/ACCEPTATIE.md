# VeyoCast V1 Sync — acceptatiecontract

Datum: 17 oktober 2026. De 148 scenario’s uit `src/coverage.json` zijn hieronder vastgelegd. Dit document beschrijft **wat gecontroleerd moet worden**. Het zegt niet dat alle scenario’s uitgevoerd of geslaagd zijn. Uitgevoerde controles en beperkingen staan in `TESTRESULTATEN.md`.

## 1. Bewijsniveaus

| Niveau | Wat dit aantoont | Wat dit niet aantoont |
|---|---|---|
| Bouw / typecontrole | Bron is bouwbaar binnen de vastgelegde dependencyversies | Correct uiterlijk, browsergedrag of backendwerking |
| Component / DOM | Een concreet rendering- of interactiepad reageert volgens de assertion | Echte layout, native runtime, provider of serverisolatie |
| Browserreview | Echte pagina-/interactieweergave op vastgelegde browser en viewport | Werking op andere hardware of een echte provider |
| Server / contract | Auth, capabilities, data, jobs en transacties volgen het domeincontract | Fysiek zichtbaar afspelen |
| Device / provider | Geteste hardware-/firmware-/accountcombinatie voert de echte keten uit | Automatisch alle modellen, accounts of datarechten |
| Gebruikersacceptatie | Opdrachtgever keurt beschreven UI en werkvolgorde goed | Technische of operationele productiecertificering |

Elke testregistratie noemt scenario-ID, build/commit, omgeving, datum, rol/tenant, preconditie, stappen, verwacht/werkelijk resultaat en bewijs. Gebruik status `niet getest`, `geslaagd`, `mislukt`, `geblokkeerd` of `afwijking expliciet geaccepteerd`. Bewaar blokkade en vervolgstap. Een vinkje in de lokale V1-verkenner exporteert een reviewstatus; maak daar niet automatisch een geslaagd productietestresultaat van.

## 2. Kernjourneys voor staging

| ID | Opstelling en stappen | Te bewijzen resultaat |
|---|---|---|
| J01 | Maak in Studio een ontwerp; bewerk tekst, kleur en bron; bewaar, herlaad en voeg toe aan playlist | Opgeslagen inhoud en preview zijn gelijk; bronbinding blijft behouden; geen verloren invoer |
| J02 | Publiceer playlist naar twee schermen; laat één online en één offline; herstel daarna het offline scherm | Online, desired en confirmed zijn onafhankelijk; oud actief beeld blijft; beide bevestigen pas na echte activatie |
| J03 | Laat een kandidaatdownload mislukken of hashverificatie falen; retry | Bestaande actieve release speelt door; retry is idempotent; geen cache-/pairingverlies |
| J04 | Zet netwerk uit met goede cache, herstart player; herhaal zonder cache | Eerst goede offline-uitvoer; zonder cache eerlijke herstelbare wachtstate; geen fictieve groene status |
| J05 | Wijzig een menuprijs; controleer oude publicatie; bekijk diff; publiceer prijsupdate | Geen ongevraagde wijziging op TV; oude release blijft onveranderd; nieuw prijsmanifest pas actief na bevestiging |
| J06 | Wissel thema op één plaatsing, op playlist en op een nieuw themapakket | Voorrang uitlegbaar; andere plaatsingen/ontwerpen en actieve releases blijven intact |
| J07 | Plan overlappende herhalingen en een tijdelijke override in Europe/Amsterdam; laat aflopen | Winnaar en reden zichtbaar; juiste concrete occurrences; hoofdzone terug naar default; andere zones correct |
| J08 | Publiceer drie-zonecompositie met één ontbrekende asset | Geen halve activatie; vorige compositie blijft; herstel activeert alle vereiste zones samen |
| J09 | Claim pairingcode; probeer verlopen, verkeerde tenant en reeds geclaimde code | Server weigert ongeldige claims; geldige claim maakt één devicebinding; opnieuw laden dupliceert niet |
| J10 | Voer force-sync, reload en expliciete unlink uit | Commands hebben ontvangst/uitvoering/TTL; sync/reload behouden identiteit; unlink vermeldt impact |
| J11 | Importeer Twelve-export met Nederlandse decimalen, dubbele IDs en ongeldige prijs; importeer update | Mapping/rijerrors zichtbaar; foute commit geblokkeerd of bewust overgeslagen; dezelfde externe ID wordt bijgewerkt |
| J12 | Selecteer Sportlink team/seizoen/poule; test alle 17 families met beschikbaar, leeg, denied en stale | Correcte scope; geen stille verbreding; provider-/handmatige beschikbaarheid eerlijk gelabeld |
| J13 | Doorloop zes RSS-artikelen, lange tabellen en volledig menu in 16:9/9:16 | Alle pagina’s zichtbaar; QR hoort bij huidig artikel; lange namen/prijzen blijven leesbaar |
| J14 | Trigger dubbele, verse en verlopen LED-goals tijdens een item | Alleen verse unieke event onderbreekt; resterende itemtijd hervat; profiel/flag gerespecteerd |
| J15 | Speel online YouTube; verbreek netwerk/provider; herstel | Toegestane playback/fallback; geen claim van offline YouTube-download; geen vast zwart scherm |
| J16 | Sponsorconcept → indienen → goedkeuren → publiceren; bekijk rotatie en event | Rechten, looptijd, gewicht en vaste planversie kloppen; events technisch en idempotent |
| J17 | Poll plannen/starten, QR openen, geldig/ongeldig/dubbel stemmen, sluiten en archiveren | Server handhaaft lifecycle, token/tenant, limieten en resultaatbeleid; na sluiten geen nieuwe stem |
| J18 | Viewer/Editor/Support/custom role voert normale én rechtstreekse API-acties uit; wissel tenant | Rechten gelden op server; directe ID-toegang lekt niets; platformrol geen impliciete tenantrol |
| J19 | Ticket met bijlage, onderwerp en prioriteit aanmaken; routeren; antwoorden; sluiten/heropenen | Bevoegde werkvoorraad, correcte bijlagenrechten, historie en status; geen inhoud voor onbevoegde tenant |
| J20 | Zet billingflags afzonderlijk; simuleer/voer testbetaling, verified webhook en mismatch uit | Geen incasso/restrictie door verkeerde flag of clientredirect; reconciliation en override aantoonbaar |
| J21 | Mobiele camera-/bestandselectie → bewerken → playlist → publiceren; paneel sluiten/heropenen | Geen invoerverlies of verborgen primaire actie; dezelfde serverrechten/data; echte biometrie via OS |
| J22 | Open iedere publieke route rechtstreeks, zonder JS en op mobiel; doe ongeldige/geldige aanvraag | Unieke content/metadata, werkende navigatie, 404; productieaanvraag duurzaam en status eerlijk |
| J23 | Update bestaande Androidinstallatie met bewaarde pairing/cache; herstart; test recovery | Package/signingpad en identiteit behouden volgens bestaand contract; update niet onbedoeld nieuw device |
| J24 | LG-model/firmware uit supportmatrix: boot, sync, media, offline, zones en herstel | Compatibele bundle, fonts/video/caching en veilige activatie fysiek bevestigd; afwijkingen per profiel |

## 3. Visuele acceptatie

Vergelijk minimaal desktop 1440 × 900, tablet 1024 × 768 en mobiel 390 × 844. Controleer daarnaast een smalle mobiele breedte van 360 px en zoomen/tekstvergroting. Leg de gebruikte browser vast. De playeroutput wordt apart op 1920 × 1080 en 1080 × 1920 bekeken; dat zijn uitvoerformaten, geen bewijs van hardwarecompatibiliteit.

Te beoordelen schermen: publieke home en minimaal één oplossing/detail/formulier, overzicht, contentbibliotheek, Studio met beide thema’s, lange menu-/sporttabel, playlisteditor en publicatie, planningconflict, schermdetail, drie-zonepreview, sponsors, Engage, team, support, platform, billinggate, mobiele beheerflow en alle player-splashstates. Bekijk loading, empty, denied en herstelbare fout waar relevant.

Accepteer geen afgesneden logo, overlappende knoppen, verborgen formuliervelden, lege onbedoelde schermvlakken, horizontale documentoverflow of niet-leesbare portraitslide. Tabellen mogen een duidelijke lokale scrollcontainer hebben. Motion mag niet verspringen bij route-/modalwissel; reduced motion blijft volledig bruikbaar. Test focus, tabvolgorde, Enter/Escape en herstel van focus na sluiten van een modal.

## 4. Nog afzonderlijk te bewijzen vóór productie

Deze onderwerpen zijn acceptatiegates, geen uitspraken over de huidige teststatus:

- Servertenantisolatie, platform-/tenantcapabilities, sessie/MFA, download- en bijlagenrechten, publiek stemmen en abusebescherming.
- Werkelijke Sportlinkaccounts/datasetrechten, Twelve-importbestanden, RSS-feedvarianten, LED-eventbron en YouTube-profielbeperkingen.
- Fysieke Android/LG/Web-profielen: echte videodecode, cache, offline koude start, onderbroken update, powerfuncties en zichtbaar-bevestigdprotocol.
- Media-/renderworkers met fouten/retries, objectopslag, hashverificatie en herstel na worker-/serverrestart.
- Betalingsprovider: first payment, readback, mandate, recurring, geverifieerde webhooks, dubbele/out-of-order events, chargeback en reconciliation. Rolloutflags blijven afzonderlijk beheerd.
- Publieke serveraanvraag, beheerdersinbox, mailbezorging/retry, productiecontact-/privacy-informatie en werkelijk domein/canonical.
- Bestaande data en devices migreren zonder reset; backward-compatible manifesten waar vereist; rollback behoudt identiteit en laatst goede publicaties.

## 5. Volledige scenariomatrix

De onderstaande omschrijvingen zijn uit `src/coverage.json` overgenomen. Gebruik het stabiele ID in testnamen, issues en reviewexports. Start iedere uitvoering met een eigen statusregistratie; de aanwezigheid van een rij betekent geen geslaagde test.

### Ervaring en toegang

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| experience.parity | Eén definitieve Sync-werkplek | Alle V1-routes zijn vanuit één vaste navigatie bereikbaar. De andere vier ontwerprichtingen zijn vervallen. |
| experience.mock_state | Werkend prototype met bewaarde demo-invoer | Opslaan, wijzigen en publiceren veranderen gedeelde mockdata en blijven na navigeren/herladen bestaan; reset herstelt de demo. |
| experience.auth | Inloggen en sessie | Demo-login opent een rolgebonden sessie; uitloggen en opnieuw inloggen zijn klikbaar zonder echte credentials. |
| experience.tenant | Organisatie en platformcontext wisselen | Tenantwissel verandert data en branding; platform is een afzonderlijke context zonder vermenging van clubnavigatie. |
| experience.permissions | Rollen en MFA zichtbaar doorlopen | Kies owner/editor/viewer/support; verboden acties zijn geblokkeerd en toegelicht; gevoelige acties tonen een gesimuleerde MFA-stap. |
| experience.states | Volledige laad-, leeg-, fout- en successtates | Belangrijke lijsten/forms demonstreren loading/empty/error/permission/success met werkende herstelactie en behouden invoer. |

### Overzicht

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| overview.attention | Aandacht en herstelacties | Klik op bron-, upload- of schermprobleem voor oorzaak/gevolg; passende actie verandert de status en audit. |
| overview.screens | Wat speelt waar | Scherm toont juiste bevestigde playlistpreview, gewenste versie, laatste contact en bronversheid; oude actieve release blijft vindbaar. |
| overview.status | Bereikbaar, gesynchroniseerd en zichtbaar apart | Online/offline/onbekend, downloadstatus en actief bevestigd zijn afzonderlijk; een online maar vastgelopen scherm is reproduceerbaar. |
| overview.today | Vandaag gepland en snelle acties | Open komende/plande items en start content/upload/pairing/publicatie vanuit het overzicht. |
| overview.preview | Eerlijke inhoudspreview | Klikbare preview gebruikt bevestigde publicatie en tijdstip; geen stockfoto of claim van een live screenshot. |

### Content en media

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| content.library | Eén zoekbare bibliotheek | Media, vrije ontwerpen, menu, alle dynamische families en reeksen delen zoeken/filteren; telling en resultaatverzameling kloppen. |
| content.upload | Beeld- en videoupload | Selecteer lokaal bestand of demo-upload; toon queue, thumbnail, formaat, voortgang en klaarstatus. |
| content.upload_recovery | Upload pauzeren, hervatten en herstellen | Simuleer onderbreking/fout; hervatten of retry werkt zonder dubbel media-item. |
| content.processing | Verwerking en opnieuw verwerken | Toon pending/verwerken/gereed/mislukt met oorzaak; retry verwerkt hetzelfde item tot gereed. |
| content.inspector | Metadata en gebruiksimpact | Inspector bewerkt titel en toont type, maten, duur, gebruikte playlists en betrokken schermen. |
| content.archive | Archiveren, herstellen en veilig verwijderen | Impactdialoog noemt verwijzingen; actief gebruikte media kan niet onveilig definitief weg, archiveren/herstellen verandert de lijst. |

### Studio

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| studio.create | Vrij ontwerp of template maken | Templatekeuze of leeg canvas creëert een bewerkbaar ontwerp met titel, inhoudstype en bronbinding. |
| studio.content | Tekst, beeld en clubbranding bewerken | Tekst/beelden/logo kiezen verandert canvas direct en is na bewaren/heropenen gelijk. |
| studio.design | Zichtbare ontwerpinstellingen werken | Accent, tekstschaal, uitlijning, veilige marge, achtergrond en ondersteunde motion veranderen de preview; onondersteunde opties ontbreken. |
| studio.orientation | 16:9 en 9:16 | Wissel landscape/portrait; canvas schaalt proportioneel zonder afgesneden inhoud. |
| studio.series | Reeksen samenstellen | Slides toevoegen, herordenen, dupliceren en verwijderen; reeks kan als selectie aan playlist worden toegevoegd. |
| studio.revisions | Bewaren, heropenen en revisieconflict | Autosave/opslaan, ongedaan/opnieuw waar ondersteund, heropenen en conflict met tweede editor zijn betekenisvol gesimuleerd. |
| studio.output | Preview en uitvoer gereedmaken | Preview speelt alle pagina’s; render/genereren toont voortgang, fout/herstel en gereed resultaat in bibliotheek. |
| studio.version | Ontwerpversies en gebruik | Nieuwe versie laat gepubliceerde plaatsingen intact; gebruiker bekijkt wijzigingen en kiest waar die worden bijgewerkt. |

### Playlists

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| playlist.crud | Playlists maken, bewerken, dupliceren en archiveren | Maak/zoek/open/dupliceer/hernoem een playlist; lege en gebruikte playlist hebben correcte acties en impact. |
| playlist.add | Gemengde inhoud toevoegen | Media, Studio/reeks, Sportlink/menu/RSS, YouTube en Engage zijn selecteerbaar en worden echte playlistitems. |
| playlist.order | Volgorde en secties | Drag of verplaatsknoppen, secties, kopiëren en verwijderen wijzigen de loop en overleven heropenen. |
| playlist.duration | Duur en bulkduur | Wijzig losse of geselecteerde duren; totaaltijd past mee en video-/pagingminima worden uitgelegd. |
| playlist.presentation | Crop, fit en veilige presentatie | Iteminstellingen tonen crop/focus, vullen/passend en achtergrond; wijziging raakt alleen deze plaatsing. |
| playlist.av | Trim, geluid en zichtbaarheid | Video start/einde, mute/volume en itemzichtbaarheid werken in preview; apparaatbeperkingen zijn duidelijk. |
| playlist.theme | Thema per plaatsing, playlist en bulk | Themaselectie verandert geselecteerde plaatsingen; gedeelde bronontwerpen en andere playlists veranderen niet ongemerkt. |
| playlist.preview | Volledige afspeelpreview | Play/pause/next/back en paginateller doorlopen exact de volgorde, inhoud, duur en thema’s; terug naar item bewerken. |

### Publiceren

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| publish.preflight | Gereedheid en apparaatcompatibiliteit | Checklist toont ontbrekende media/brondata/themaprofiel/opslag; blokkade kan worden opgelost en opnieuw gecontroleerd. |
| publish.target | Doelen en moment kiezen | Selecteer schermen/groepen en nu/later; samenvatting noemt playlist, versie, targets en planningimpact. |
| publish.progress | Publicatie en bevestiging per scherm | Doorloop concept/gecontroleerd/gepubliceerd/ophalen/verifiëren/wachten/actief; schermen kunnen afzonderlijk achterlopen. |
| publish.history | Historie en verschillen | Open immutable versiehistorie vanuit playlist/scherm en vergelijk inhoud of instellingen met huidige versie. |
| publish.restore | Herstellen en opnieuw toewijzen | Herstel oude versie naar nieuw concept of wijs publicatie opnieuw toe; bestaande historische versie blijft intact. |
| publish.safe_failure | Fout of onvolledige kandidaat | Download-, verificatie- of stale-targetfout houdt actieve publicatie zichtbaar; retry herstelt zonder cache/pairingverlies. |

### Planning

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| planning.calendar | Agenda en planning beheren | Dag/weekkalender met filters; afspraak maken/openen/verplaatsen/bewerken/uitschakelen/verwijderen verandert de planning. |
| planning.repeat | Eenmalig, dagelijks, wekelijks of aangepaste herhaling | Begin/einde, dagen en tijdvensters zijn bewerkbaar; preview toont concrete komende uitvoeringen. |
| planning.targets | Scherm, groep of alle schermen | Doelkeuze werkt en overzicht noemt alle betrokken schermen en playlist. |
| planning.conflict | Prioriteit en overlap oplossen | Overlappende regels tonen winnaar, oorzaak en alternatieven; expliciete oplossing wordt bewaard. |
| planning.timezone | Tijdzone, overrides en defaultterugval | Tenanttijdzone en DST-demo zijn zichtbaar; tijdelijke override loopt af; hoofdzone keert terug naar standaard terwijl zij-/onderzone behouden blijven. |

### Schermen en apparaten

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| screens.inventory | Schermlijst en detail | Zoek/filter op platform, locatie/groep en status; detail toont active/desired, opslag, runtime en gebeurtenissen. |
| screens.pair | Scherm koppelen met code/QR | Nieuwe Player toont code; beheer claimt deze en koppelt tenant/scherm; ongeldige of verlopen code is herstelbaar. |
| screens.lifecycle | Naam, locatie en device-lifecycle | Hernoemen, deactiveren, logisch verwijderen en opnieuw koppelen hebben impactdialoog en correcte status. |
| screens.groups | Schermgroepen beheren | Groep maken/hernoemen en lidmaatschap wijzigen werkt door in publicatiedoelen en planning. |
| screens.remote | Begrensde herstelopdrachten | Force-sync, herladen en pairingherstel tonen verstuurd/ontvangen/uitgevoerd of verlopen; normale sync behoudt identiteit/cache. |
| screens.diagnostics | Diagnostics en supportinformatie | Toon foutoorzaak, eventtijd, platformprofiel en hersteladvies; supportbundel/downloadactie geeft bruikbaar demoresultaat. |
| screens.hardware | Apparaatprofielen en beperkingen | Web/PWA, Android/TV en specifiek LG-profiel tonen ondersteunde media/motion/power/audio en nog te bevestigen hardwarebewijs. |

### Bedrijfstijden en schermindeling

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| automation.week | Weekvensters en tijdzone | Bewerk open-/speeltijden per dag met juiste tenanttijdzone; actieve toestand en volgende overgang veranderen. |
| automation.exceptions | Datumuitzonderingen | Voeg gesloten dag of afwijkend openvenster toe; planningvoorvertoning laat effect zien. |
| automation.override | Tijdelijk aan/uit en expiry | Override bevat eindtijd; commandostatus en automatische terugval zijn zichtbaar. |
| automation.power | Power, sleep, wake en autostart | Alleen ondersteund apparaatprofiel biedt deze opties; LG/Android/web tonen eerlijke verschillen en gesimuleerde bevestiging. |
| composition.layout | Vier vaste indelingen | Full/sidebar/bottom/three met landscape/portrait en begrensde percentages zijn zichtbaar te configureren. |
| composition.binding | Playlist per contentzone | Hoofd-/zij-/onderzone kiezen elk playlist en fallback; geluid alleen hoofdzone; LED/sponsor schermbreed. |
| composition.publish | Compositie publiceren en offline herstarten | Preview toont alle zones; nieuwe compositie activeert pas compleet; simuleer ontbrekende zone zonder huidige output te verliezen. |
| venues.map | Locaties, plattegrond en fysieke zones | Locatie/plattegrond/zone maken of kiezen en scherm plaatsen; onderscheid fysieke zones en contentzones helder. |
| venues.inspect | Scherm op locatie openen | Klik schermpin voor detail/status, verplaats pin en bewaar positie. |

### Bronnen algemeen

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| sources.catalog | Bronnenoverzicht en koppelen | Sportlink, Twelve-import, RSS, LED Scores en YouTube hebben eigen detail/configuratie zonder dubbele contentbibliotheek. |
| sources.health | Sync, versheid en herstel | Laatste poging/succes, nieuwe data, lege feed, ontbrekend recht en fout zijn apart; testverbinding/sync/retry wijzigt mockstatus. |
| sources.binding | Bronbinding gescheiden van stijl | Datasets/teams/poule/feed/producten veranderen inhoud; themawissel behoudt binding en selectie. |
| sources.live | Live data los van publicatie | Nieuwe mockdata verschijnt in bestaande gepubliceerde selectie; identieke sync creëert geen extra release; fout behoudt laatste geldige data. |

### Sportlink

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| sportlink.connection | Clientkoppeling en rechten | Maak of bewerk gesimuleerde verbinding; toon datasets/toegang/versheid en simuleer ontbrekend recht zonder echte credentials. |
| sportlink.selection | Teams, seizoen, competitie, poule en clubscope | Selectie bepaalt voorbeelddata; eigen club en poulebreed zijn onderscheidbaar, ongeldige context verbreedt niet stilzwijgend. |
| sportlink.batch | Bulk team × type wizard | Kies meerdere teams/families, zie aantallen en previews; opslaan maakt alle geselecteerde ontwerpen als bewerkbare reeks. |
| sportlink.availability | Eerlijke beschikbaarheid per familie | Alle 17 families zijn zichtbaar; mockdata, providerpad-onbevestigd en handmatige fallback zijn gelabeld, vooral training/vrijwilligers/sponsors/periodestand. |

### Sportlink-families

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| sport_program | Programma | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; club/poule, datum/tijd, teamlogo’s en wedstrijdinformatie; lege/foutstate en volledige paging. |
| sport_results | Uitslagen | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; uitslagen, eigen team/poule, score en datum; lege/foutstate en volledige paging. |
| sport_standing | Stand | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; ranglijst, punten, gespeelde wedstrijden en eigen team; lege/foutstate en volledige paging. |
| sport_period_standing | Periodestand | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; gekozen periode/poule en ranglijst; bronbeschikbaarheid expliciet; lege/foutstate en volledige paging. |
| sport_match_of_the_day | Wedstrijd van de dag | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; gekozen wedstrijd, teams, tijd, locatie en sponsorcontext; lege/foutstate en volledige paging. |
| sport_next_match | Volgende wedstrijd | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; team en eerstvolgende wedstrijd met datum/tijd/tegenstander; lege/foutstate en volledige paging. |
| sport_cancellations | Afgelastingen | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; afgelaste wedstrijden en betekenisvolle lege toestand; lege/foutstate en volledige paging. |
| sport_dressing_rooms | Kleedkamers | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; thuis/uit, kleedkamernummers, veld en wedstrijdtijd; lege/foutstate en volledige paging. |
| sport_officials | Officials | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; wedstrijd, officials en beschikbare wedstrijdinformatie; lege/foutstate en volledige paging. |
| sport_team | Teaminformatie | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; teamidentiteit, teamleden/metadata voor zover beschikbaar; lege/foutstate en volledige paging. |
| sport_sponsor | Sponsors | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; team-/clubpartners met logo en gegevens; bronstatus zichtbaar; lege/foutstate en volledige paging. |
| sport_activities | Clubactiviteiten | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; agenda, datum/tijd, titel en locatie; lege/foutstate en volledige paging. |
| sport_trainings | Trainingen | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; teams, trainingsmomenten en veld; eventuele handmatige bron gelabeld; lege/foutstate en volledige paging. |
| sport_volunteers | Vrijwilligers | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; rollen/oproepen, contactinformatie indien bedoeld, bronstatus; lege/foutstate en volledige paging. |
| sport_birthdays | Verjaardagen | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; datum en namen, leeftijd alleen indien toegestaan/beschikbaar; lege/foutstate en volledige paging. |
| sport_visitor_arrivals | Bezoekende teams | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; bezoeker, ontvangstvenster, wedstrijd, veld en kleedkamer; lege/foutstate en volledige paging. |
| sport_referee_arrivals | Scheidsrechters ontvangen | Openen, mockbron selecteren, bewerken, bewaren/heropenen, thema en 16:9/9:16-preview, aan playlist toevoegen; scheidsrechter, wedstrijd en aankomstvenster; lege/foutstate en volledige paging. |

### Twelve en menu

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| products.import | Excel/CSV-import | Upload of laad voorbeeldbestand; preview toont kolommen en herkende productrijen; geen live Twelve-API claim. |
| products.mapping | Kolommapping, productidentiteit en fouten | Map naam/id/categorie/prijs; foutregels kunnen worden gecorrigeerd/overgeslagen; importupdate dupliceert dezelfde product-ID niet. |
| products.catalog | Handmatige catalogus en categorieën | Maak/bewerk product en categorie met prijs/beschikbaarheid; zoeken/filteren en heropenen werken. |
| menu.editor | Menu/prijslijst samenstellen | Selecteer categorieën/producten/beeld, orden en stel kolommen/titel in; lange namen blijven leesbaar in beide oriëntaties. |
| menu.price_update | Prijzen bewust bijwerken | Nieuwe catalogusprijs verandert TV niet direct; actie Prijzen bijwerken toont impact/diff en maakt nieuw te publiceren concept. |
| menu.paging | Alle menu-items tonen | Meerdere pagina’s, prijsnotatie, categorieën en lege producten zijn correct; preview doorloopt hele selectie. |

### RSS

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| rss.feeds | Meerdere nieuwsfeeds | Feed toevoegen/bewerken/testen; selectie en artikellimiet worden bewaard. |
| rss.rotation | Nieuws met foto en artikel-QR | Preview doorloopt ten minste zes artikelen met juiste titel/intro/foto/index; QR verwijst naar actief artikel of ontbreekt zonder URL. |
| rss.recovery | Leeg, verouderd en fout | Simuleer leegte of storing; laatste succes en bewaarde laatste geldige inhoud blijven duidelijk. |

### LED Scores

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| led.connection | Live scorekoppeling en tenantvrijgave | Flag toont niet-geactiveerd of geactiveerd; verbinding/eigen team/doelgroepen instellen met verse of stale mockevents. |
| led.design | Scorebord en goalintro ontwerpen | Eigen/tegenstander-variant, huisstijl en schermtargets bewerken; preview laat gekozen content zien. |
| led.event | Doelpunt, ontdubbelen en hervatten | Trigger demo-goal; overlay onderbreekt tijdelijk en hervat resterende itemtijd; dubbel of verlopen event speelt niet opnieuw. |

### YouTube

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| youtube.sources | Video en playlist toevoegen | Geldige videolink of playlist selecteren/bewaren; bron kan aan gewone playlist toegevoegd. |
| youtube.playback | Officiële online playback | Preview toont online-/autoplaybeperkingen en gebruikt toegestane weergave; prototype claimt geen gedownloade offlinevideo. |
| youtube.fallback | Lokale fallback bij offline/fout | Kies beeld/video-fallback; simuleer provider-/netwerkfout en terugkeer zonder zwart scherm. |

### Thema’s

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| themes.catalog | FieldFlow en OnzeTrots TV | Afzonderlijke themakaarten met varianten, versie, ondersteunde families/formaten en preview. |
| themes.brand | Clubinstellingen en veilige defaults | Kleurrollen, fonts, logo, achtergrond/decoratie en toegestane motion zijn bewerkbaar; tweede tenant zonder logo heeft neutrale fallback. |
| themes.precedence | Voorrang per toepassing | Plaatsing > playlist > ontwerp > tenant > platform is te inspecteren; reset naar geërfde waarde verandert preview correct. |
| themes.version | Versies en compatibiliteit | Thema-update verandert actieve publicatie niet automatisch; inkompatibele familie/formaat/Playercombinatie wordt vóór publiceren uitgelegd. |
| themes.registry | Nieuw goedgekeurd themapakket | Platform kan een demo-pakket registreren/publiceren met ID/versie/profielen; het verschijnt in bestaande editors, zonder vrije scripts of marketplace. |

### Sponsors

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| sponsors.records | Sponsors en toegelaten media | Sponsorrecord maken/bewerken en media toelaten; creatives komen uit ready tenantmedia. |
| sponsors.campaign | Campagne met looptijd en gewicht | Maak/bewerk campagne, periode, gewicht en oriëntatie; opslaan werkt door in overzicht. |
| sponsors.positions | Creatives en semantische posities | Koppel creative aan fullscreen/hoek/footer/wedstrijdsponsor/balsponsor/presented-by; preview toont plaatsing. |
| sponsors.approval | Indienen, goedkeuren en publiceren | Rolgebonden review voert draft→submitted→approved→published uit; publicatie maakt vaste planversie. |
| sponsors.proof | Rotatie en technische afspeelregistratie | Preview roteert eligible sponsors; demo-device-event toont campagne/versie/duur zonder publieksbereikclaim. |
| sponsors.crm | Pipeline en taken bekijken | Bestaande kans-/takenweergave filteren/openen; label dit als beperkt overzicht, geen volledig CRM dat stil als huidige functie wordt toegevoegd. |

### Engage

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| engage.campaign | Poll of man/vrouw van de wedstrijd | Maak/bewerk titel, vraag, 2–24 opties, periode en resultaatbeleid; tenantflag en rol bepalen beschikbaarheid. |
| engage.lifecycle | Concept, gepland, live, gesloten en archief | Start/plan/sluit/archiveer; sluiting verhindert nieuwe stemmen en bewaart resultaten. |
| engage.vote | Publieke QR-stemervaring | Open demo-QR/link, stem geldig en test herhaalde/ongeldige stem; feedback werkt en telling wordt bijgewerkt. |
| engage.results | Resultaatbeleid en schermweergave | Live/na stem/na sluiten respecteren gekozen moment; QR-oproep/resultaat kan in content/playlist worden gebruikt. |

### Team en support

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| team.members | Team en uitnodigingen | Nodig demo-gebruiker uit, herzend/intrek en wijzig rol/verwijder lid met impact. |
| team.roles | Standaardrollen en eigen rollen | Capabilitymatrix is bewerkbaar voor custom role; editor/viewer/publiceerrechten leveren zichtbaar verschillende bediening. |
| team.audit | Activiteit en audit | Filter acties en open detail met actor, object, tijd en resultaat; demoacties vullen audit. |
| support.tickets | Tickets en onderwerp | Maak ticket met onderwerp/prioriteit, tenantcontext en bevoegde bestemming; lijst/detail/status veranderen. |
| support.messages | Berichten en bijlagen | Antwoord toevoegen, bijlage selecteren, status sluiten/heropenen; onbevoegde rol ziet geen gevoelige inhoud. |
| support.routing | Afdelingen, supportrollen en toewijzing | Platform beheert afdeling/rol/toewijzing; nieuw ticket bereikt juiste mockwerkvoorraad. |

### Billing

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| billing.account | Abonnement en billingaccount | Juridische naam/factuurmail bewaren; schermgebruik, trial, facturen en betaalstatus bekijken zonder vast tarief als live waarheid te claimen. |
| billing.flags | Afzonderlijke rolloutflags | Engine, recurring collection, entitlement enforcement, warning en restriction zijn afzonderlijk te demonstreren; extern bewijs vereist vóór echte activering. |
| billing.test_payment | Testbetaling en mandate | Doorloop gesimuleerde klant→first payment→providerreadback→geldig mandate; annuleer/fail/success geven correcte terugkeer. |
| billing.cycle | Recurring, webhook en reconciliation | Simuleer cyclus/verified webhook, mismatch of chargeback; factuur-/betaalstatus en reconciliationlijst veranderen gecontroleerd. |
| billing.entitlement | Grace, waarschuwing, restrictie en override | Demo toont trial/grace/restricted/verification en tijdelijk platformoverride; niet-actieve flags beperken Player niet. |

### Platform

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| platform.tenants | Organisaties provisionen en lifecycle | Tenant aanmaken/inviteren, pauzeren/heractiveren/archiveren en schermlimiet instellen met reden. |
| platform.users | Platformgebruikers en rollen | Owner/admin/support/viewer beheren met eigen capabilities; tenantbeheer blijft aparte context. |
| platform.features | Featurevrijgave per tenant | Engage/LED/billing en demo-registryvrijgave veranderen alleen gekozen tenant; audit en status zichtbaar. |
| platform.templates | Centrale templates en versies | Template maken/bewerken, versie aanmaken/publiceren/intrekken; bestaande publicatie blijft leesbaar. |
| platform.health | Systeem en beheerherstel | Bron/worker/schermproblemen en open reconciliation tonen; drilldown, retry en supportactie geven afgebakend resultaat. |

### Mobiel beheer

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| mobile.cockpit | Mobiele dagelijkse cockpit | Zelfde betekenis/data als web; bottomnav en sequential task flow werken op telefoonbreedte. |
| mobile.authoring | Camera, upload, Studio en publiceren | Mobiele flow kan afbeelding kiezen, toevoegen, bewerken, bewaren en publiceren; gesloten paneel verliest invoer niet. |
| mobile.security | Biometrie en notificatievoorkeuren | Toon expliciete simulatie van app-lock en voorkeuren; organisatie-/sessiewissel, unlock en categorie-instellingen werken in mockstate. |

### Marketing

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| marketing.site | Publieke productpagina’s en login | Klikbare marketingnavigatie met product, gebruik, demo/contact en doorstap naar beheer. |
| marketing.configurator | Opstelling samenstellen | Kies organisatie, schermen/locaties en bronnen; vervolgaanvraag behoudt deze setup-intent. |
| marketing.lead | Contact- en demoaanvraag | Valideer formulier; lokale demo-opslag toont aanvraag plus bevestiging of herstelbare fout; maak duidelijk dat geen echte mail wordt verzonden. |

### Player-demo

| ID | Scenario | Acceptatiecriterium |
|---|---|---|
| player.boot | Boot en splash | Open web/Android/LG-demo; merk-splash→initialiseren→opslagcontrole toont voortgang zonder fictieve certificering. |
| player.unpaired | Niet gekoppeld en pairingcode | Niet gekoppelde Player toont QR/code, vervaldatum, vernieuwen en contact; koppelen vanuit beheer verandert deze Player. |
| player.waiting | Gekoppeld, wacht op inhoud | Zonder release toont rustige wachtstate; nieuwe publicatie start automatisch ophalen terwijl heartbeat online blijft. |
| player.download | Downloaden en verifiëren | Voortgang per kandidaat met bytes/items; corrupte/ontbrekende media blokkeert activatie en biedt retry. |
| player.activate | Veilige overgang en zichtbaar bevestigd | Gevalideerde kandidaat wacht op item-/loopgrens; zichtbare activatie verandert bevestigde versie op dashboard. |
| player.play | Afspeelbediening en schermcontent | Volledige preview met 16:9/9:16, zones, paginering, audio-profiel en sponsor/goaloverlay; diagnose staat apart van gewone playback. |
| player.offline | Offline met laatste goede inhoud | Netwerk uit laat huidige content doorlopen; offline herstart kiest lokale goede release en toont compacte status. |
| player.no_cache | Offline zonder bruikbare cache | Aparte herstelbare splash legt wachten op netwerk uit; probeer opnieuw of herstel verbinding, zonder succesvolle playback te veinzen. |
| player.recovery | Video-, cache- en transportherstel | Simuleer terminale video versus download/corruptie; bounded retry/skip/LKG-herstel kan nieuwe gezonde release activeren. |
| player.identity | Herstart/update/herinstallatie en recovery | Demoflow bewaart identiteit waar bestaand contract dit ondersteunt; force-sync wist pairing/cache niet, expliciet ontkoppelen vraagt impact. |
| player.billing_splash | Grace-, restricted- en verificatiesplash | Beschikbare entitlementflags laten juiste waarschuwing/wacht-/restrictiestate zien; herstelbetaling/override keert terug naar bewaarde content. |

## 6. Go/no-go voor productie

Een stagingrelease is reviewbaar wanneer bron/build, routecoverage, screenshots en uitgevoerde tests zijn vastgelegd. Een productie-go vereist daarnaast bewijs voor de daadwerkelijk vrijgegeven server-/device-/providerketens, succesvolle niet-destructieve migratie en een getest terugrolpad. Beperk ongeteste functies met een verklaarde gate; meld ze niet als live werkend.

Noem in het eindrapport exact wat gereed is, wat uitsluitend gedemonstreerd wordt en wat nog bewijs vereist. De eigenaar keurt de concrete release goed voordat de afzonderlijke productie-uitrolopdracht wordt uitgevoerd.
