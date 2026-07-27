# VeyoCast Player- en pairing-threatmodel

## Reikwijdte

Dit document beschrijft de S27/S48-grens tussen een fysieke Player, de publieke
installatie- en pairing-API, het remote command-kanaal, een bevoegde
Control-gebruiker en de tenantgebonden database. De Player blijft een revocable
device en is geen Supabase Auth-user.

## Te beschermen waarden

- het ruwe device-token dat uitsluitend op de Player staat;
- de afzonderlijke ruwe installatiecredential die uitsluitend op de Player
  staat;
- de tijdelijke pairingcode en de nog niet geclaimde tokenhash;
- remote commandnonces, TTL en terminale uitvoeringsstatus;
- tenant-, scherm- en release-ownership;
- de gekoppelde device-identiteit en intrekkingsstatus;
- last-known-good playback tijdens netwerkverlies;
- heartbeat-, storage-, runtime- en synctelemetrie;
- audit- en rate-limitbewijs zonder gevoelige requestinhoud.

## Vertrouwensgrenzen

1. De publieke Player mag een tijdelijke pairingsessie maken, maar geen tenant,
   scherm of release kiezen.
2. Alleen een ingelogde tenant-/platformbeheerder kan een code voor de actieve
   tenant en een actief scherm claimen.
3. De databasecommand valideert actor, tenantstatus, resource ownership,
   expiry, replay en concurrency opnieuw; zichtbare Control-state is geen
   autorisatiebewijs.
4. Een device-token autoriseert uitsluitend de gekoppelde Playerbootstrap,
   manifesten en heartbeat voor dat ene scherm.
5. De installatiecredential autoriseert alleen installatie-heartbeat,
   pairing voor die installatie en ophalen/bevestigen van reeds
   tenantgeautoriseerde commands. Zij kan geen tenant, scherm of opdracht
   kiezen.
6. Control kan commands alleen via een server-side capabilitycheck voor het
   actieve tenantscherm aanmaken; de Player kan geen commandtype of payload
   verhogen.

## Dreigingen en controls

