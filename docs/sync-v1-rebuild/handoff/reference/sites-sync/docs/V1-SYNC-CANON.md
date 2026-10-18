# VeyoCast V1 · Sync — implementatiecanon

Versie: 1.0 · 17 oktober 2026. De huidige Sync-broncode is de visuele referentie. Deze canon beschrijft wat de productie-implementatie moet bewaren en afdwingen. Endpointnamen hieronder zijn een **doelcontract** voor mapping op de bestaande repository; zij beweren niet dat deze API’s al bestaan.

## 1. Productgrens en vaste structuur

VeyoCast organiseert het hele traject van content maken naar aantoonbaar afspelen op schermen. De gebruiker werkt in één tenantcontext. Platformbeheer is een aparte context met eigen rechten. Primaire navigatie: Overzicht, Content, Playlists, Planning en Schermen. Studio is de editor vanuit Content. Bronnen en instellingen horen in Beheer, zonder tweede concurrerende contentbibliotheek.

Sync is de enige werkplek. Signal, Canvas, Control en Flow keren niet terug als keuzemogelijkheid. De publieke website is apart indexeerbaar; de werkplek, interne previews, support en accountdata zijn afgeschermd en niet indexeerbaar. De private Sites-instelling is geen vervanging voor productie-authenticatie.

De V1 omvat ook sponsors, Engage, support, platformbeheer, mobiele beheerervaring en gecontroleerde billing. Deze mogen niet stil verdwijnen bij een versimpeling van de hoofdnavigatie. Een beperkte sponsor-pipeline is geen nieuw volledig CRM. Native beheer toont dezelfde taken en objecten als web, met camera, notificatievoorkeuren en beveiligde app-lock wanneer de echte app deze mogelijkheden ondersteunt.

## 2. Visuele regels

- Gebruik de aangeleverde SVG-logo’s en de Screen Sync-hero. Manrope is het merk-/interfacefont; Inter is beschikbaar voor compacte gegevens. OnzeTrots heeft een eigen displayfont.
- Behoud de lichte, rustige werkplek, teal acties, mintaccenten, ruime kaarten, consistente velden en herkenbare statuschips. Basis- en moduletokens uit CSS zijn leidend bij pixelvergelijking; voorkom handmatig afgeleide kleuren per pagina.
- De overdracht toont merkkleuren teal `#006D83`, mint `#59E4B0`, inkt `#142D32`, zacht wit `#F4F7F6`, wit `#FFFFFF` en amber `#D99A35`. Werkplek-CSS bevat bijpassende surface-/border-/accentrollen; kopieer die rollen als geheel.
- Mobiel behoudt dezelfde taakinformatie; de vijf primaire taken krijgen bereikbare ondernavigatie. Een detailpaneel of toetsenbord mag belangrijke acties niet onbereikbaar maken.
- Iedere functie heeft loading, empty, error, denied en success waar van toepassing. Herstel behoudt invoer. Gevaarlijke acties tonen concrete impact en vragen bevestiging.
- Bediening werkt met toetsenbord, zichtbare focus, labels en voldoende contrast. Modals herstellen focus. Statuskleur is nooit de enige statusdrager.
- Korte route- en feedbackmotion ondersteunt oriëntatie. Respecteer `prefers-reduced-motion`; playerstatus blijft zonder animatie compleet. Vermijd een animatie die eindeloos laden suggereert zonder status of herstelactie.

## 3. Route- en API-mapping

De prototyperoute is `?design=sync&page=<sleutel>`; details gebruiken `&id=<id>`. Productieroutes kunnen op de bestaande router worden gemapt. Elk detail moet rechtstreeks openbaar zijn voor een bevoegde sessie, inclusief herstel na herladen en browser-terug.

