# Schermautomatisering

Status: implementatie gereed voor stagingvalidatie
Versie: schema 1
Laatst bijgewerkt: 26 juli 2026

## Doel en navigatie

Schermautomatisering beantwoordt wanneer een Player actief probeert te worden.
Contentplanning blijft afzonderlijk bepalen welke immutable release dan wordt
afgespeeld.

De tenantbeheerder vindt de functie via:

`Control → Schermen → [scherm] → Automatisering`

De schermvloot toont een compacte link, zoals `Dagelijks 07:30`, `Ma–vr 08:00`,
`Altijd actief`, `Automatisering gepauzeerd` of `Handmatig`. Een
contentplanning wordt niet geblokkeerd als automatisering uitstaat; het
schermdetail toont dan wel een waarschuwing.

## UX

De Automatisering-tab bevat:

1. een capabilitykaart met device-, platform-, OS-, app- en heartbeatstatus;
2. lokale bedrijfstijden per weekdag, met maximaal vier perioden per dag;
3. automatische en lokale startinstellingen met een startmarge;
4. schedule-aware keep-awake;
5. optionele HDMI-CEC-startpoging na expliciete compatibiliteitsacceptatie;
6. datumuitzonderingen;
7. een gecontroleerde online testopdracht;
8. technische uitvoeringshistorie;
9. permanent zichtbare compatibiliteitsuitleg.

Zichtbare capabilitystatussen zijn uitsluitend `Ondersteund`,
`Waarschijnlijk ondersteund`, `Niet beschikbaar` en `Nog niet getest`.
`Player zichtbaar` betekent alleen dat de Android Activity rapporteerde; het is
geen bewijs dat een fysiek televisiepaneel beeld toont.

## Data en tenantbeveiliging

Migratie `20260728400000_screen_automation.sql` voegt toe:

- `screen_automation_settings`;
- `screen_automation_periods`;
- `screen_automation_exceptions`;
- `screen_automation_commands`;
- `screen_automation_events`.

Elke rij is tenantgebonden. Composite foreign keys blokkeren cross-tenant
scherm- of devicereferenties. RLS is `default deny` en geforceerd.
Geauthenticeerde gebruikers lezen via bestaande tenantpolicies. Mutaties gaan
alleen via `SECURITY DEFINER`-RPC's die `tenant.screen.manage`, actieve
membership, revisie en resourceverband controleren:

- `save_screen_automation_v1`;
- `request_screen_automation_test_v1`.

De Player gebruikt alleen het gehashte bestaande device-token via
`sync_player_automation_v1`. Eventrapportage is idempotent op een client-UUID.
Testopdracht en disclaimeracceptatie schrijven een bestaand append-only
audit-event.

## Versie-1-contracten

`@veyocast/contracts` valideert:

- instellingen, perioden en uitzonderingen;
- capabilityrapporten;
- testcommando's;
- idempotente uitvoeringsrapporten;
- heartbeat-syncrespons.

Ongeldige tijdzones, overlappende perioden, gelijke begin/eindtijden,
HDMI-CEC zonder lokale start, verlopen commando's en ongeldige deviceverbanden
worden server-side geweigerd.

## Evaluatievolgorde

De canonical TypeScript-evaluator en de native Androidvariant volgen:

1. automatisering uit of offlinecache verlopen;
2. expliciete datumuitzondering;
3. tijdelijke override;
4. `altijd actief` of weekschema;
5. standaard inactief.

Tijdstippen zijn lokale `HH:mm`-waarden plus een IANA-tijdzone. Perioden over
middernacht zijn aan hun startdag verankerd. DST wordt op daadwerkelijke
instants in de ingestelde tijdzone geëvalueerd. De eerstvolgende activatie wordt
maximaal negen dagen vooruit bepaald.

## Offline en lifecycle

De server stuurt bij iedere geldige heartbeat een cache-expiry mee. Versie 1
gebruikt zeven dagen. Android bewaart alleen de gevalideerde operationele
configuratie in private `SharedPreferences`; geen pairingtoken of tenantsecret.
Na expiry wordt een lokale start niet meer uitgevoerd. De bestaande
last-known-good mediarelease en pairingopslag worden niet gewist.
Wanneer `Offline uitvoeren` uitstaat, wordt een lokale start zonder door
Android gevalideerde internetverbinding overgeslagen en diagnostisch gemeld.
De bestaande mediacache blijft daarbij intact.

Bij reboot, appupdate, handmatige klokwijziging of tijdzonewijziging wordt één
volgend inexact alarm opnieuw gepland. Bestaande schermen hebben standaard:

- automatisering uit;
- automatische/lokale start uit;
- HDMI-CEC uit;
- bestaand keep-awakegedrag ongewijzigd tot automation geconfigureerd is.

Een server-side revoke kan een volledig offline device niet direct bereiken;
zodra verbinding terugkeert blijven de bestaande device- en manifestguards
leidend.

## Testopdracht en diagnostiek

Een test kan alleen worden aangemaakt voor een recent online, gekoppelde Player
die `supportsScheduledWake` rapporteert. Zonder FCM of foreground service is een
gesloten/offline app niet remote wekbaar. De commandduur is vijf minuten.

Mogelijke technische fasen:

- opdracht aangevraagd/ontvangen;
- wake-trigger ontvangen;
- Android-appstart aangevraagd;
- Player zichtbaar;
- heartbeat bevestigd;
- verlopen of mislukt.

Diagnostische codes bevatten geen token, cookie, signed media-URL of
persoonsgegeven. Het eventmodel ondersteunt negentig dagen operationele
historie, maar automatische retentie wordt pas geactiveerd nadat het algemene
retentiebeleid formeel is vastgesteld.

## Rollout

1. database-migratie en RLS-tests;
2. Player API en Control deployen;
3. algemene Android- en TV-build naar interne testtracks;
4. een testtenant inschakelen en capabilities laten rapporteren;
5. fysieke hardwarematrix uitvoeren;
6. pas daarna breder beschikbaar stellen.

De feature is capability-gedreven. Oudere Androidversies krijgen de melding dat
de Player moet worden bijgewerkt. Web/PWA, LG webOS en generieke browsers tonen
Android-specifieke startfuncties als niet beschikbaar.

Rollback:

- schakel automatisering per scherm uit;
- rol de appdeploy terug; de database-uitbreiding is backward-compatible;
- verwijder de tab niet vóór alle settings zijn uitgeschakeld;
- draai geen destructieve down-migratie: histories en acceptatiebewijzen blijven
  intact voor analyse.

## Privacy-impact

Nieuw opgeslagen worden schema-instellingen, technische devicecapabilities,
uitvoertijden, commando-ID's en foutcodes. Er worden geen nieuwe advertentie-ID,
locatie, camera-, microfoon- of contactgegevens gebruikt. De Android-app vraagt
geen nieuwe permissie voor deze feature.
