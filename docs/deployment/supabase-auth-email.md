# Supabase Auth e-mail voor VeyoCast

## Productiegrens

Control verstuurt tenant- en platformuitnodigingen via Supabase Auth
`inviteUserByEmail`. SMTP-wachtwoorden horen daarom uitsluitend in het
production Supabase-project. Zet ze niet in GitHub, de VPS, `.env`-bestanden,
supporttickets of de repository.

Supabase' ingebouwde maildienst is niet geschikt voor productie. Zonder Custom
SMTP worden alleen adressen van Supabase-organisatieleden geaccepteerd en geldt
een zeer lage projectlimiet. Control bewaart een weigering privacyveilig als
een foutcode en laat de tenant herstelbaar bestaan.

## Production instellen

Selecteer in Supabase expliciet production project
`uuyelumptrfwuqwzkwsd`.

1. Open **Authentication → URL Configuration**.
2. Zet **Site URL** op `https://control.veyocast.nl`.
3. Voeg `https://control.veyocast.nl/auth/confirm` toe aan de redirect-URL's.
4. Open **Authentication → Email → SMTP Settings** en schakel Custom SMTP in.
5. Gebruik een echt VeyoCast-afzenderadres waarvan de mailbox en
   inloggegevens onder beheer van VeyoCast staan.
6. Gebruik bij Hostnet:
   - host `smtp.hostnet.nl`;
   - poort `587`;
   - gebruikersnaam: het volledige afzenderadres;
   - wachtwoord: het mailboxwachtwoord;
   - STARTTLS;
   - sender name `VeyoCast`.
7. Plaats de inhoud van `supabase/templates/invite.html` in de hosted
   **Invite user**-template.
8. Plaats de inhoud van `supabase/templates/recovery.html` in de hosted
   **Reset password**-template.
9. Controleer onder **Authentication → Rate Limits** een passende begrensde
   mailfrequentie. Verhoog deze niet verder dan operationeel nodig.

Maak bij voorkeur een afzonderlijke mailbox zoals `noreply@veyocast.nl`. Als
die mailbox nog niet bestaat, maak hem eerst in Hostnet aan. Gebruik niet
zonder controle het wachtwoord van een persoonlijke mailbox.

## Veilige hersteltest

1. Open in Control **Platform → Tenants → [vereniging] → Uitnodigingen**.
2. Kies bij de mislukte pending uitnodiging **Nieuwe link versturen**.
3. Control trekt de oude token in en maakt één nieuwe persoonlijke link.
4. Controleer dat de bezorgstatus `Verstuurd` wordt.
5. Open de e-mail en accepteer de uitnodiging.
6. Controleer dat de uitnodiging `Geaccepteerd` wordt en dat de gebruiker
   uitsluitend de bedoelde tenant kan openen.

Bij een nieuwe fout toont Control één van deze veilige categorieën:

- SMTP niet ingericht;
- verzendlimiet bereikt;
- account bestaat al;
- e-mailprovider uitgeschakeld;
- provider onbereikbaar;
- verzending mislukt.

Bekijk voor de onderliggende providerrespons uitsluitend **Supabase Auth
Logs**. Kopieer geen e-mailadres, token, volledige link of SMTP-secret naar
applicatielogs.

Een herstel-URL bevat tijdelijke accounttokens. Deel zo'n URL nooit in chat,
screenshots, logs of tickets. Wanneer dit toch gebeurt, trek alle sessies van
de gebruiker direct in en vraag een nieuwe herstelmail aan.

## Bestaand account

Supabase Auth kan een bestaand Auth-account niet opnieuw met
`inviteUserByEmail` aanmaken. Wanneer Control `Account bestaat al` toont, maak
dan niet steeds nieuwe uitnodigingen. Dit pad vereist een aparte,
toestemmingsgebonden accountkoppeljourney; direct membership toekennen op basis
van alleen een e-mailadres is nadrukkelijk niet toegestaan.
