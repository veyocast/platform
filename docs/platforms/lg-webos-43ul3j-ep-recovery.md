# LG 43UL3J-EP installatie- en autostart-herstel

## Status en bewijsgrens

Doelapparaat:

```text
Model: LG 43UL3J-EP
webOS Signage: 6.0
Firmware: 03.24.90
Productie-app: nl.veyocast.player.webos 1.0.1
Smoketest-app: nl.veyocast.player.webos.smoketest 1.0.1
```

De bron, officiële packageworkflow, twee IPK's, checksums en live
hosted-routecontrole zijn geautomatiseerd bewezen. Installatie, registratie en
autostart op dit fysieke scherm blijven **nog fysiek te valideren**. Een
factory reset en het onbekende beheerwachtwoord zijn voor dit protocol niet
nodig.

## Root-causeanalyse van 1.0.0

De oude IPK was niet door een eigen VeyoCast `ar`/`tar`-builder gemaakt. De
repository gebruikte al het officiële `ares-package` uit
`@webos-tools/cli@3.2.5` met profiel `signage`.

De inspectie bewees wel twee concrete packageproblemen:

1. de officiële CLI 3.2.5 bevat upstream nog letterlijk de TODO-waarde
   `webOS-Packager-Version: x.y.x`;
2. de CLI nam host-UID, hostnaam en ruime bronrechten over, waardoor entries
   onder meer als `codex/1001`, `0777` en `0666` in het pakket kwamen.

De repository bevat daarom een smalle pnpm-patch op exact CLI 3.2.5. Deze
vervangt de placeholder door `3.2.5`, zet package-eigenaar op `0/0`, gebruikt
`0755` voor mappen en `0644` voor bestanden en fixeert archieftijden op de
Git-committijd. De IPK blijft volledig door de officiële `ares-package`
workflow gebouwd; VeyoCast assembleert geen IPK met `ar`, `tar`, `dpkg` of een
eigen builder.

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
https://veyocast.nl/ipk/nl.veyocast.player.webos.smoketest_1.0.1_all.ipk

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
   https://veyocast.nl/ipk/nl.veyocast.player.webos.smoketest_1.0.1_all.ipk
   ```

7. Start de externe lokale applicatie-upgrade.
8. Verwacht letterlijk **Upgrade voltooid**. Maak een foto van een andere
   melding en stop bij een fout.
9. Controleer dat **Startmodus applicatie: Lokaal** nog steeds geselecteerd is.
10. Sluit het instellingenmenu.
11. Schakel het display uit. Haal voor een echte koude start de netstekker
    dertig seconden los, sluit hem weer aan en schakel het display in.

Verwacht:

- binnen 5 seconden: een lokale zwarte/oranje VeyoCast-testpagina;
- binnen 15 seconden: `VeyoCast LG-test gestart` en een oplopende teller;
- binnen 30 seconden: de teller loopt nog en datum/tijd, user-agent,
  resolutie, online-status en visibility-state zijn ingevuld.

Druk daarna op alle pijlen, OK, BACK en play/pause. Iedere toets moet onder
**Laatste afstandsbedieningsinput** verschijnen. Deze test gebruikt geen
internet, iframe of backend. Start hij niet, dan zit het probleem in LG-
registratie, packageacceptatie of de lokale startmodus.

### B. Productie-wrapper installeren

1. Open opnieuw **SI Server-instelling**.
2. Behoud **Applicatietype: IPK** en **Startmodus applicatie: Lokaal**.
3. Kies **Lokale applicatie-upgrade: Extern**.
4. Vervang alleen de URL door:

   ```text
   https://veyocast.nl/ipk/nl.veyocast.player.webos_1.0.1_all.ipk
   ```

5. Start de upgrade en verwacht **Upgrade voltooid**.
6. Voer opnieuw de koude start van dertig seconden uit.

Verwacht:

- binnen 5 seconden: `VeyoCast Player wordt gestart` met Stap 1 zichtbaar;
- binnen 15 seconden: netwerk- en iframe-status zijn bijgewerkt;
- binnen 30 seconden: de pairing-/Playerinterface is zichtbaar, of de lokale
  diagnosepagina noemt één concrete foutcategorie met **Opnieuw proberen**.

Druk BACK om Playerbeheer te openen. Controleer dat app
`nl.veyocast.player.webos · 1.0.1`, netwerkstatus, laatste fout en retryteller
zichtbaar zijn. BACK of **Terug naar Player** sluit het paneel.

### C. Oude versie veilig vervangen

Versie 1.0.1 gebruikt dezelfde productie-app-ID als 1.0.0 en een hogere
semantische versie. Installeer 1.0.1 via exact stap B. Verwijder appdata niet:
daardoor kan de HTTPS-originopslag met pairing en cache behouden blijven. Als
LG 1.0.1 weigert, noteer de letterlijke melding; voer geen factory reset uit en
installeer niet opnieuw onder een andere productie-app-ID.

### D. Vereist foutbewijs

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