| Sleutel / zichtbare taak | Productieroute als referentie | Benodigde servercontracten | Minimale acceptatie |
|---|---|---|---|
| `overview` / Overzicht | `/app` | `GET /overview`, schermtelemetry, bronhealth, geplande uitvoeringen | Echte objecten, afzonderlijke bereikbaarheid/sync/weergave; doorklik naar oorzaak |
| `content` / Content | `/app/content` | Content query/create/update/archive, media upload init/complete/status/retry, usage-impact | Eén bibliotheek; herstart upload zonder duplicaat; geen onveilige delete |
| `studio` / Studio | `/app/content/:id/edit` | Ontwerpversies, renderjob, bronbinding, versieconflict | Preview en opgeslagen ontwerp gelijk; conflict verliest geen werk |
| `playlists` | `/app/playlists/:id?` | Playlist CRUD, plaatsingen, previewmanifest, preflight, release/create, assign/history | Plaatsingen wijzigen bronontwerp niet; immutable publicatie |
| `planning` | `/app/planning` | Schedule CRUD, occurrence-preview, conflict-resolver, overrides | Tijdzone en overlap verklaarbaar; eindtijd herstelt correcte default |
| `screens` | `/app/screens/:id?` | Pairing/claim, device registry, groups, layout, hours, commands, diagnostic bundle | Gewenste/actieve versie apart; command heeft ontvangst-/uitvoeringsstatus |
| `sources` | `/app/sources/:id?` | Bronconfiguratie, datasetcapabilities, syncjobs, status, snapshots | Geen providersecret in client; lege data verschilt van fout |
| `products` | `/app/products` | Import/preview/mapping/commit, catalog CRUD, price diff/publish | Product-ID stabiel; prijswijziging verandert TV niet ongemerkt |
| `themes` | `/app/themes/:id?` | Theme registry, package versions, compatibility, tenant branding | FieldFlow en OnzeTrots in beide oriëntaties; actieve versie stabiel |
| `sponsors` | `/app/sponsors` | Sponsor CRUD, campaign CRUD/review/publish, playback events | Goedgekeurde tenantmedia; vast plan; technische registraties zonder bereikclaim |
| `engage` | `/app/engage` | Poll CRUD/lifecycle, publieke public-token/vote/result endpoints | Gesloten poll weigert stem server-side; resultaatbeleid afgedwongen |
| `team` | `/app/team` | Membership/invitations, roles/capabilities, audit query | Tenantgebonden capabilities; uitnodiging herzendbaar/intrekbaar |
| `support` | `/app/support/:id?` | Tickets, messages, attachments, routing/assignment/status | Alleen bevoegde partijen; bijlagen tenantgebonden |
| `billing` | `/app/billing` | Account, plan/usage/invoices, checkout, verified webhook, reconciliation, entitlement | Losse rolloutflags; geen betaling of blokkade door clientstatus alleen |
| `platform` | `/platform` | Tenants, platformroles, flags, templates, system health, reconciliation | Expliciete platformcontext; alle beheeracties geaudit |
| `marketing` / Aanvragen & website | `/app/requests` | Lead inbox/status/notes/assignee, openbare lead intake, notifications | Serveraanvraag en ontvangststatus; formulieren behouden setup-intent |
| `mobile` / Beheerapp | Bestaande native app / responsieve beheerrouter | Dezelfde API’s plus device push registrations/app-lock integration | Zelfde data/rechten; biometrie uitsluitend via OS-verificatie |
| `coverage`, `handover` | Interne oplever-/documentatieroute | Reviewexport optioneel; geen functionele productiedata | Scenariostatus als handmatig bewijs gelabeld |
| Player / `?player=<id>` | Bestaande web-/Android-/LG-playerentry | Manifest/download/verify/activate/ack, heartbeat, commands, events | Laatst goede inhoud blijft bij kandidaatfout; zichtbare activatie bevestigd |

## 4. Gemeenschappelijk API- en datacontract

Bestaande routeprefixen en services blijven bruikbaar. Maak vóór implementatie per rij hierboven duidelijk: bestaande service, ontbrekend contract, migratie en test. Voor alle tenantdata bepaalt de server de tenant uit de geverifieerde sessie of devicecredential; een clientgestuurde `tenantId` is nooit voldoende autorisatie.

Mutaties bevatten een revision/ETag en, voor herhaalbare opdrachten, een idempotency key. Een conflict geeft een herstelbare `409` met actuele revision; geen stille last-write-wins op ontwerpen, publicaties of prijsupdates. Asynchrone acties retourneren `jobId`, actuele status, voortgang en poll-/eventreferentie. Fouten hebben code, begrijpelijke melding, veldfouten waar relevant en retrybaarheid; geen providersecret of stacktrace in gebruikersberichten.

