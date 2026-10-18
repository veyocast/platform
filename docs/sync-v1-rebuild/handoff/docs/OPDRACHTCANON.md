# Opdrachtcanon · VeyoCast V1 Rebuild

Versie 2.0 · vastgesteld uit de gebruikersopdracht van 17 oktober 2026.

## 1. Doel

Bouw VeyoCast opnieuw op de developmentserver, met exact de huidige Sites-UI/UX van prototype 1 / Sync en de nieuwe publieke marketingwebsite. Behoud de werkende achterliggende logica en maak updates voor de bestaande Android-apps. Dit is een volledige rebuild met functiebehoud, geen beperkte MVP en geen lege demo-installatie.

De andere vier prototypevarianten zijn vervallen. FieldFlow en OnzeTrots TV zijn contentthema's en blijven allebei bestaan. Het opnieuw structureren van broncode geeft geen toestemming om benodigde functies, oude releasecompatibiliteit of operationele gegevens stil te laten verdwijnen.

Demo-, omgeving- en statusclaims zijn de gerichte uitzondering op letterlijke tekstovername: vervang uitsluitend aantoonbaar onjuist geworden prototypecopy (zoals “geen live dienst”, “voorbeeldaanvraag” of “alleen lokaal opgeslagen”) door feitelijk correcte productiecopy zodra de echte dienst werkt. Behoud layout, typografie, informatierangorde en interactie; dit staat geen algemene herschrijving of redesign toe.

## 2. Bindende afspraken

1. **Sites exact overnemen.** De vastgepinde bron, CSS, fonts, assets, responsive indelingen, interacties, paginaopbouw, modals en betekenis van statussen zijn de ontwerpautoriteit. Geen nieuwe interpretatie of alternatieve styling. Bestaande demo-opslag vervangen door echte services; voorbeelddata en demosucces gelden niet als productielogica.
2. **Dezelfde hero.** `brand-hero.png` en de bestaande WebP-varianten blijven de publieke hero en het opstartbeeld van players. Geen opnieuw gegenereerd logo, nieuwe kleurcorrectie of uitsnede die delen van het woordmerk weglaat. Native OS-splash en volledige player-opstart zijn aparte presentatielagen.
3. **Developmentserver.** Bouw, integratie en uitvoerbare verificatie vinden plaats op de developmentserver. Ontdek hostname, gebruiker, rootpaden, poorten en procesbeheer in de bestaande geautoriseerde omgeving. Verzin geen serveradres en maak een productiehost niet impliciet tot developmenthost.
4. **Oude developmentbestanden mogen weg.** De gebruiker heeft verwijderen van oude VeyoCast-/Castivo-mappen en -bestanden daar toegestaan. Stel eerst vast welke onderdelen werkelijk overbodig zijn en welke logica, configuratie, signingmaterialen, runtimebestanden of operationele data nog nodig zijn. Voer daarna de concrete cleanup zelfstandig uit; vraag niet opnieuw algemene toestemming voor deze reeds toegestane bronopruiming.
5. **GitHub opruimen.** Verwijder onnodige bestanden uit betrokken branches met gewone commits en normale integratie. Richt `archive/` in voor noodzakelijke kennis en een verwijdermanifest. Bewaar niet ieder ongebruikt bestand onder een andere naam. Branches wissen, geschiedenis herschrijven en force-push zijn geen onderdeel van 'onnodige bestanden verwijderen'.
6. **Deploy behouden.** Bestaande workflowcontracten, GitHub-environments, secret- en variabelnamen/waarden, runnerlabels, signingconfiguratie en deploysemantiek blijven intact. Verwijder geen secret omdat een nieuwe module hem nog niet gebruikt. Actualiseer alleen noodzakelijke bronpadverwijzingen met bewijs; vervangen door een nieuwe pipeline is niet de opdracht.
7. **Werkende logica behouden.** Bestaande API's, tenants, memberships, apparaat- en media-ID's, releases, planning, bronconfiguratie, betaalreferenties, migratiehistorie, pairing, offlinecache en herstelcontracten zijn te respecteren. Geen database-reset of herregistratie om de rebuild eenvoudiger te maken.
8. **Android is een update.** Behoud geverifieerde applicationId, signingcertificaat/updateketen en bestaande data. Neem het nieuwe app-icon mee. Player standaard/TV en Control worden afzonderlijk correct behandeld volgens het Androidcontract. Een nieuwe package-identiteit of uninstall/reinstall is geen acceptabele upgrade.
9. **SEO en aanvraagketen.** Neem de negen huidige publieke pagina's en metadata over, maak de aanvraagketen werkelijk servergestuurd en behoud duidelijke fouten/retry. Definitieve domeinconfiguratie volgt de bestaande omgeving; geen fictieve klantclaims of rankinggaranties.

## 3. Voorrang bij verschillen

| Type vraag | Leidende bron |
|---|---|
| Opdracht, toestemming en werkplek | Deze opdrachtcanon en actuele gebruikersinstructies. |
| Volledige V1-scope en invariant | `V1-REBUILD-CANON.md`, aangevuld met de functionele Sync-canon en oorspronkelijke repoanalyse. |
| Uiterlijk, assets en interactieopbouw | Exacte Sites-snapshots in `reference/`; geen historische UI of nieuw ontwerp. |
| Werkende runtime, API- en installatie-identiteit | Gecontroleerde actuele GitHub-bron, omgeving en geïnstalleerde app; gerapporteerde oude bugs zijn geen gewenst gedrag. |
| Al uitgevoerd testbewijs | Gedateerd testverslag met commit, omgeving, methode en resultaat. |

De oorspronkelijke documenten in de ongewijzigde referentiebron blijven als herkomst bewaard. Hun oude 'eerst lokaal' of algemene 'niet verwijderen'-formuleringen mogen de nu expliciet opgedragen developmentbouw en cleanup niet blokkeren. De eerdere stapsgewijze stagingcontrole blijft wel onderdeel van de bestaande releaseflow. Een nieuw ontdekte functionele tegenspraak wordt concreet geregistreerd en waar mogelijk binnen deze afspraken opgelost.

## 4. Grenzen die uit de opdracht volgen

Oude bron- en bouwbestanden mogen worden verwijderd. Het wissen van productiegegevens, actieve publicaties, provideraccounts, operationele media, signingkeys, secrets of noodzakelijk runtimeherstel volgt daar niet uit. Het pakket autoriseert geen automatische productiedeploy of inschakeling van nieuwe incasso-/restrictieflows. Voer alle development- en stagingwerk binnen de bestaande opdracht door; leg een concrete geteste release voor wanneer een afzonderlijke productieopdracht nodig is.

## 5. Gereed

Gereed betekent: developmentimplementatie, actuele bron in GitHub, aantoonbare functionele pariteit, exacte visuele overeenkomst, succesvolle bestaande deploygates, upgradebare Android-artifacts inclusief icon, LG-/offline-/duurtestbewijs, publieke SEO-/formulieracceptatie, beheerste cleanup en een bruikbaar rollbackpad. Een ontbrekende live- of apparaattest blijft expliciet open en wordt nooit met mockdata als geslaagd aangemerkt.
