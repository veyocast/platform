# LG 43UL3J-EP installatie- en autostart-herstel

## Status en bewijsgrens

Doelapparaat:

```text
Model: LG 43UL3J-EP
webOS Signage: 6.0
Firmware: 03.24.90
Productie-app: nl.veyocast.player.webos 1.0.1
Smoketest-app: nl.veyocast.player.webos.smoketest 1.0.2
```

Productie 1.0.1 gaf op dit scherm `IPK-upgrade mislukt` en blijft bevroren.
De nieuwe 1.0.2 is uitsluitend een lokale package-/launch-smoketest.
Installatie en autostart blijven **nog fysiek te valideren**. Een factory reset
is voor dit protocol niet nodig.

Nieuwe fysieke waarneming op 26 juli 2026:

```text
1. Lokale applicatie-upgrade: Extern
2. Smoketest 1.0.2: Upgrade voltooid
3. Display uit en weer aan
4. Melding: Failed to upgrade IPK APP
5. De lokale smoketestpagina werd niet zichtbaar
```

Dit bewijst dat de handmatige download/verwerkingsstap wordt geaccepteerd, maar
nog niet dat de appregistratie en lokale launch de koude start overleven. Het
onderscheid tussen **Extern als upgradebron** en **Lokaal als startmodus** moet
nu op het apparaat worden vastgelegd. Een eventuele automatische upgrade bij
boot wordt eerst geïsoleerd; er wordt hiervoor geen nieuw pakket gebouwd.

## Root-causeanalyse van 1.0.1

Zowel 1.0.0 als 1.0.1 zijn als normaal IPK te lezen. De productie-URL van 1.0.1
geeft direct 200, de download is bytegelijk aan het committed bestand en alle
interne app-ID's en versies kloppen.

De releaseketen wijkt wel op twee aantoonbare punten af:

1. een lokale pnpm-patch veranderde voor 1.0.1 de packagerwaarde, tar-eigenaar,
   rechten en archieftijden ten opzichte van de door LG geaccepteerde 1.0.0;
2. het publieke 1.0.1-bestand heeft een andere SHA-256 dan het artifact van de
   laatste main-CI.

De precieze LG-installerfoutcode is zonder devicelogs niet beschikbaar. Daarom
wordt niet één veld gegokt: de eigen patch is volledig verwijderd en smoketest
1.0.2 gebruikt de ongewijzigde officiële `@webos-tools/cli@3.2.5` met profiel
`signage`, overeenkomstig de geaccepteerde 1.0.0-envelope. De volledige
audit staat in
[`docs/incidents/2026-07-26-lg-ipk-1.0.1-installation-audit.md`](../incidents/2026-07-26-lg-ipk-1.0.1-installation-audit.md).

`Upgrade voltooid` bewijst alleen download en verwerking. Het bewijst geen
launch. webOS start een geïnstalleerde lokale app na inschakelen alleen via de
apparaatconfiguratie. Voor deze test moet **Startmodus applicatie = Lokaal**
blijven staan. `Geen` start geen app. Er is geen onbewezen `appinfo.json`-
autostartveld of niet-gedocumenteerde SCAP-call toegevoegd.

## Package- en startketen

```text
appinfo.json
  -> officiële @webos-tools/cli 3.2.5 / ares-package / signage
  -> geïnspecteerde IPK met control + packageinfo + appbestanden
  -> immutable HTTPS-URL
  -> SI Server Lokale applicatie-upgrade: Extern
  -> Startmodus applicatie: Lokaal
  -> lokale index.html
```

Productie toont altijd eerst lokaal:

```text
VeyoCast Player wordt gestart
Stap 1: lokale applicatie gestart
Stap 2: netwerk controleren
Stap 3: hosted Player openen
```

Pas na het gevalideerde bericht
`VEYOCAST_LG_PLAYER_READY`, protocol `1`, pad `/lg`, vanuit exact
`https://player.veyocast.nl` verdwijnt deze lokale pagina.

De veilige diagnostiek toont app-ID/versie, gesaneerde URL zonder querystring,
user-agent, netwerk, iframe-load/error, message-aantal en origin, timeout,
retryteller, laatste fout, laatste wijziging en de vorige lokaal opgeslagen
opstartstatus. Pairingcodes, tokens, cookies en media-URL's worden niet
opgeslagen of getoond.