| Dreiging | Gevolg | S27-control |
|---|---|---|
| Pairingcode raden | Onbevoegd device claimen | Niet-ambigue 6-karaktercode, tien minuten geldig, maximaal tien claimpogingen per actor per vijf minuten en generieke foutuitkomst. |
| Replay van gebruikte code | Tweede device-identiteit | Claim vergrendelt de pairingsessie; alleen `pending` kan atomair naar `claimed`. Replay levert `INVALID_OR_REPLAYED`. |
| Gelijktijdige double claim | Twee actieve Players | Rijlock op pairingsessie plus unieke partial index voor één paired device per scherm. |
| Cross-tenant claim | Device aan verkeerd scherm | Command valideert beheerrol voor `p_tenant_id` en zoekt het scherm uitsluitend binnen dezelfde actieve tenant. |
| Pairingsessie-spam | Databasevervuiling/DoS | Duurzame per-fingerprint- en globale creationlimiet; vorige pending sessie voor dezelfde fingerprint wordt geannuleerd. Alleen hashes worden bewaard. De fingerprint combineert het beheerde netwerk-/user-agentsignaal met een lokale, niet-geheime Player-instance-ID, zodat meerdere schermen achter dezelfde verbinding elkaar niet annuleren. |
| Twee gelijktijdige code-aanvragen | Dubbele actieve code of onduidelijke claim | Transactionele installation-lock, gehashte idempotencynonce en unique partial index voor maximaal één `pending` sessie per installatie. |
| Device secret in Control/log/URL | Overname van Player | Ruw token wordt alleen in de no-store Playerresponse geleverd. Control ontvangt alleen een code; actions, redirects, events en metadata bevatten geen token. Raw databasefouten worden niet naar UI/API geretourneerd. |
| Installatiecredential in database/log/URL | Overname van anonieme Player of commands | Ruwe credential verschijnt alleen in de no-store registratie-response en lokale storage. PostgreSQL, audit, Control, URLs en foutdata bevatten uitsluitend de hash of niet-geheime installatie-ID. |
| App verwijderen wist WebView-pairing | Onnodige nieuwe code en verlies van operationele continuïteit | De officiële Android-shell leidt een per signing key/app/device afgeschermde herstelcredential af van `ANDROID_ID`, levert die uitsluitend als first-party Secure/HttpOnly-cookie en de server bewaart alleen de SHA-256-hash. Een geldige native recovery roteert installatie- en devicecredential atomair en behoudt Installation, Screen en contentbinding. |
| MAC- of publiek device-ID wordt autorisatie | Spoofing of stille schermovername | MAC-adressen worden niet gelezen. Het publieke installatie-ID blijft niet-geheim en is nooit herstelbewijs. Native recovery vereist de opaque credential uit de officiële Android-sandbox; revoked device/installations herstellen niet. |
| Gekraakte devicecredential blokkeert herstel | Player blijft permanent onbereikbaar | Afzonderlijke installation-auth voorkomt dat commandpolling van het defecte devicecredential afhangt. Recovery roteert het devicecredential pas bij uitvoering en behoudt de schermbinding. |
| Cross-tenant command | Onbevoegd herladen, unpairen of cache wissen | Queuefunctie valideert actorcapability, actieve tenant, screenownership en de actuele installation/devicebinding opnieuw. Player-RLS geeft geen directe tabeltoegang. |
| Command replay | Herhaalde reload/wipe | Cryptografische nonce, TTL, terminale databasevelden, row lock en lokale bounded executed-noncejournal. Terminale of verlopen commands worden niet opnieuw geleverd. |
| Verlopen command wordt alsnog uitgevoerd | Late onverwachte wijziging | Pollfunctie markeert verlopen opdrachten failed en levert alleen commands binnen TTL. Completion valideert dezelfde installatie, nonce en niet-terminale status. |
| Player vervalst commandresultaat | Onjuiste Controlstatus of tokenrotatie | Alleen de geauthenticeerde installation kan de eigen opdracht bevestigen. Server bepaalt het herstelresultaat en credential; Player bepaalt geen tenant-, screen- of commandownership. |
| Een tijdelijke API-fout wist geldige binding | Onnodige re-pairing en contentonderbreking | Alleen allowlisted definitieve machinecodes verwijderen de devicecredential. 500/502/503/504, DNS, timeout en offline houden credential plus last-known-good release vast. |
| LG-recovery meldt succes zonder nieuwe sessie | De Player keert terug naar dezelfde vastgelopen state | De chunkvrije route registreert de installatie en maakt de atomaire pairing vóór redirect. Een blijvende 503 stopt zichtbaar zonder marker of credentialverlies; deploymentsmoke bewijst de publieke keten en ruimt testdata op. |
| Android registreert een stille BAL-blokkade als succes | Control en lokaal beheer tonen een niet-werkende autostart als gezond | Boot/package replacement starten via expliciet geconfigureerde PendingIntent. Alleen `onResume` bevestigt `player-visible`; een aparte 30-secondenverificatie rapporteert `BACKGROUND_START_NOT_VISIBLE`. |
| Directe schermlimiet-race | Meer schermen dan contract | Create-command en bestaande limiettrigger vergrendelen dezelfde tenantrij voordat aantal en insert worden uitgevoerd. |
| Revoked device blijft online synchroniseren | Ongeautoriseerde nieuwe content | Bootstrap en heartbeat selecteren alleen `paired` devices op een actief scherm. Revoke faalt daarna gesloten. |
| Revoked device is offline | Intrekking lijkt direct terwijl server onbereikbaar is | Control meldt expliciet dat cached last-known-good content zichtbaar kan blijven tot de eerstvolgende verbinding. Er wordt geen onmogelijke remote-wipeclaim gedaan. |
| Onderhoud veroorzaakt zwart scherm | Publieke onderbreking | Maintenance blokkeert nieuwe pairing/online sync, maar trekt het device niet in en verwijdert de lokale geldige release niet. |
| Telemetry bevat raw foutdata | Privacy- of implementatielek | Playerroute stuurt alleen gesaniteerde code, item-ID, actie en timestamp. Database bewaart maximaal een allowlisted foutcode van 100 tekens. |
| Stale heartbeat lijkt actueel | Verkeerde operationele beslissing | UI toont absolute/relatieve tijd; S26-preflight behandelt telemetry ouder dan twee minuten niet als opslagbewijs. |

