# VeyoCast Player- en pairing-threatmodel

## Reikwijdte

Dit document beschrijft de S27-grens tussen een fysieke Player, de publieke
pairing-API, een bevoegde Control-gebruiker en de tenantgebonden database. De
Player blijft een revocable device en is geen Supabase Auth-user.

## Te beschermen waarden

- het ruwe device-token dat uitsluitend op de Player staat;
- de tijdelijke pairingcode en de nog niet geclaimde tokenhash;
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

## Dreigingen en controls

| Dreiging | Gevolg | S27-control |
|---|---|---|
| Pairingcode raden | Onbevoegd device claimen | Niet-ambigue 6-karaktercode, tien minuten geldig, maximaal tien claimpogingen per actor per vijf minuten en generieke foutuitkomst. |
| Replay van gebruikte code | Tweede device-identiteit | Claim vergrendelt de pairingsessie; alleen `pending` kan atomair naar `claimed`. Replay levert `INVALID_OR_REPLAYED`. |
| Gelijktijdige double claim | Twee actieve Players | Rijlock op pairingsessie plus unieke partial index voor één paired device per scherm. |
| Cross-tenant claim | Device aan verkeerd scherm | Command valideert beheerrol voor `p_tenant_id` en zoekt het scherm uitsluitend binnen dezelfde actieve tenant. |
| Pairingsessie-spam | Databasevervuiling/DoS | Duurzame per-fingerprint- en globale creationlimiet; vorige pending sessie voor dezelfde fingerprint wordt geannuleerd. Alleen hashes worden bewaard. De fingerprint combineert het beheerde netwerk-/user-agentsignaal met een lokale, niet-geheime Player-instance-ID, zodat meerdere schermen achter dezelfde verbinding elkaar niet annuleren. |
| Device secret in Control/log/URL | Overname van Player | Ruw token wordt alleen in de no-store Playerresponse geleverd. Control ontvangt alleen een code; actions, redirects, events en metadata bevatten geen token. Raw databasefouten worden niet naar UI/API geretourneerd. |
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
- De fingerprint is alleen een begrenzingssignaal en geen device-identiteit.
  Reverse-proxyheaders kunnen worden gespoofd buiten de beheerde VPS-route;
  daarom blijft ook de globale grens actief.

## Bewuste rest-risico's

- Een volledig offline apparaat kan niet op afstand worden gewist of direct
  gestopt. Fysieke toegang en de eerstvolgende verbinding blijven noodzakelijk.
- Een aanvaller met volledige fysieke browser-/opslagtoegang kan lokale
  Playerdata proberen uit te lezen. Fysieke hardening en LG-kioskconfiguratie
  horen bij S30-hardwarevalidatie.
- De database rate limiter vervangt geen upstream DDoS-bescherming. Caddy/VPS-
  netwerkbegrenzing blijft defense in depth.
- Fysieke LG-validatie, firmwareverschillen en de 24-uurs soak blijven S30-gates.

## Bewijs

`supabase/tests/rls_screen_fleet_onboarding.sql` bewijst limietafdwinging,
wrong-tenant denial, expiry/replaybasis, creation- en claimrate limiting,
maintenance, retry, eerste heartbeat, veilige foutcode, revoke, re-pair en
disable. De live browserjourney bewijst create → pair → heartbeat → detail →
sync/events boven echte Supabase-data.
