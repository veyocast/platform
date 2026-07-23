# VeyoCast privacy- en Data Safety-audit

Datum: 23 juli 2026
Status: implementatie gereed voor review; nog niet gedeployed
Scope: Marketing, Control, Player/PWA, algemene Android Player, Supabase-schema,
VPS-deployment, back-ups, e-mailroutering en Google Play-documentatie

## 1. Managementsamenvatting

De aangeleverde privacyverklaring is inhoudelijk bruikbaar, maar kon niet
ongewijzigd worden gepubliceerd. De daarin genoemde bewaartermijnen van 90
dagen, 12 maanden en 24 maanden worden niet overal technisch afgedwongen. Ook
waren het btw-identificatienummer, de bereikbaarheid van beide mailboxen, de
Supabase-regio, het Supabase-abonnement, productieback-ups en het volledige
contractuele subverwerkersdossier niet vanuit de repository te verifiëren.

Deze wijziging publiceert daarom:

- een server-renderbare Nederlandse privacyverklaring op `/privacy`;
- een afzonderlijke verwijderroute op `/data-verwijderen`;
- links vanuit de marketingfooter, VeyoCast Control, Android
  Playerbeheer en de Nederlandstalige Play-listing;
- bewaarcriteria die het huidige systeem beschrijven, zonder niet-afgedwongen
  kalendertermijnen te beloven;
- dit technische bewijsrapport met openstaande juridische en operationele
  controles.

De aanwezigheid van deze pagina's is geen bewijs van volledige AVG- of
Google Play-compliance. De productieconfiguratie, contracten, Data Safety-form
en feitelijke verwijderprocessen moeten gelijk blijven lopen met de code.

## 2. Publicatiestatus en URL's

| URL | Doel | Status tijdens audit |
|---|---|---|
| `https://veyocast.nl/privacy` | publieke privacyverklaring | HTTP 404 vóór deze wijziging; route nu lokaal geïmplementeerd, nog niet gedeployed |
| `https://veyocast.nl/data-verwijderen` | publiek verwijderverzoek en instructies | HTTP 404 vóór deze wijziging; route nu lokaal geïmplementeerd, nog niet gedeployed |
| `https://control.veyocast.nl` | Control | HTTP 307 naar login; privacylink lokaal toegevoegd |
| `https://player.veyocast.nl` | productieplayer | HTTP 200; Android-productionvariant gebruikt deze origin |
| `https://staging-player.veyocast.nl` | stagingplayer | compile-time origin van Android-stagingvariant |

De twee publieke URL's mogen pas in Play Console als werkend worden gemarkeerd
nadat de wijziging naar productie is gedeployed en zonder login is gecontroleerd.

## 3. Verificatie van organisatie en contact

| Gegeven uit bron | Uitkomst | Publicatiebesluit |
|---|---|---|
| Handelsnaam | `DG Webservices – VeyoCast` uit aangeleverde bron | opgenomen |
| Adres | Markenseplein 1, 2583 KR Den Haag; publiek handelsregisteroverzicht ondersteunt dit, maar geen officieel KvK-uittreksel ingezien | opgenomen; eigenaar moet officieel uittreksel bewaren |
| KvK | `88135713`; publiek handelsregisteroverzicht ondersteunt dit, maar geen officieel KvK-uittreksel ingezien | opgenomen |
| Btw-identificatienummer | bronveld is leeg; niet veilig uit KvK of andere gegevens af te leiden | niet gepubliceerd; blijft open juridische placeholder |
| `privacy@veyocast.nl` | MX-records bewijzen e-mailroutering via Hostnet, niet het bestaan, afleveren of monitoren van deze mailbox | opgenomen volgens eigenaarbron; end-to-end aflever- en responstest verplicht |
| `support@veyocast.nl` | zelfde uitkomst | opgenomen volgens eigenaarbron; end-to-end aflever- en responstest verplicht |
| Publieke website | `https://veyocast.nl` bereikbaar | opgenomen |
| Openbaar telefoonnummer | niet in bron of repository gevonden | niet toegevoegd |

DNS op 23 juli 2026:

- `veyocast.nl` en de onderzochte Control-/Player-hosts wezen naar
  `49.13.82.239`;
- MX wees naar `mx1` tot en met `mx4.mailpod13-cph3.g1i.hostnet.nl`.

Deze DNS-uitkomst bewijst geen mailboxretentie, DPA, supportproces of
beschikbaarheid van individuele aliassen.

## 4. Wijzigingen ten opzichte van de aangeleverde verklaring

Iedere inhoudelijke wijziging is hieronder benoemd. Er zijn geen stilzwijgende
productieaannames als feit gepubliceerd.

