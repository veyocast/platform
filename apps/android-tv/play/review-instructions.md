# Google Play App access — invultemplate

Deze tekst bevat bewust geen credentials. Plaats de uiteindelijke gegevens
uitsluitend in `Play Console > App content > App access`.

## Werking voor de reviewer

1. Start `VeyoCast Player` op een Android TV-apparaat.
2. De app opent automatisch de production Player op `player.veyocast.nl`.
3. Een ongekoppeld apparaat toont een tijdelijke koppelcode.
4. Open VeyoCast Control met het afzonderlijk aangeleverde reviewaccount.
5. Kies de reviewvereniging en ga naar `Schermen`.
6. Maak of open het reviewscherm, kies koppelen en vul de zichtbare code in.
7. Na bevestiging haalt de Player de toegewezen immutable release op en start
   fullscreen playback.

## Privé aan Play Review verstrekken

- Control-URL;
- gebruikersnaam van een niet-productief reviewaccount;
- tijdelijk wachtwoord;
- TOTP-/MFA-instructie wanneer het account AAL2 vereist;
- naam van de reviewtenant en het reviewscherm;
- contactadres wanneer pairing of accounttoegang niet werkt.

Gebruik geen productiebeheerder en plaats nooit wachtwoorden, pairingtokens of
MFA-secrets in Git, release notes of de publieke store listing.