| Domein | Minimale gegevens en invarianten |
|---|---|
| Tenant en toegang | Tenant-ID, status, tijdzone, branding, membership, capabilities, featureflags; tenantrol en platformrol gescheiden |
| Content | Stabiel ID, type/familie, bronbinding, oriëntatie, revision, media-/renderstatus, thema, design settings, archiefstatus |
| Media | Objectreferentie, hash, MIME, breedte/hoogte/duur, verwerking, varianten, eigenaar, usage; immutable bestanden na publicatie |
| Playlist / plaatsing | Playlistrevision; eigen plaatsing-ID, contentrevision, duur, volgorde, sectie, fit/focus, trim, audio, zichtbaarheid, themaoverride |
| Release | Onveranderlijk ID, manifest/schema version, content-/theme-/price snapshots, hashes, platformprofiel, auteur/tijd en targets |
| Assignment | Screen/group-target, desired release/composition, schedulingcontext en revision; staat los van actief bevestigd |
| Device | Stabiele identiteit, tenantbinding, runtime/model/firmware/capabilities, heartbeat, actieve en gewenste release, lokale cache-/downloadstatus |
| Schedule | Tenanttijdzone, begin/einde, herhaling, concrete targets, prioriteit, uitzonderingen, expiry; deterministische overlapresolutie |
| Bron | Provider en configreferentie, datasetrecht, selectie, lastAttempt/lastSuccess/dataTimestamp, snapshotrevision/hash, foutcode |
| Sponsor / Engage | Lifecycle en looptijd, creative-/pollrevision, goedkeuring, publicatie; stem- en playbackregistraties idempotent |
| Billing | Onafhankelijke factuur/betaal/mandate/entitlementstatus, geverifieerde providerreferenties, reconciliation, tijdelijke override met reden/expiry |
| Audit | Actor, tenantcontext, objecttype/ID, actie, request-ID, tijd, resultaat, relevante revision; geen secrets |

Maak brondata en presentatie los. Een nieuwe geldige Sportlink/RSS/LED-snapshot kan in een gepubliceerde selectie verversen zonder elke keer een nieuwe playlistrelease te creëren. Thema-/ontwerp-/plaatsingwijzigingen volgen wel de expliciete releaseketen. Eenzelfde bronhash produceert geen nutteloze revision of download.

## 5. Content, Studio en de 17 sportfamilies

Alle onderstaande families hebben bronselectie, vormgeving, beide oriëntaties, opslaan/heropenen, paging, lege/foutstate en toevoegen aan een playlist. Beschikbaarheid is per dataset en accountrecht zichtbaar. Het prototype bevat mockdata; dat is geen bewijs dat een provider ieder veld levert.

| Nr. | Familie | Bron-/inhoudscontract |
|---|---|---|
| 1 | Programma | Club/team/poule, seizoen, tijdvenster, wedstrijd, tijd, teamlogo’s, veld |
| 2 | Uitslagen | Gekozen scope, gespeelde datum, thuis/uit, uitslag; geen vermenging van poules |
| 3 | Stand | Competitie/poule/seizoen, positie, gespeeld, punten en eigen-teammarkering |
| 4 | Periodestand | Expliciete periode/poule en beschikbaarheidsbewijs; gelabelde handmatige fallback |
| 5 | Wedstrijd van de dag | Gekozen wedstrijd, teams, tijd, locatie en sponsorcontext |
| 6 | Volgende wedstrijd | Eerstvolgende geldige wedstrijd binnen geselecteerd team/context |
| 7 | Afgelastingen | Afgelaste wedstrijden; lege toestand betekent dat er geen afgelastingen bekend zijn |
| 8 | Kleedkamers | Wedstrijd, thuis/uit, kleedkamer, veld en tijd; ontbrekende toewijzing herkenbaar |
| 9 | Officials | Wedstrijd en beschikbare officials/rollen; geen ingevulde persoon suggereren zonder bron |
| 10 | Teaminformatie | Teamidentiteit en toegestane leden-/begeleidingsgegevens |
| 11 | Sponsors | Team-/clubpartners en logo’s; providerpad of handmatige bron expliciet |
| 12 | Clubactiviteiten | Datum, tijd, titel en locatie; bronselectie zichtbaar |
| 13 | Trainingen | Teams, momenten en veld; rechten/providerpad eerst aantonen of handmatig labelen |
| 14 | Vrijwilligers | Rollen/oproepen en bedoelde contactgegevens; bronpad expliciet |
| 15 | Verjaardagen | Datum/naam; leeftijd en persoonsdata alleen waar toegestaan en beschikbaar |
| 16 | Bezoekende teams | Ontvangstvenster, tegenstander, wedstrijd, veld en kleedkamer |
| 17 | Scheidsrechters ontvangen | Naam waar beschikbaar, wedstrijd en aankomstvenster |

De extra Studio-varianten club/team/pouleprogramma, club/team/pouleuitslagen, opstelling, welkom, scoreboard en goal blijven bruikbare varianten binnen de V1. Verder blijven media, vrij ontwerp, clubverhaal, menu, RSS, sponsors, agenda, YouTube en Engage beschikbaar.

Bulkwizard: teams × geselecteerde families → tellen/preview → ontbrekende rechten aanwijzen → alle geldige ontwerpen als bewerkbare reeks bewaren. Een ongeldige teamscope mag nooit stil alle clubgegevens tonen. Elke pagina van lange tabellen en menu’s moet de speler kunnen bereiken. RSS toont minimaal zes voorbeeldartikelen met een artikelgerichte QR; zonder URL geen werkloze QR.