1. Het lege btw-veld is verwijderd; het nummer is niet ingevuld of afgeleid.
2. De dubbele rol van DG Webservices is verduidelijkt:
   verwerkingsverantwoordelijke voor eigen bedrijfsvoering en technische
   beveiliging, verwerker voor tenantcontent waar de klant doel en middelen
   bepaalt.
3. De technische gegevenscategorieën zijn afgestemd op de werkelijke tabellen,
   Player-API's, WebView-opslag, cookies en heartbeatvelden.
4. Er is expliciet gemaakt dat pairing een tijdelijk raw device-token aan het
   apparaat retourneert, terwijl de database een hash bewaart.
5. IP-adres en user-agent zijn opgenomen omdat de pairingroute deze gebruikt
   voor een gehashte beveiligingsvingerafdruk en de infrastructuur deze bij
   netwerkverkeer kan zien.
6. Android-advertentie-ID, IMEI, IMSI, camera, microfoon en locatie zijn als
   niet-gebruikt beschreven op basis van manifest, dependencies en code.
7. De lokale opslag is opgesplitst in:
   Control-cookies en browservoorkeuren; Player-localStorage, IndexedDB en
   Cache Storage; native Android SharedPreferences.
8. De bronzin dat lokale Playerdata bij ontkoppelen kan verdwijnen is
   aangescherpt: server-side ontkoppelen wist een volledig offline apparaat
   niet en last-known-good kan lokaal blijven spelen.
9. Niet-geïmplementeerde categorieën zoals een betaaldienst, marketingcookies,
   extern analyticsplatform en crashrapportageprovider zijn niet als actieve
   productieprocessor gepresenteerd.
10. Direct aangetroffen leveranciers zijn bij naam genoemd: Supabase, Hetzner,
    Hostnet, GitHub en Google Play, met hun verschillende rollen.
11. De algemene claim dat gegevens zoveel mogelijk in de EER worden verwerkt
    is niet als regiofeit gebruikt. De Supabase-projectregio moet nog in het
    Dashboard worden bevestigd.
12. De voorgenomen 90-dagentermijn voor accountgegevens is verwijderd: er is
    geen volledige account-/tenantverwijderflow of algemene job die dit
    afdwingt.
13. De voorgenomen 90-dagentermijn voor playertelemetrie is verwijderd:
    heartbeats, sync-events en device-lab-runs hebben geen algemene
    verwijderjob.
14. De voorgenomen 12-maandentermijnen voor audit- en technische logs zijn
    verwijderd: audit_events is append-only en containerlogs roteren op
    omvang, niet op kalenderleeftijd.
15. De voorgenomen 24-maandentermijn voor support is verwijderd: e-mailretentie
    en een supportticketsysteem zijn niet geconfigureerd in de repository.
16. De 90-dagenbelofte voor verwijderde content in back-ups is verwijderd:
    het Supabase-abonnement en PITR zijn niet bevestigd en databaseback-ups
    bevatten geen Storage-objecten.
17. Werkelijke pairingtermijnen zijn toegevoegd: code 10 minuten; opruiming van
    niet-geclaimde sessies vanaf 15 minuten bij een volgende pairingactie;
    rate-limitpogingen één dag.
18. Het schermverwijdermodel is als logische verwijdering/anonymisering
    beschreven; device-, release- en audithistorie kan blijven bestaan.
19. Media verwijderen is als soft delete beschreven; immutable releases en
    Storage-objecten worden niet generiek fysiek verwijderd.
20. Er is een zelfstandige, Play-bruikbare verwijderpagina toegevoegd met
    account-, tenant-, Player- en Android-opslagstappen en de wettelijke
    reactieroute.
21. Er is niet gesteld dat Google Play-crash- of performancegegevens automatisch
    naar VeyoCast worden doorgestuurd. Wat Google zelfstandig voor Play
    verwerkt valt onder Googles eigen rol; Play Console-inzichten moeten nog
    afzonderlijk worden geverifieerd.
22. De bronsectie over toekomstige integraties is niet als huidige verwerking
    gepresenteerd. Nieuwe integraties vereisen een nieuwe audit en
    beleidswijziging.

## 5. Gegevensinventaris

### 5.1 Account en tenant

| Gegevenstype | Vindplaats/verwerking | Doel |
|---|---|---|
| E-mailadres | Supabase Auth, tenant- en platformuitnodigingen | account, login, uitnodiging |
| Naam en optionele avatar-URL | `profiles` | profiel en herkenning in Control |
| Auth-identiteit en sessie | Supabase Auth en SSR-authcookies | authenticatie |
| MFA/AAL-status | Supabase Auth en Control-sessie | toegang en beveiliging |
| Tenant- en platformlidmaatschap | `tenant_memberships`, `platform_memberships` | rol en bevoegdheid |
| Rol, status en capabilities | memberships en server-side auth | autorisatie |
| Tenantnaam, slug, status en limieten | `tenants`, `tenant_settings` | dienstverlening |
| Uitnodiging, rol, status, expiry en delivery-status | `tenant_invitations` | onboarding en support |
| Tenantcontext | HttpOnly contextcookie, maximaal 30 dagen | expliciete werkcontext |
| Uitnodigingscontext | HttpOnly cookies, maximaal één uur | veilige acceptatie |