## Rate-limitmodel

- Player creation: maximaal vijf pogingen per gehashte combinatie van netwerk,
  user-agent en lokale Player-instance per tien minuten en maximaal 300 globale
  pogingen per minuut.
- Control claim: maximaal tien pogingen per geauthenticeerde actor per vijf
  minuten.
- Rate-limitrijen staan in het private schema, zijn niet leesbaar voor browserrollen
  en worden na één dag opgeruimd.
- Alleen werkelijk aangemaakte sessies tellen voor het creationvenster.
  Afgewezen automatische retries blijven auditbaar, maar verlengen de blokkade
  niet. De API retourneert de resterende wachttijd en de Player hervat daarna
  automatisch zonder handmatige refresh.
- Pending, verlopen en geannuleerde pairingsessies worden bij de eerstvolgende
  pairingactie verwijderd zodra zij vijftien minuten oud zijn. Claimed sessies
  blijven bestaan als referentie voor device- en auditbewijs.
- De S48-server gebruikt de installation-lock en één actieve pendingindex;
  dezelfde requestnonce retourneert idempotent dezelfde nog geldige sessie.
- Remote commands hebben per type een korte server-side TTL en gaan na
  completion/failure nooit terug naar een leverbare status.
- De fingerprint is alleen een begrenzingssignaal en geen device-identiteit.
  Reverse-proxyheaders kunnen worden gespoofd buiten de beheerde VPS-route;
  daarom blijft ook de globale grens actief.

## Bewuste rest-risico's

- Een volledig offline apparaat kan niet op afstand worden gewist of direct
  gestopt. Fysieke toegang en de eerstvolgende verbinding blijven noodzakelijk.
- Een aanvaller met volledige fysieke browser-/opslagtoegang kan lokale
  Playerdata en beide credentials proberen uit te lezen of hard recovery
  starten. Fysieke hardening en LG-kioskconfiguratie blijven nodig; het
  herstelmenu vraagt bewust geen onbekend LG-beheerwachtwoord.
- Een aanvaller met root-/ADB-toegang op het fysieke Android-apparaat kan ook
  de platformidentiteit of runtime proberen uit te lezen. Native
  herinstallatieherstel is daarom continuïteit, geen vervanging voor managed
  kiosk/device-ownerhardening of Play Integrity bij een hoger dreigingsniveau.
- Een unmanaged Android-app kan background activity launch-beleid van Android
  of de OEM niet overrulen. De geverifieerde poging en zichtbare foutcode
  voorkomen een valse succesclaim; een absolute bootgarantie vereist
  device-owner/kiosk/default-launcherbeheer.
- Remote recovery is een pollmodel en werkt pas wanneer de Player de VeyoCast
  API kan bereiken. Het is geen push- of remote-wipegarantie.
- De database rate limiter vervangt geen upstream DDoS-bescherming. Caddy/VPS-
  netwerkbegrenzing blijft defense in depth.
- Fysieke LG-validatie, firmwareverschillen en de 24-uurs soak blijven S30-gates.

## Bewijs

`supabase/tests/rls_screen_fleet_onboarding.sql` bewijst limietafdwinging,
wrong-tenant denial, expiry/replaybasis, creation- en claimrate limiting,
maintenance, retry, eerste heartbeat, veilige foutcode, revoke, re-pair en
disable. `supabase/tests/rls_player_installations_commands.sql` bewijst
gehashte installatiecredentials, atomaire/idempotente pairing, command-TTL,
eenmalige uitvoering, tenantisolatie en behoud van scherm/playlist bij recover
en unpair. `rls_android_reinstall_recovery.sql` bewijst native credentialrotatie
en installation- of pending-authenticated pairingrecovery. De volledige
database-run bevat na S53 746 geslaagde assertions. De
live browserjourney bewijst create → pair → heartbeat → detail → sync/events
boven echte Supabase-data.