## Hosted Player-audit

Audit op 26 juli 2026:

| Controle | Resultaat |
|---|---|
| `https://player.veyocast.nl/lg` | HTTP 200 |
| Redirects | 0 |
| Content-Type | `text/html; charset=utf-8` |
| `X-Frame-Options` | afwezig |
| CSP `frame-ancestors` | `file:` |
| READY-bridge in production-JavaScript | aanwezig |
| Verwacht protocol/pad | `1` / `/lg` |
| Verwachte child-origin | `https://player.veyocast.nl` |
| Verwachte wrapper-origin in child | opaque `null` van lokale `file:`-app |
| TLS-certificaat | publiek vertrouwd; CN `player.veyocast.nl` |
| TLS-keten | OpenSSL verify code 0 |

De iframe-architectuur blijft behouden omdat de live headers framing vanuit de
lokale app bewust toestaan en alle andere Playerroutes framing blokkeren. Het
iframe is nodig om pairing, IndexedDB, Cache Storage en last-known-good onder
de bestaande HTTPS-origin te behouden.

Of firmware `03.24.90` `frame-ancestors file:` en third-party
originopslag exact zo uitvoert, kan alleen fysiek worden bewezen. Wanneer de
smoketest start maar productie consequent `IFRAME_BLOCKED` of `READY_TIMEOUT`
rapporteert, volgt een afzonderlijk architectuurbesluit over top-level
navigatie. Dat besluit wordt niet op aannames genomen.

De browser kan bij een generieke cross-origin laadfout niet altijd onderscheid
maken tussen DNS en TLS. De wrapper toont `TLS_ERROR` wanneer de engine een
certificaat-/SSL-/TLS-signaal geeft; anders `DNS_HOST_UNREACHABLE`. De
CI-controle valideert TLS en DNS buiten het device afzonderlijk.

## Immutable downloads

```text
Productie:
https://veyocast.nl/ipk/nl.veyocast.player.webos_1.0.1_all.ipk

Smoketest:
https://veyocast.nl/ipk/nl.veyocast.player.webos.smoketest_1.0.2_all.ipk

Checksums:
https://veyocast.nl/ipk/checksums.sha256
```

De workflow controleert HTTP 200, nul redirects, Content-Type,
Content-Length en SHA-256 nadat een goedgekeurde HTTPS-upload is uitgevoerd.

## Exact fysiek testprotocol

### A. Zelfstandige smoketest installeren

1. Open **SI Server-instelling**.
2. Laat **Volledig gekwalificeerde domeinnaam** aan staan.
3. Kies **Applicatietype: IPK**.
4. Zet **Startmodus applicatie: Lokaal**.
5. Kies bij **Lokale applicatie-upgrade: Extern**.
6. Vul exact deze URL in:

   ```text
   https://veyocast.nl/ipk/nl.veyocast.player.webos.smoketest_1.0.2_all.ipk
   ```

7. Start de externe lokale applicatie-upgrade.
8. Verwacht letterlijk **Upgrade voltooid**. Maak een foto van een andere
   melding en stop bij een fout.
9. Open na de melding opnieuw de volledige **SI Server-instelling**.
10. Controleer dat **Startmodus applicatie: Lokaal** geselecteerd is. `Extern`
    hoort alleen bij **Lokale applicatie-upgrade** en mag niet de startmodus
    zijn.
11. Zet voor deze isolatietest **Automatisch instellen: Uit**. Dit is tijdelijk:
    zo kan de koude start de reeds geïnstalleerde lokale app testen zonder
    tegelijk opnieuw een externe upgrade te proberen.
12. Druk niet opnieuw op **Extern** en wijzig de immutable URL niet.
13. Sluit het instellingenmenu.
14. Schakel het display uit. Haal voor een echte koude start de netstekker
    dertig seconden los, sluit hem weer aan en schakel het display in.

Verwacht:

- binnen 5 seconden: een lokale zwarte/oranje VeyoCast-testpagina;
- binnen 15 seconden: `VeyoCast LG smoketest 1.0.2` en een oplopende teller;
- binnen 30 seconden: de teller loopt nog en datum/tijd, user-agent,
  resolutie, online-status en visibility-state zijn ingevuld.