### 5.2 Media en publicatie

| Gegevenstype | Vindplaats/verwerking | Doel |
|---|---|---|
| Afbeeldingen, video's en logo's | private bucket `tenant-media` | tenantcontent |
| Oorspronkelijke bestandsnaam, titel, MIME en omvang | `media_assets`, uploadsession | library en validatie |
| Checksum, dimensies en videoduur | media- en variantmetadata | integriteit en playback |
| Storagepad en variantpad | mediarecords en immutable releases | download en release |
| Verwerkingsstatus, fouten en jobs | uploadsessions, processing jobs, variants | veilige pipeline |
| Playlistnaam, beschrijving en items | `playlists`, `playlist_items` | authoring |
| Speelduur, fit, muted en volgorde | playlistitem/release-item | deterministische playback |
| Immutable releasekopie | `playlist_releases`, `playlist_release_items` | herleidbare publicatie |
| Schermtoewijzing | screens en release assignments | distributie |

### 5.3 Scherm, pairing en Player

| Gegevenstype | Vindplaats/verwerking | Doel |
|---|---|---|
| Screen-, device-, playlist-, release- en item-ID | database, manifest, lokale release | koppeling en playback |
| Screen- en devicenaam, locatie en oriëntatie | `screens`, `player_devices` | vlootbeheer |
| Device-token | raw alleen apparaat/HTTPS; hash server-side | intrekbare devicesessie |
| Pairingcode en pending token | raw tijdelijk apparaat; hashes database | veilige pairing |
| Pairingstatus, created/expiry/claimed timestamps | `pairing_sessions` | pairing lifecycle |
| IP en user-agent | HTTPS/reverse proxy; gehashte pairingfingerprint | misbruikpreventie |
| Platform en appversie | device en heartbeat | compatibiliteit/support |
| Capabilities en algoritme-/schema-versies | device/heartbeat | veilige releasekeuze |
| Actieve en gewenste release | device en heartbeat | syncstatus |
| Huidig item en runtime state | heartbeat | fleet health |
| Netwerkstatus | heartbeat en lokale runtime | offline/online diagnose |
| Opslagquota en gebruik | heartbeat | download readiness |
| Foutcode, herstelactie en tijden | heartbeat/device | diagnose |
| Synchronisatiefase en detail | `player_sync_events` | release-uitrol |
| Device-lab user-agent, schermkenmerken, taal en optionele LG-input | `player_device_lab_runs`, lokale IDB | supporttest, alleen support-route |

### 5.4 Audit, logs en support

| Gegevenstype | Vindplaats/verwerking | Doel |
|---|---|---|
| Actor-ID, tenant, actie, target, resultaat, timestamp | `audit_events` | security en bewijs |
| Begrensde auditmetadata | `audit_events` | oorzaak/herstel zonder tokens/PII |
| HTTP-route, status, IP, user-agent en tijd | reverse proxy/applicatielogs voor zover geconfigureerd | toegang, incident en foutanalyse |
| Appversie, environment, veilige eventcode | JSON-applicatielogs | operations |
| Supportbundle met allowlisted statuscodes en release-ID's | on-demand export en auditevent | support |
| E-mailinhoud en bijlagen | Hostnet-mailbox indien gebruikt | support/privacyverzoek |

Er is geen repository-ondersteund supportticket- of contactformsysteem
aangetroffen.

## 6. Control- en Playeropslag

### Control

- Supabase SSR-authcookies voor de beveiligde Supabase-sessie;
- `veyocast-tenant-context`: HttpOnly, SameSite Lax, Secure in productie,
  maximaal 30 dagen;
- `veyocast-invitation-context` en `veyocast-account-invitation`: HttpOnly,
  SameSite Lax, maximaal één uur;
- localStorage voor sidebarstatus, thema, dichtheid/tabelvoorkeuren en
  uploadtray;
- lokale resumable-uploadmetadata zoals intent, idempotency en
  bestandsmetadata; geen service-role key;
- browser uploadt via de geauthenticeerde Supabase-sessie;
- geen marketing- of analyticscookie in de onderzochte code.

### Webplayer/PWA

- localStorage: raw device-token, tijdelijke pairingcode en expiry,
  retrytimestamp, willekeurige Player-instance-ID en reloadtijden;