## 6. Thema’s en rendering

V1 heeft FieldFlow en OnzeTrots TV. Beide ondersteunen landscape 16:9 en portrait 9:16, alle toepasselijke families, logo/fallback, veilige marges en leesbaarheid. Render dezelfde semantische inhoud in een ander uiterlijk; een themawissel verwijdert geen bronbinding.

Voorrang: plaatsing → playlist → ontwerp → tenant → platform. Bewaar expliciet wat is geërfd en wat overschreven. Een themaoverriding op één plaatsing verandert het bronontwerp of andere playlists niet. Thema’s zijn geversioneerde goedgekeurde pakketten met ID, versie, familie-/oriëntatie-/runtimecompatibiliteit. Geen willekeurige tenant-JavaScript of impliciete marketplace. Een nieuwe versie verandert geen actieve release zonder expliciete update.

De gedeelde slidepreview is de visuele referentie voor editor en player. Productie mag een afzonderlijke renderworker of LG-renderer gebruiken zolang inhoud, pagina’s, fonts, marges en thema-uitkomst overeenkomen. Maak profielen voor functies die niet overal kunnen, waaronder videocodec, audio, motion en power.

## 7. Publiceren, cache en veilige activatie

Publicatieketen: **concept → preflight geslaagd → immutable release → doeltoewijzing → downloaden → verifiëren → veilige overgang → zichtbaar actief bevestigd**.

1. Preflight controleert bronbinding, ready media, hashes, oriëntatie, thema-/runtimeprofiel, opslag en doelconflicten. Een fail heeft een concrete herstelactie.
2. Publiceer een vast manifest met snapshots. Toewijzing kan nu, later, per scherm of groep. Bewaar de vorige publicatie.
3. Device houdt `desired` en `active/confirmed` apart. Online betekent uitsluitend recent contact; het bewijst geen afspelen.
4. Download kandidaatbestanden naast de actieve set. Verifieer volledigheid, hashes, schema en profiel. Een onderbroken of corrupte kandidaat wordt niet actief.
5. Activeer atomisch bij de afgesproken item-/loopgrens. Bevestig pas nadat de runtime de nieuwe output daadwerkelijk heeft gestart. Alleen servertoewijzing mag geen groene actieve status geven.
6. Retry is begrensd en behoudt identiteit, pairing en laatst goede cache. Transport-, asset-, videodecoder- en bronfouten hebben verschillende herstelpaden.
7. Offline met cache speelt de laatst goede set. Offline zonder cache toont een expliciete herstelbare wachtstate. Een normale force-sync wist niets. Een veilige herstart of update gebruikt de bestaande identiteit-/recoverycontracten.
8. Rollback maakt een nieuwe toewijzing naar een bestaande geldige release of herstelt die als nieuw concept; geschiedenis blijft intact.

Prijswijzigingen zijn bewust. Catalogus bewerken raakt actieve TV-inhoud niet. `Prijzen bijwerken` toont diff/impact, maakt een bevroren prijsversie en nieuwe kandidaatpublicaties waar nodig. De oude bevestigde release blijft bestaan totdat de player de nieuwe werkelijk activeert.

## 8. Planning, zones, locaties en apparaatbeheer

Planning gebruikt de tenanttijdzone, expliciete begin/eindtijden, herhaling, uitzonderingen en prioriteit. De kalenderpreview noemt concrete uitvoeringen en overlapwinnaar. Bij afloop keert de hoofdzone terug naar de juiste standaard; zij-/onderzones blijven behouden tenzij de planning die expliciet wijzigt. Test zomertijd, middernacht en tegenstrijdige regels.

Vier vaste contentindelingen: fullscreen, zijzone, onderzone en drie zones; landscape/portrait met begrensde proporties. Elke contentzone heeft playlist en fallback, geluid alleen in de hoofdzone. LED- en sponsoroverlays hebben een expliciet schermbreed contract. Een compositie is pas activeerbaar wanneer alle vereiste zones gereed zijn.

Fysieke zones zijn plaatsen op een plattegrond; contentzones zijn delen van het beeld. Locaties, plattegronden, pinpositie en schermgroepen krijgen eigen stabiele IDs. Groepswijzigingen moeten transparant doorwerken in toekomstig targetgebruik.