Druk daarna op alle pijlen, OK, BACK en play/pause. Iedere toets moet onder
**Laatste afstandsbedieningsinput** verschijnen. Deze test gebruikt geen
internet, iframe of backend. Start hij niet, dan zit het probleem in LG-
registratie, packageacceptatie of de lokale startmodus.

Interpretatie van deze isolatietest:

- start 1.0.2 nu wel, dan kwam de eerdere rebootmelding uit een nieuwe
  automatische upgradepoging en niet uit de reeds draaiende smoketest;
- verschijnt opnieuw `Failed to upgrade IPK APP`, leg dan Startmodus,
  Automatisch instellen, URL en het tijdstip op één fotoserie vast; zonder
  LG-installatielog is nog niet bewezen of registratie of validatie faalt;
- verschijnt alleen de normale input zonder fout of smoketest, dan is de lokale
  launch niet actief geworden en moet de modelconfiguratie worden onderzocht.

Laat **Automatisch instellen** na deze test uit tot vaststaat hoe firmware
03.24.90 versiecontrole en herinstallatie bij boot uitvoert. Dit is een
diagnostische maatregel, geen definitieve productieconfiguratie.

### B. Stop na de smoketest

Installeer productie 1.0.1 niet opnieuw als onderdeel van deze hersteltest.
Rapporteer eerst of 1.0.2 letterlijk **Upgrade voltooid** toont en na de koude
start opent. Pas na beoordeling van dat fysieke bewijs wordt een nieuwe
productiekandidaat gebouwd.

### C. Bestaande productie-installatie behouden

Verwijder de bestaande productie-appdata niet. Daardoor kan pairing en cache
behouden blijven. Publiceer of installeer geen nieuwe productieversie voordat
de smoketest fysiek is afgetekend. Gebruik nooit een andere productie-app-ID
als omweg.

### D. Vereist fysiek bewijs

Maak bij een afwijking:

1. foto van model, webOS-versie en firmware;
2. foto van de volledige SI Server-instellingen met de URL zichtbaar;
3. foto van de letterlijke upgrade-/registratiemelding;
4. foto op 5, 15 en 30 seconden na koude start;
5. foto van het lokale diagnosepaneel;
6. notitie welke remote-toetsen wel/niet aankwamen;
7. tijdstip en of netwerk via kabel of wifi liep.

Maak pairingcodes, tokens of volledige media-URL's onleesbaar voordat bewijs
wordt gedeeld.

## URL-herstel zonder IPK of beheerwachtwoord

S48 voegt een herstelpad toe dat losstaat van de lokale IPK-installatie. Het
is bedoeld voor de huidige configuratie:

```text
EZ Instelling
→ Afspelen via URL
→ https://player.veyocast.nl/lg/recover
```

De response is eenvoudige server-HTML zonder React-hydration of normale
Playerchunks. Soft recovery bewaart de anonieme installatie-ID en een
aantoonbaar geldige schermcredential, annuleert alleen de oude pending
pairingpoging, ruimt gerichte Playercaches op en gaat eenmaal terug naar
`/lg`. Een afzonderlijk bevestigde **Volledige playerreset** vernieuwt ook de
installatie-ID.

Na deployment geldt dit fysieke protocol:

1. open `https://player.veyocast.nl/lg/recover` via **Afspelen via URL**;
2. verwacht **VeyoCast Player herstellen** en vier zichtbare herstelstappen;
3. controleer dat iedere stap eindigt als `OK` of niet-blokkerende waarschuwing;
4. verwacht automatische navigatie naar `/lg`;
5. verwacht binnen maximaal dertig seconden een nieuwe code;
6. claim de code in Control voor het bestaande scherm;
7. herstart het display volledig en controleer dat dezelfde koppeling blijft;
8. laat daarna een ongeclaimde code verlopen en controleer dat zonder reload
   een andere code verschijnt;
9. houd op een vastloopscherm OK acht seconden ingedrukt, of gebruik
   `OK, OK, OK, BACK, OK`, en controleer het lokale herstelmenu.

Dit protocol vereist geen factory reset, ontwikkelaarsmodus, USB-installatie,
nieuwe IPK of bekend LG-beheerwachtwoord. De software-implementatie is lokaal
gevalideerd; productiondeployment en de uitvoering op firmware 03.24.90
blijven expliciet af te tekenen.