- IndexedDB `veyocast-player-cache-v1`: actieve en vorige release per token,
  manifest- en schermmetadata en tijdelijk gesigneerde media-URL's;
- Cache Storage `veyocast-player-assets-v1`: media blobs op checksum;
- service-worker shellcache en last-known-good assets;
- server-side revoke maakt het token ongeldig, maar wist offline lokale data
  niet direct.

### Android

- WebView-opslag blijft tussen appstarts bestaan;
- native SharedPreferences bewaart `boot_start_enabled` en
  `last_boot_attempt_ms`;
- Android-back-up en data extraction zijn uitgeschakeld;
- gegevens verdwijnen lokaal na appdata wissen, uninstall of apparaatreset;
- ontkoppelen en lokaal wissen zijn twee afzonderlijke handelingen.

## 7. Android-appaudit

### 7.1 Applicatie en endpoints

| Onderdeel | Uitkomst |
|---|---|
| Package | `nl.veyocast.player` |
| Productie-origin | `https://player.veyocast.nl` |
| Staging-origin | `https://staging-player.veyocast.nl` |
| Debugoverride | alleen debug, beperkt tot localhost/127.0.0.1/10.0.2.2 |
| Cleartext | uit in release |
| WebView-debugging | uit in release |
| Top-level navigatie | alleen exact vertrouwde Player-origin |
| SSL-fouten | altijd annuleren |
| Mixed content | altijd blokkeren |
| File/content access | uit |
| WebView permission requests | altijd weigeren |
| Third-party cookies | uit |
| JavaScriptInterface | niet aanwezig |
| User-agent suffix | `VeyoCastAndroid/<version>`; historische `VeyoCastAndroidTV/<version>` blijft herkenbaar |

### 7.2 Permissions

Gevraagd door de app:

| Permission | Reden | Privacy-impact |
|---|---|---|
| `android.permission.INTERNET` | Player, API en media via HTTPS | netwerkdata wordt off-device verzonden |
| `android.permission.ACCESS_NETWORK_STATE` | herstel bij netwerkverlies | leest connectiviteitsstatus, geen locatie |
| `android.permission.RECEIVE_BOOT_COMPLETED` | best-effort autostart wanneer lokaal ingeschakeld | boot event; geen achtergrondtracking |

Transitie uit AndroidX in de samengevoegde manifest:

- app-signature permission
  `nl.veyocast.player.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`;
- `androidx.startup.InitializationProvider`;
- `androidx.profileinstaller.ProfileInstallReceiver`, beschermd met de
  system permission `android.permission.DUMP`.

Niet aanwezig:

- `com.google.android.gms.permission.AD_ID`;
- locatie-, camera-, microfoon-, contacten-, telefonie- of
  opslagpermissions;
- accessibility of device-admin;
- `WAKE_LOCK` permission. Het scherm blijft wakker via
  `FLAG_KEEP_SCREEN_ON`.

De laatste succesvol gebouwde Play-internal production AAB is eerder op binary
manifest, resources en libraries gecontroleerd. Sinds die build zijn
`AndroidManifest.xml` en Gradle-dependencies tot aan deze privacywijziging niet
gewijzigd. De huidige wijziging voegt alleen een externe HTTPS-link in
Playerbeheer toe. Een nieuwe releasebuild moet desondanks opnieuw in CI worden
gecontroleerd.

### 7.3 SDK's en libraries

Directe runtime-dependencies:

- AndroidX Activity KTX `1.13.0`;
- AndroidX Core KTX `1.19.0`;
- Android System WebView van het apparaat.

Test-only:

- JUnit `4.13.2`.

Niet aangetroffen:

- Google/Firebase Analytics;
- Firebase Crashlytics;
- Sentry Android;
- advertentie- of attribution-SDK;
- payment-SDK;
- social login-SDK;
- MDM/device-owner-SDK;
- native mediaplayer-SDK.

### 7.4 Heartbeat en pairing

De Android-app bouwt geen tweede API of device-database. De ingesloten
webplayer:

1. maakt een pairingaanvraag met een lokaal gegenereerde instance-ID;
2. ontvangt tijdelijk een raw code/token over HTTPS;
3. gebruikt daarna het raw device-token als bearer credential;
4. de server bewaart hashes en koppelt aan screen/device/tenant;
5. heartbeats verzenden actieve/gewenste release, huidig item, runtime,
   netwerk, opslag, syncfase, appversie/capabilities en begrensde foutstatus;
6. revoke maakt een volgende serverinteractie ongeldig;
7. cached last-known-good kan offline blijven spelen tot lokale data wordt
   gewist.

Er worden geen namen van natuurlijke personen, contactlijsten, audio,
camerabeelden, locatiecoördinaten of advertentie-ID door de Android Player
verzameld.