Pairingcodes zijn tijdelijk, eenmalig claimbaar, tenantgebonden en rate-limited. Toon verlopen/ongeldig/al-geclaimd. Devicecommands hebben opdracht-ID, TTL en afzonderlijk verstuurd/ontvangen/uitgevoerd/mislukt/verlopen. Herladen, sync en pairingherstel zijn afgebakend. Power/sleep/wake/autostart alleen bij een bewezen platformcapability; een browser kan geen fysieke poweractie claimen.

## 9. Bronnen en commerciële modules

| Module | Productiecontract |
|---|---|
| Sportlink | Adapter per bewezen dataset, providerrechten, tijdzone, geselecteerde club/team/seizoen/poule en last-good snapshot. Ontbrekende rechten tonen, niet opvullen met ongeëtiketteerde mockdata. |
| Twelve | Eerst CSV/Excel-exportimport. Preview, mapping, stabiele externe product-ID, foutregels, decimalen, categorie en expliciete commit. Geen live Twelve-API claim zonder contract/bewijs. |
| RSS | Meerdere feeds, bronfilter, veilige ingest/HTML-sanitizing, afbeeldingsfallback, deduplicatie, freshness en laatste geldige artikelen. |
| LED Scores | Tenantflag, profielcapability, juiste match/teamtargets, event-ID/tijd/TTL; dubbele/verlopen goals overslaan. Tijdelijk onderbreken en resterende itemtijd hervatten. |
| YouTube | Officiële online weergave waar toegestaan, autoplay-/netwerkbeperkingen zichtbaar; lokale toegestane beeld-/videofallback. Geen claim dat YouTube offline gedownload wordt. |
| Sponsors | Ready tenantmedia, looptijd, gewicht, oriëntatie en semantische positie: fullscreen, hoek, footer, wedstrijd-/balsponsor, presented-by. Draft/submitted/approved/published en immutable planversie. Technische afspeelregistratie toont duur/device/revision, geen onbewezen publieksbereik. |
| Engage | Poll/speler van de wedstrijd, 2–24 opties, concept/gepland/live/gesloten/archief, QR/public token, rate-limiting en ontdubbeling server-side. Resultaten live/na stem/na sluiten volgens beleid. |
| Team/support | Standaard- en eigen capabilityrollen, audit, uitnodigingen; tickets met onderwerp, prioriteit, routing, verantwoordelijkheid, berichten, bijlagen en sluit/heropenflow. |
| Platform | Organisaties en limieten, platformrollen, featureflags, centrale templateversies, bron-/workerhealth en reconciliation. Tenantnavigatie en platformnavigatie gescheiden. |
| Billing | Engine, recurring collection, entitlement enforcement, warning en restriction hebben afzonderlijke flags. First payment → providerreadback → geldig mandate; verified webhook en periodieke reconciliation. Trial/grace/restricted/verification en override met reden/expiry. Geen financieel beleid afleiden van clientredirect. |

## 10. De twee technische grenzen die behouden blijven

**Beheer en moderne webplayer.** De React/Vite/Motion-demo toont gewenste UI en gedrag. Port die naar de bestaande Next.js-/servicearchitectuur met echte serverauthenticatie, typed contracts en duurzame opslag. Browser-localStorage mag voorkeuren of offlineconcepten bevatten, niet de gezaghebbende rechten of productieadministratie.

**Android en LG.** Behoud Android package/application ID, signing keys, updatepad, bestaande installaties, device-identiteit en pairing. Leg vóór wijzigingen vast hoe cache en identiteit herstart/update/herinstallatie doorstaan; verander niet onbedoeld het bestaande recoverycontract. Houd de LG-adapter apart: de legacy runtime mag een ES5-compatible build en aparte media-/cachecode nodig hebben. De moderne beheerstyling mag geen onuitvoerbare syntaxis of browserafhankelijkheid in de LG-bundle trekken. Bewijs de ondersteunde model/firmwarecombinaties fysiek; een dropdown in de demo is geen certificering.

## 11. Migratie- en releasevoorwaarden

Maak een mapping van oude scherm-, content-, theme-, playlist-, release- en tenant-ID’s. Voeg ontbrekende velden/migraties toe zonder destructieve reset. Bewaar bestaande publicaties leesbaar en maak schema-/manifestversies expliciet. Zet eerst staging op met representatieve bestaande data en gescheiden providerinstellingen.

Voltooi UI-, server-, device-, provider- en SEO-acceptatie volgens `ACCEPTATIE.md`. Nieuwe billing- en restrictieflags blijven uit tot de bijbehorende keten bewezen is. Rapporteer resterende gates met concrete reden. Productie-uitrol is een afzonderlijke opdracht; lever daarvoor release notes, migratie-/terugrolplan en bewijs van de huidige stagingversie.
