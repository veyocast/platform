# S53 — Android herinstallatie, autostart en LG pairingherstel

## Probleem

Een gewone Android-update behoudt appdata en daarmee de VeyoCast-koppeling.
**App verwijderen** wist daarentegen het volledige WebView-profiel:
`localStorage`, cookies, IndexedDB, Cache Storage en beide Playercredentials.
De serverbinding bleef bestaan, maar de opnieuw geïnstalleerde app kon die niet
veilig bewijzen en vroeg daarom terecht een nieuwe pairingcode.

## Gekozen herstelgrens

- Geen MAC-adres: niet betrouwbaar, vaak niet toegankelijk en geen
  autorisatiebewijs.
- De officiële Android-shell leest `ANDROID_ID`. Op Android 8+ is dit per
  signing key, gebruiker en apparaat gescheiden en blijft het bij een
  herinstallatie met dezelfde signing key stabiel.
- De shell hasht een domein-, environment- en application-ID-gebonden
  representatie en plaatst die alleen als first-party `Secure`, `HttpOnly`,
  `SameSite=Strict` cookie.
- De Player-API hasht opnieuw vóór PostgreSQL. Alleen de hash staat in
  `player_installations`.
- Bij geldig herstel blijven de Installation, Screen, tenant, playlist,
  planning en historie gelijk. Installatie- en devicecredentials worden
  atomair vervangen en uitsluitend in een `no-store` response teruggegeven.
- Revoked installations/devices, een factory reset, andere application ID of
  andere signing key herstellen niet automatisch.

## Updates

Google Play beheert automatische appupdates. Een app mag die gebruikers- of
devicepolicy niet zelf stil wijzigen. **Playerbeheer → Automatische updates
instellen** opent daarom de officiële VeyoCast Player-detailpagina in Google
Play, waar de gebruiker automatische updates kan activeren. Voor beheerde
signagevloten blijft EMM/Managed Google Play met een onderhoudsvenster de
sterkste route.

## Waarom Android-versie `.10` autostart niet bewees

De gepubliceerde interne `.10` bevatte alleen de eerste best-effort
bootreceiver. Vier concrete defecten maakten de getoonde uitkomst te
optimistisch:

1. `startActivity()` zonder exception werd als geslaagd beschouwd, terwijl
   Android een background activity launch ook stil kan weigeren;
2. `player-visible` werd al vanuit `onCreate()` vastgelegd, vóórdat de Activity
   werkelijk `resumed` was;
3. `ACTION_MY_PACKAGE_REPLACED` plande alleen het schema opnieuw en startte de
   Player niet na een normale Play-update;
4. een gecachte Control-configuratie onderdrukte de lokale fysieke
   autostartschakelaar volledig.

De nieuwe shell laat de lokale schakelaar en het actieve Control-schema naast
elkaar gelden, behandelt zowel boot als package replacement, gebruikt de
expliciete Android 14–17 `PendingIntent`-opt-ins en bevestigt pas succes vanuit
een werkelijk hervatte Activity. Een aparte receiver zet de poging na dertig
seconden op `BACKGROUND_START_NOT_VISIBLE` wanneer Android de UI niet toont.
Die laatste status staat zichtbaar in Playerbeheer. Production en staging
hebben autostart voor nieuwe installaties standaard aan; de gebruiker kan dit
nog steeds uitschakelen.

Android beperkt achtergrondstarts sinds Android 10. Zonder device-owner,
dedicated launcher of OEM-signagebeleid kan een gewone Play-app daarom geen
absolute bootgarantie afdwingen. VeyoCast detecteert en rapporteert die grens
nu eerlijk. **Android-appinstellingen openen** biedt de directe route naar het
apparaatbeleid; voor een harde signagegarantie blijft managed kiosk/default
launcher de platformroute.

## Waarom de LG-recovery niet werkte

De zelfstandige pagina verwijderde lokale pending state en schreef een korte
marker, maar stap 4 maakte zelf geen installatie- of pairingsessie. Daarna
navigeerde zij ook bij een mislukte servermelding naar `/lg`, terwijl de
normale runtime die marker niet consumeerde. Daardoor kwam hetzelfde
`PAIRING_API_UNAVAILABLE`-scherm terug.

De herstelpagina registreert de behouden installatie nu zelf, trekt de oude
pending sessie met pending- óf installatiecredential in en vraagt vóór de
redirect een atomaire nieuwe code aan. Code, pending token en expiry worden
opgeslagen en de marker wordt eenmaal geconsumeerd. Vier begrensde pogingen
zijn toegestaan. Een blijvende 503 blijft zichtbaar op `/lg/recover`, activeert
de knoppen opnieuw en verwijdert geen mogelijk geldige schermbinding.

Iedere staging- en productiondeployment voert voortaan na de migratie een
echte installation → pairing → recover-smoke uit tegen de publieke Player-URL.
De tijdelijke databasegegevens worden in dezelfde gecontroleerde stap
opgeruimd. De smoke verifieert ook dat `/lg/recover` geen Next-clientchunks
nodig heeft.

## Nog fysiek te bewijzen

1. Installeer een Play-signed productionbuild en koppel hem.
2. Voer een normale Play-update uit; de koppeling moet blijven staan.
3. Verwijder de app volledig en installeer dezelfde productionapp opnieuw.
4. Controleer dat dezelfde Screen zonder nieuwe code terugkomt.
5. Controleer dat playlist, planning en historie ongewijzigd zijn.
6. Trek daarna het device in Control in en herinstalleer opnieuw; automatische
   recovery moet dan veilig weigeren.
7. Open Playerbeheer en controleer dat de updateactie de juiste Play-detailpagina
   opent.
8. Herstart het Android-apparaat en controleer dat `Laatste controle: Player
   zichtbaar gestart` verschijnt; wanneer Android blokkeert moet de concrete
   blokkadestatus verschijnen.
9. Open op de LG `/lg/recover`, controleer de vier zichtbare stappen en claim
   de nieuwe code binnen dertig seconden.

## Lokale verificatie

- Workspace lint, typecheck en unit: telkens 25 van 25 taken groen;
  production build 15 van 15 groen.
- Player: 25 testbestanden en 95 tests groen; production build inclusief
  webOS-compatibiliteits- en secret-scan groen.
- Database reset: migration toegepast.
- RLS: 39 bestanden en 746 assertions groen, inclusief 22 gerichte
  herinstallatie- en recoveryasserties.
- Android general en TV: production lint, unitvarianten, debug-APK's en
  geminificeerde production-AAB's groen. Bundletool- en DEX-inspectie bewijzen
  beide launchers, boot/package-replaced receivers en de behouden
  launch-/zichtbaarheidsverificatiecode.
- Browser: 29 van 29 a11y-/viewportchecks en 26 van 26 uitvoerbare functionele
  E2E-checks groen; alleen twee lokaal credential-afhankelijke live-pilots zijn
  overgeslagen. De vijf gerichte recoveryjourneys bewijzen soft/hard recovery,
  een nieuwe code, fouttolerante Cache/IndexedDB-cleanup en een blijvende 503
  zonder valse redirect.
- Deployworkflow-, VPS-, shell- en statische securityvalidatie groen.