## 8. Verwerkers en infrastructuur

### 8.1 Direct aangetroffen partijen

| Partij | Rol/verwerking | Bevestigd | Openstaand |
|---|---|---|---|
| Supabase | Postgres, Auth, Storage en signed media-URL's | production project-ref en codegebruik | exacte projectregio, abonnement/PITR, ondertekende DPA en TIA |
| Hetzner | VPS/reverse-proxy en containers; IP valt in Hetzner `CLOUD-FSN1`, Duitsland | DNS, RIPE-netblock en deploymentarchitectuur | contract/DPA, feitelijke server- en eventuele snapshot/back-uplocatie |
| Hostnet | MX/e-mailroutering voor `veyocast.nl` | DNS MX/SPF | mailboxbestaan, retentie, DPA en eventuele mail-subverwerkers |
| GitHub | repository, Actions-metadata/logs, OIDC; self-hosted deployrunner | workflows en remote | organisatie-DPA/retentie en wie productionlogs kan lezen |
| Google Play | appdistributie en zelfstandige Play-account/deviceverwerking | listing/workflow | actuele Data Safety-form, Console-privacyvelden, Play Console diagnostics-instellingen |

Geen actieve paymentprovider, extern analyticsplatform, extern
error-reportingplatform of CDN is in runtimecode of productiecompose
aangetroffen. Caddy draait als reverse proxy op de VPS; er is geen bewijs voor
een externe CDN/proxydienst.

### 8.2 Supabase DPA-subverwerkers

De actuele Supabase DPA van 1 juni 2026 noemt in Schedule 3 de volgende
geautoriseerde subverwerkers. Dit betekent niet dat iedere partij continu alle
VeyoCast-productdata ontvangt; toepasselijkheid hangt af van de gebruikte
Supabase-service. De lijst moet contractueel worden gevolgd:

1. Supabase, Inc. — support;
2. Active Campaign, LLC d/b/a Postmark — communicatie/support;
3. Amazon Web Services, Inc — hosting;
4. Atlassian Corporation Plc — statuspagina;
5. Braintrust Data, Inc — monitoring en tracing;
6. Clay Labs Inc. — customer insights;
7. Clazar, Inc — marketplace;
8. Cloudflare, Inc — hosting;
9. ConfigCat Korlátolt Felelősségű Társaság — feature flags;
10. Google, LLC — hosting;
11. Fly.io, Inc — hosting;
12. FrontApp, Inc — communicatie/support;
13. Functional Software, Inc d/b/a Sentry — error monitoring/tracing;
14. Github, Inc — authenticatie van geautoriseerde Supabasegebruikers;
15. Hex Technologies, Inc — data-analyse;
16. Hubspot, Inc — communicatie/support;
17. Notion Labs, Inc — communicatie/support;
18. Sublime Security Inc — e-mailbeveiliging;
19. Latacora, LLC — managed security;
20. OpenAI, LLC — natural-language processing/generation;
21. PandaDoc, Inc — communicatie/support;
22. Slack Technologies, LLC — communicatie/support;
23. Upstash, Inc — serverless datahosting;
24. Vercel, Inc — hosting.

Deze lijst komt uit de leverancier-DPA en is breder dan de directe VeyoCast
dependencies. Wijzigingsnotificaties van Supabase moeten operationeel worden
gevolgd.

### 8.3 Regio's en back-ups

- Supabase documenteert dat ieder project één primaire regio heeft. De
  productieprojectref staat in deploymentdocumentatie, maar de regio staat niet
  in de repository en is niet via de publieke project-URL bewijsbaar.
- Supabase documenteert dagelijkse databaseback-ups voor Pro, Team en
  Enterprise met respectievelijk 7, 14 en maximaal 30 dagen. Het actuele
  VeyoCast-abonnement en eventuele PITR zijn niet bevestigd.
- Supabase-databaseback-ups bevatten alleen Storage-metadata en geen
  mediaobjecten.
- De repository bevat een staging restore-drill en een RPO-doel, maar geen
  bewijs van een actuele productieback-upplanning of afzonderlijke
  Storage-objectback-up.
- De VPS- en snapshotback-uplocatie is niet in repositoryconfiguratie vastgelegd.

Daarom is geen concrete 90-dagenbelofte voor verwijderde data in back-ups
gepubliceerd.

## 9. Retentie-audit

