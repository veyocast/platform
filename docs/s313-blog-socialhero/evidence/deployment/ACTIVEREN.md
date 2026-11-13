# VeyoCast → SocialHero activeren

Deze handeling gebruikt uitsluitend de bestaande RPC's en een echte, persoonlijk geverifieerde platform owner/admin-sessie op AAL2. Er wordt geen systeemopsroute, nieuwe appfeature, extra rol of SQL-bypass toegevoegd. De softwaredeployment en de activering van deze verbinding worden afzonderlijk bewezen.

## Standalone operatorclient

De concrete client staat in [activate-veyocast.mjs](activate-veyocast.mjs). Hij vereist Node 24 en een echte interactieve POSIX-terminal en heeft geen dependencies of commandoregelargumenten:

```bash
node docs/s313-blog-socialhero/evidence/deployment/activate-veyocast.mjs
```

Alle invoer is verborgen: de publieke anon/publishable key van het vaste Supabase-project, het persoonlijke beheeradres en wachtwoord, zo nodig het nummer van een bestaande TOTP-factor, de actuele authenticatorcode, het nieuwe private overdrachtspad en de afsluitende bevestiging. De client weigert service-role-/secretkeys en bindt iedere aanvraag aan het vaste project of de vaste VeyoCast-origin. Hij maakt geen account, membership, MFA-factor of vervalste claims aan. Gebruik geen pipeline, shellargumenten of opname van de terminalsessie voor gevoelige invoer.

De credential komt alleen in een nieuw bestand met mode `0600`, in een map die alleen de operator kan benaderen (`0700`), buiten iedere Git-repository. De standaard is een uniek bestand onder `~/.local/state/veyocast-activation/`. Een bestaand bestand, symlink of onveilige map wordt geweigerd. Open het bestand uitsluitend lokaal voor overdracht aan het passwordveld van de bestaande SocialHero-wizard; print of deel de inhoud niet.

De client kiest voor deze concrete activering een geldigheidsduur van **90 dagen** en alle vijf hieronder genoemde scopes. Hij verifieert zelf de echte Supabase-identiteit en AAL2 en daarna VeyoCast-capabilities. Vervolgens wacht hij totdat de operator in SocialHero heeft opgeslagen en de alleen-lezen verbindingstest heeft voltooid. Alleen daarna typt de operator `GEREED`. Dit is een **menselijke attestatie van de SocialHero-wizard**; de client meet zelf uitsluitend VeyoCast-capabilities. Het is geen automatisch bewijs van SocialHero-vaultinhoud, een artikelpublicatie of een socialpost.

Na bevestiging controleert hij VeyoCast-capabilities opnieuw, verwijdert het tijdelijke credentialbestand en sluit uitsluitend zijn eigen nieuwe Auth-session. Bij een afgebroken handoff of fout probeert hij de exact aangemaakte credential via de unieke operatielabel/ID in te trekken en controleert hij die intrekking vóór het bestand te verwijderen. Kan de uitkomst van een write of revocation door netwerkverlies niet worden vastgesteld, dan faalt hij expliciet met `REVOCATION_UNCONFIRMED`, bewaart het private bestand en geeft alleen niet-geheime herstelmetadata. Meld die toestand niet als geactiveerd; herstel intrekking met een echte AAL2-sessie. Een proces dat abrupt wordt gedood kan geen netwerkcleanup garanderen.

De client is **niet tegen live Auth of production uitgevoerd**. De onderstaande geautomatiseerde controles gebruiken uitsluitend lokale mocks en tijdelijke bestanden, plus een echte lokale PTY voor no-echo:

```bash
node --test docs/s313-blog-socialhero/evidence/deployment/activate-veyocast.test.mjs
```

Uitkomst: **13/13 PASS**. Gedekt zijn vaste URL-/RPC-binding, weigeren van service-/foreignprojectkeys, echte Auth-/MFA-requestvormen met identiteits-/AAL2-controle, secretvrije fouten, mode `0600`, private map, no-clobber, symlink-/repositorygrens, mislukte handoff, bestemmingsverschil, after-COMMIT-timeout, intrekkingscontrole en onzeker herstel. Root heeft de client onafhankelijk gelezen en dezelfde 13 proeven groen uitgevoerd. Het PTY-bewijs sloot bovendien de prompt/echo-volgorderace: echo wordt uitgeschakeld vóór de prompt verschijnt.

De Auth-requestvormen zijn overgenomen uit de aanwezige vastgezette primaire clientbron `@supabase/auth-js@2.110.7/src/GoTrueClient.ts`: `signInWithPassword` (POST `/token?grant_type=password`), `getUser` (GET `/user`), `_listFactors` (geverifieerde factoren uit de echte userresponse), `_challenge`, `_verify` (`challenge_id` en `code`) en de refresh-tokenflow. Logout gebruikt de bestaande lokale scope uit `GoTrueAdminApi.ts`. Er worden geen server- of databasekeys gebruikt.

