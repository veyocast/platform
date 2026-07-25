# Google Play App access — invultemplate

Deze tekst bevat bewust geen credentials. Plaats de uiteindelijke gegevens
uitsluitend in `Play Console > App content > App access`.

## Werking voor de reviewer

De telefoon-, tablet- en Android TV-build horen bij dezelfde Play-app
`VeyoCast Player` met package `nl.veyocast.player`.

1. Installeer de artifact van de aangeboden form-factortrack.
2. Start `VeyoCast Player`. De app opent automatisch de production Player op
   `player.veyocast.nl`.
3. Een ongekoppeld apparaat toont een tijdelijke koppelcode.
4. Open VeyoCast Control met het afzonderlijk aangeleverde reviewaccount.
5. Kies de reviewvereniging en ga naar `Schermen`.
6. Maak of open het reviewscherm, kies koppelen en vul de zichtbare code in.
7. Na bevestiging haalt de Player de toegewezen immutable release op en start
   fullscreen playback.

## Extra Android TV-controle

1. Bevestig dat de app in het TV-appoverzicht als `VeyoCast Player` verschijnt
   en dat er geen tweede VeyoCast-app is.
2. Bedien pairing uitsluitend met D-pad en OK.
3. Druk tijdens video op OK om te pauzeren of hervatten.
4. Gebruik links en rechts om binnen de ondersteunde playback te navigeren.
5. Druk eenmaal BACK voor Playerbeheer.
6. Druk nogmaals BACK of kies `Terug naar Android` om naar Android Home te gaan.
7. Herstart de app en controleer dat pairing behouden blijft.
8. Onderbreek het netwerk kort en controleer dat een geldige lokale release
   blijft spelen en online herstel automatisch volgt.

## Privé aan Play Review verstrekken

- Control-URL;
- gebruikersnaam van een niet-productief reviewaccount;
- tijdelijk wachtwoord;
- TOTP-/MFA-instructie wanneer het account AAL2 vereist;
- naam van de reviewtenant en het reviewscherm;
- contactadres wanneer pairing of accounttoegang niet werkt.

Gebruik geen productiebeheerder en plaats nooit wachtwoorden, pairingtokens of
MFA-secrets in Git, release notes of de publieke store listing.