| Categorie | Bronvoorstel | Werkelijke technische situatie | Besluit |
|---|---|---|---|
| Actief account | actief zolang overeenkomst | aanwezig | als criterium gepubliceerd |
| Account na beëindiging | max. 90 dagen | geen volledige account-/tenantdelete of job | 90 dagen niet gepubliceerd; handmatig geverifieerd proces nodig |
| Media/playlists | tot delete/einde | media soft delete; Storage en immutable release blijven | beperking expliciet gepubliceerd |
| Verwijderde content in back-up | max. 90 dagen | plan/PITR onbekend; Storage niet in DB-back-up | 90 dagen niet gepubliceerd |
| Pairing/player | tot unpair/delete | unclaimed cleanup; claimed/device/history blijven | werkelijke lifecycle gepubliceerd |
| Playertelemetrie | max. 90 dagen | geen cleanup voor heartbeat/sync/device-lab | 90 dagen niet gepubliceerd |
| Technische/securitylogs | max. 12 maanden | Docker `json-file`, 5 × 10 MiB per service; Caddyretentie onbekend | omvangcriterium gepubliceerd |
| Auditlog | max. 12 maanden | append-only, geen deletejob | 12 maanden niet gepubliceerd |
| Support | max. 24 maanden | mailbox/ticketretentie onbekend | 24 maanden niet gepubliceerd |
| Offertes | max. 24 maanden | geen offerteworkflow in repo | niet als productretentie gepubliceerd |
| Facturen | 7 jaar | geen payment/facturatie-implementatie in repo; mogelijke wettelijke administratie buiten platform | uitsluitend “voor zover van toepassing” |
| Pairingcode | niet exact in voorstel | expiry 10 minuten | gepubliceerd |
| Pending/expired pairing | niet exact in voorstel | fysiek vanaf 15 minuten bij volgende pairingactie | gepubliceerd |
| Pairing rate attempts | niet exact in voorstel | lazy cleanup na één dag | gepubliceerd |
| Uploadintent | niet exact in voorstel | expiry circa 23 uur; geen brede orphan-objectjob | open technisch punt |

### Waarom geen nieuwe generieke deletejobs zijn toegevoegd

Een generieke destructive cleanup voor accounts, audit, immutable releases,
media, heartbeats of back-ups vereist eerst goedgekeurde juridische
bewaarregels, cascade-effecten, tenant-authorisatie, export/hold-beleid,
Storage-objectafhandeling en hersteltests. Die besluiten kunnen niet veilig uit
de aangeleverde concepttekst worden afgeleid. De gebruiker stond expliciet toe
om mismatches duidelijk te rapporteren. Daarom zijn geen niet-goedgekeurde
destructieve migraties toegevoegd.

## 10. Verwijdergedrag per object

### Account of lid

- membership verwijderen trekt tenanttoegang in;
- platformmembership verwijderen trekt platformtoegang in;
- Supabase Auth-user en `profiles` worden daarmee niet automatisch verwijderd;
- een volledige accountdelete vereist een geverifieerde handmatige procedure;
- verwijderen van één gebruiker mag geen tenantcontent van andere leden wissen.

### Tenant

- tenant archiveren is geen fysieke verwijdering;
- een bevoegde tenantowner/vertegenwoordiger moet het verzoek doen;
- uploads, releases, schermen, leden, audit en wettelijke administratie moeten
  per categorie worden beoordeeld;
- er bestaat nog geen gecontroleerde tenant-wide purge.

### Scherm/Player

- deactiveren stopt actieve inzet;
- devicesessie revoken voorkomt nieuwe succesvolle serverinteractie;
- logisch verwijderen anonimiseert mutable schermvelden en verbergt de
  tombstone uit actieve flows;
- immutable release-, device-, audit- en heartbeatgeschiedenis blijft;
- offline appcache blijft tot lokale appdata wordt gewist.

### Media

- de UI zet `deleted_at`;
- objecten en immutable releasekopieën worden niet generiek fysiek verwijderd;
- een volledig verwijderverzoek vereist referentieanalyse en expliciete
  Storage-delete;
- expired uploadintents en mogelijke orphan objects hebben nog geen brede
  cleanupjob.

## 11. Google Play Data Safety

De huidige Play Console-antwoorden zijn niet vanuit de repository leesbaar.
Daarom kan alleen een mismatch-risico en een conservatieve invulbasis worden
gegeven. **“Geen data verzameld” zou niet overeenkomen met het werkelijke
gedrag**, omdat de webplayer off-device technische gegevens verzendt.

### Voorgestelde conservatieve inventaris voor Console-review