## Bestemming en voorwaarde

Production gebruikt site-ID `veyocast`, omgeving `production`, publieke en canonieke origin `https://veyocast.nl`, blogpad `/blog`, API-basis `/api/socialhero/v1`, contract `1` en locale `nl-NL`. Het actuele Supabase-productieproject is `gjmdqsukjfhmmblnmhqd`. Gebruik de oude project-ref uit het historische bootstrapdocument niet.

Controleer eerst de exacte gedeployde SHA en dat migratie `20261113124946` via de normale releaseflow aanwezig is. De database moet de nieuwe blogtabellen, private bucket en guarded RPC's bevatten. Controleer daarnaast dat SocialHero's eigen productieruntime is uitgerold en de bestaande servervault beschikbaar is.

Staging heeft momenteel geen eigen publieke Marketing-service. Configureer daar pas een site zodra een werkelijke afzonderlijke marketingorigin en bijbehorende runtimeconfiguratie zijn ingericht. Gebruik production niet als stagingbestemming en gebruik geen productiecredential in een andere omgeving.

## Persoonlijke sessie

De standalone operatorclient voert zelf een nieuwe echte wachtwoordlogin en authenticatorchallenge uit voor de bevoegde eigenaar/admin. Hij gebruikt uitsluitend de JWT van die nieuwe persoonlijke sessie, valideert de gebruiker met Supabase Auth en controleert AAL2 vóór de RPC's; de database controleert membership en AAL2 opnieuw. Vooraf inloggen in een Control-browser is daarvoor niet nodig.

Voor de gewone redactie, of een alternatieve reeds bestaande operatorroute die bewust een echte browsersessie gebruikt, logt de beheerder in op `https://control.veyocast.nl/login` en bevestigt zo nodig de authenticator via `/auth/mfa`. Dit is een afzonderlijk gebruikspad; voer het niet als extra MFA-stap vóór de standalone client uit.

Het verkrijgen en gebruiken van die sessie gebeurt uitsluitend op de beveiligde beheerwerkplek. Stuur geen wachtwoord, TOTP-code of JWT naar Codex, chat, een issue of log. Zet geen JWT-claims via SQL en maak geen Auth-session of platformmembership aan om deze handeling te omzeilen. Een service-role-, management- of database-admincredential vervangt deze sessie niet.

De geleverde Control-UI heeft nog geen site-/credentialsetupknop. Deze bestaande RPC-operatie moet daarom door de bevoegde operatorclient worden uitgevoerd; alleen de blogpagina openen voert haar niet uit. De onderstaande parameters zijn kopieerbaar en bevatten geen login- of credentialwaarden.

## 1. Site configureren

Roep via de geauthenticeerde Supabase-client `blog_configure_site` aan:

```json
{
  "p_site_id": "veyocast",
  "p_environment": "production",
  "p_public_origin": "https://veyocast.nl"
}
```

De verwachte veilige respons bevat uitsluitend dezelfde drie waarden. De operatie schrijft de bestaande auditactie `platform.blog.site.configured` met de echte actor. Een 403 betekent dat de echte sessie of bevoegdheid ontbreekt; herstel login/MFA en verruim geen rechten.

## 2. Eenmalige credential voorbereiden

De beveiligde operatorclient genereert cryptografisch willekeurig 48 bytes en codeert die als base64url zonder padding. De resulterende credential voldoet aan het vereiste bereik van 32–256 toegestane tekens. Bereken lokaal SHA-256 over exact die credential; alleen de 64 kleine hextekens van die hash gaan naar de database.

Houd de plaintext tijdens deze handeling in de beveiligde operatorcontext en draag haar eenmalig over aan het wachtwoordveld van SocialHero's bestaande wizard. Log of print haar niet, plaats haar niet in commandoregelargumenten of bewijs, en neem haar niet op in campagneconfiguratie. De handeling hoeft de plaintext niet aan Codex te tonen. Bewaar tot de bevestigde overdracht dezelfde oorspronkelijke credential, zodat een onderbroken handeling niet onnodig een andere credential maakt.

De concrete operatorclient kiest een unieke niet-geheime operatielabel en een UTC-vervalmoment **90 dagen** na de aanmaak. De bestaande databasegrens blijft maximaal 366 dagen, maar deze client vraagt geen langere duur aan. Leg alleen label, token-ID, scopes en vervaldatum vast in het operationele bewijs.

## 3. Hashcredential registreren

Roep met dezelfde echte AAL2-sessie `blog_manage_token` aan. Vervang uitsluitend de placeholders lokaal:

```json
{
  "p_site_id": "veyocast",
  "p_environment": "production",
  "p_action": "create",
  "p_token_id": null,
  "p_token_hash": "<64 kleine hextekens van de lokaal berekende SHA-256>",
  "p_label": "socialhero-production-<unieke-operatie-id>",
  "p_scopes": [
    "capabilities:read",
    "posts:read",
    "media:write",
    "posts:write",
    "posts:publish"
  ],
  "p_expires_at": "<UTC-vervalmoment 90 dagen na aanmaak>"
}
```

De respons bevat alleen `id` en `action`. Controleer de registratie met dezelfde RPC, uitsluitend deze parameters:

```json
{
  "p_site_id": "veyocast",
  "p_environment": "production",
  "p_action": "list"
}
```

De lijst bevat label, ID, scopes, vervaldatum en intrekkingsstatus; geen hash of plaintext. Controleer de unieke operatielabel en alle vijf scopes. Bij een onzekere netwerkuitkomst na create moet eerst deze metadata en een veilige geauthenticeerde capabilitiesaanvraag met de oorspronkelijke credential worden gecontroleerd. Maak niet blind een tweede credential. De token-create-RPC heeft geen algemene idempotency-key.

## 4. Eenmalig in SocialHero opslaan

Een werkruimtebeheerder opent in SocialHero production het VeyoCast-project en **Website en blog → Koppelen**; dezelfde wizard is bereikbaar onder **Websites / Blogpublicatie**. Vul in:

| Veld | Waarde |
|---|---|
| Websitebasis-URL | `https://veyocast.nl` |
| Omgeving | Productie |
| Koppelingstype | SocialHero Publicatie API v1 |
| Servercredential | De lokaal gegenereerde eenmalige credential |
| Standaardtaal | `nl-NL` |
| Standaardauteur | `redactie` / VeyoCast |
| Standaardcategorie | Een teruggegeven keuze, bijvoorbeeld `clubtv` |

Klik **Koppeling opslaan**. SocialHero bewaart de credential in zijn bestaande versleutelde servervault; zij wordt niet teruggetoond. Klik vervolgens **Verbinding testen (alleen lezen)**. Dit leest alleen capabilities en maakt geen artikel of afbeelding aan.

De controle moet `siteId=veyocast`, `environment=production`, `contractVersion=1`, `blogPath=/blog`, `publicOrigin=https://veyocast.nl` en dezelfde `canonicalOrigin` teruggeven. Media-, concept- en publicatierechten moeten aanwezig zijn. Wis de tijdelijke lokale overdracht pas na deze bevestiging; bewaar uitsluitend de niet-geheime registratiegegevens. Bij een bestemmings- of scopeverschil blijft de verbinding ongeverifieerd tot het verschil is hersteld.

## 5. Bewijs en eventuele vervolgaanvaarding

Leg de echte Control- en Marketing-release-SHA's, project-ref, site/omgeving, origin, migratieversie, token-ID/label/scopes/expiry en het resultaat van de alleen-lezen wizardcontrole vast. Neem geen JWT's, wachtwoorden, hashes of plaintextcredentials op. Een ontbrekende credential met API-respons 401 is uitsluitend bewijs van de actieve authgrens; het bewijst geen werkende verbinding.

Na de geslaagde wizardcontrole kan het bestaande goedkeurings-/planningspad een daadwerkelijk goedgekeurd artikel publiceren. Dat pad moet media en concept/revisie verwerken, publiceren en vervolgens domein, canonieke URL en het expliciete artikel-/revisiekenmerk controleren voordat afhankelijke socialposts vrijgegeven worden. Gebruik voor eventuele productiepublicatie uitsluitend daarvoor goedgekeurde inhoud; de expliciete concept-/mediatest in de wizard is voor een afgescheiden development-/stagingbestemming en verschijnt niet als productietestknop.

## Herstel en rotatie

Een verkeerde of onzekere verbinding kan in SocialHero worden gepauzeerd; dit laat afhankelijke taken wachten. Tokenrotatie gebruikt dezelfde echte AAL2-sessie en `blog_manage_token` met `p_action=rotate`, het huidige niet-geheime token-ID en een nieuw lokaal gegenereerde hash, label, dezelfde scopes en nieuwe beperkte expiry. De database trekt de oude credential transactioneel in. Sla de nieuwe plaintext daarna eenmalig in de bestaande SocialHero-wizard op en test opnieuw.

Intrekken zonder vervanging gebruikt `blog_manage_token` met site/omgeving, `p_action=revoke` en het exact bedoelde token-ID. Herstel van een artikelpublicatie gebruikt daarna dezelfde opgeslagen operatie en idempotency-key uit SocialHero; opnieuw instellen van een verbinding is geen toestemming om een nieuwe publicatierevisie of dubbel artikel te creëren.