| Data Safety-categorie | Werkelijk gedrag | Doel | Delen |
|---|---|---|---|
| Device or other IDs | gegenereerd device-token, screen/device/instance-ID's; token server-side gehasht | appfunctionaliteit, account/device management, security | met Supabase/hosting als dienstverleners, niet verkocht |
| App interactions / other actions | actieve release, huidig item, runtime en syncfase | appfunctionaliteit en fleetstatus | zelfde processors |
| Diagnostics | begrensde foutcode, herstelactie en timestamps | appfunctionaliteit, troubleshooting, security | zelfde processors |
| Other app performance data | appversie, platform/capabilities, netwerk- en opslagstatus | compatibiliteit en betrouwbaarheid | zelfde processors |
| Approximate location | server ziet IP, maar VeyoCast leidt daar in code geen locatie uit af | geen locatiedoel | laat Play Console/beleidsexpert bepalen of IP onder een invulcategorie valt |
| Files and docs / photos and videos | de Player ontvangt tenantmedia, maar verzendt vanaf het Android-apparaat geen door de gebruiker gekozen bestanden of foto's/video's | geen verzameling vanaf het Playerapparaat aangetroffen | inkomende content staat in Supabase Storage; laat Play Console-review bevestigen dat dit niet als appcollectie geldt |

Waarschijnlijke antwoorden op overige onderdelen, onder voorbehoud van
Play Console-review:

- data wordt via HTTPS/TLS verzonden;
- geen verkoop en geen advertentiedoel;
- geen advertising ID;
- geen precise location, contacten, gezondheid, financiële gegevens,
  berichten, audio-opname of camerabeeld vanuit de Android Player;
- geen native analytics- of crash-SDK;
- accountcreatie vindt niet in de Android Player plaats, maar de dienst gebruikt
  zakelijke Control-accounts; de openbare verwijderlink moet daarom toch worden
  ingevuld;
- `https://veyocast.nl/data-verwijderen` is de bedoelde verwijder-URL na
  productiondeployment;
- `https://veyocast.nl/privacy` is de bedoelde privacy-URL na
  productiondeployment.

Mogelijke mismatch die handmatig moet worden gecontroleerd:

1. Console staat op “geen data verzameld”;
2. device-ID/diagnostics/app activity zijn niet aangevinkt;
3. data deletion URL ontbreekt of verwijst naar een 404;
4. privacy policy URL ontbreekt of is alleen in listingtekst geplaatst;
5. “data kan worden verwijderd” is aangevinkt zonder te vermelden dat
   immutable/audit/back-updata onder voorwaarden kan blijven;
6. Google Play diagnostics of pre-launch reports zijn geactiveerd terwijl de
   publieke tekst zou zeggen dat VeyoCast nooit zulke gegevens ontvangt;
7. de Data Safety-form beschrijft alleen native Kotlin en vergeet de ingesloten
   webplayer.

## 12. Toegankelijkheid en publicatie-eisen

De lokale implementatie bevat:

- statische/server-renderbare Next.js App Router-pages zonder clientcode;
- `lang="nl"` op het document;
- unieke title en Nederlandstalige description;
- canonical URL per pagina;
- index/follow robotsmetadata;
- zichtbare datum;
- skiplink, header, nav, main, article, sections en footer;
- één H1 en hiërarchische H2/H3-koppen;
- responsieve eenkolomsflow op mobiel;
- horizontaal veilige tabellen;
- focusstijlen en semantische links;
- printstylesheet die navigatie en primaire mailknop verbergt;
- geen tracker of cookie vereist om de pagina te bekijken.

## 13. Openstaande blockers en eigenaars

### Juridisch/bedrijf

1. Bevestig het officiële KvK-uittreksel en adres.
2. Lever het btw-identificatienummer als dit publiek moet worden vermeld.
3. Laat de definitieve tekst beoordelen door een bevoegde privacyjurist; dit
   technische rapport is geen juridisch advies.
4. Leg de rolverdeling en verwerkersovereenkomst met tenants vast.
5. Keur een formeel retentieschema en litigation/security hold-proces goed.

### Productie/operations

1. Test `privacy@veyocast.nl` en `support@veyocast.nl` end-to-end, inclusief
   monitoring, afwezigheidsroute en reactieverantwoordelijke.
2. Bevestig en archiveer DPA's voor Supabase, Hetzner, Hostnet en GitHub.
3. Bevestig Supabase-regio, plan, dagelijkse back-upretentie en PITR.
4. Bevestig VPS-providercontract, datacenter en snapshot/back-uplocatie.
5. Implementeer en test afzonderlijke Storage-objectback-ups of documenteer
   bewust dat die niet bestaan.
6. Leg Caddy-accesslogging en kalender-/omvangretentie vast.
7. Kies en implementeer deletejobs voor heartbeat, sync, device-lab, audit,
   expired uploads en orphan Storage-objecten na juridische goedkeuring.
8. Bouw een gecontroleerde account- en tenantdeleteprocedure met export,
   autorisatie, audit, anonymisering, fysieke purge en back-upafhandeling.
9. Documenteer supportmailretentie en verwijdering.

### Google Play

1. Deploy en smoke-test beide publieke URL's zonder login.
2. Vul de afzonderlijke Privacy policy- en Data deletion-velden in Play Console.
3. Vergelijk ieder Data Safety-antwoord met sectie 11.
4. Controleer welke Play Console crash/pre-launch/performance-inzichten
   daadwerkelijk aan de developer worden verstrekt.
5. Bewaar screenshots/export van de goedgekeurde Data Safety-form naast deze
   audit en herhaal bij iedere SDK-, permission- of datastroomwijziging.

## 14. Bronnen en reproduceerbare controles

Repositorycontroles:

```bash
git status --short
rg --files apps packages supabase infra .github
rg -n "uses-permission|AD_ID|analytics|crash|sentry|firebase" apps/android-tv
rg -n "localStorage|sessionStorage|indexedDB|caches" apps/control apps/player
rg -n "player_heartbeats|player_sync_events|audit_events|deleted_at|expires_at" \
  apps packages supabase/migrations
rg -n "max-file|max-size|json-file" infra/vps
dig +short A veyocast.nl control.veyocast.nl player.veyocast.nl
dig +short MX veyocast.nl
curl -I https://veyocast.nl/privacy
curl -I https://veyocast.nl/data-verwijderen
```

Externe primaire bronnen:

- AVG, met opslagbeperking en de mogelijkheid om bewaarcriteria te publiceren:
  <https://eur-lex.europa.eu/legal-content/NL-EN/TXT/?from=nl&uri=CELEX:32016R0679>
- Autoriteit Persoonsgegevens over afhandeling van privacyrechten binnen één
  maand:
  <https://autoriteitpersoonsgegevens.nl/themas/basis-avg/privacyrechten-avg/voor-organisaties-privacyrechten-in-de-praktijk>
- Google Play account deletion:
  <https://support.google.com/googleplay/android-developer/answer/13327111>
- Google Play User Data policy:
  <https://support.google.com/googleplay/android-developer/answer/10144311>
- Supabase-regio's:
  <https://supabase.com/docs/guides/platform/regions>
- Supabase-databaseback-ups en Storage-uitsluiting:
  <https://supabase.com/docs/guides/platform/backups>
- Supabase DPA van 1 juni 2026, inclusief Schedule 3:
  <https://supabase.com/downloads/docs/Supabase%2BDPA%2B260601.pdf>
- Hetzner over dataprotectie en Duitse datacenters:
  <https://docs.hetzner.com/general/company-and-policy/data-protection-at-hetzner/>

## 15. Uitgevoerde validatie

Alle resultaten zijn lokaal op 23 juli 2026 verkregen:

| Controle | Resultaat |
|---|---|
| `pnpm lint` | 20/20 Turbotaken geslaagd |
| `pnpm typecheck` | 20/20 Turbotaken geslaagd |
| `pnpm test` | 20/20 Turbotaken geslaagd |
| `pnpm build` | 13/13 Turbotaken geslaagd; `/privacy` en `/data-verwijderen` als statische routes gegenereerd |
| `pnpm test:a11y` | 23/23 Chromiumtests geslaagd |
| `pnpm exec playwright test tests/e2e --project=chromium` | 14 geslaagd, 2 opt-in live tests overgeslagen |
| `pnpm test:player` | 35/35 geslaagd |
| `pnpm test:player:offline` | 7/7 geslaagd |
| gerichte legal-page browserrun | 7/7 geslaagd, inclusief canonical, geen externe trackingrequest, 320px-overflow en print |
| `./gradlew lint test assembleStagingDebug assembleProductionDebug --no-daemon` | `BUILD SUCCESSFUL`, 104 taken |
| `git diff --check` | geslaagd |

De debugbuilds zijn daadwerkelijk aangemaakt op:

- `apps/android-tv/app/build/outputs/apk/staging/debug/app-staging-debug.apk`;
- `apps/android-tv/app/build/outputs/apk/production/debug/app-production-debug.apk`.

Er is geen fysieke Android-test op telefoon, tablet, signagehardware of
Android TV/Chromecast uitgevoerd en geen nieuwe
production-release-AAB gesigneerd. De huidige wijziging mag pas als publiek
gedeployed worden gemeld nadat de productionworkflow is uitgevoerd en beide
publieke routes daarna HTTP 200 geven.

## 16. Eindoordeel

De codewijziging maakt publicatie technisch mogelijk en voorkomt de
belangrijkste fout: niet-afgedwongen vaste bewaartermijnen als werkelijkheid
beloven. De uitkomst is **conditioneel gereed voor deployment**, met een
duidelijke **NO-GO voor een claim van volledige compliance** totdat de
mailboxen, contracten, productieback-ups, Supabase-regio/plan, Play
Data Safety-form en formele verwijderprocedures door hun verantwoordelijke
eigenaren zijn bevestigd.
