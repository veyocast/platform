# Development, opruiming en archief

De cleanup is onderdeel van de opdracht en is al toegestaan voor aantoonbaar overbodige VeyoCast-/Castivo-bron- en bouwbestanden op development en in relevante GitHub-branches. Dit runbook maakt de uitvoering concreet. Het is geen opdracht om een volledige server of database leeg te maken.

## 1. Startinventaris op de developmentserver

Vul `execution/omgeving-inventaris.json` in met werkelijk gemeten waarden. Leg hostname/rol, source roots, Git-remotes/heads, werkbranch, worktrees, services, processes, poorten, reverse proxy, timers/cron, containers, bind mounts, volumes en resolved symlinktargets vast. Noteer of dezelfde host staging draagt. Gebruik bestaande toegang en instellingen; het pakket bevat geen verzonnen dev-IP of credentials.

Controleer niet-gecommitteerd en genegeerd werk voordat een directory verdwijnt. Een `.env`, keystore, lokaal uploadbestand of databasebestand kan ongetrackt zijn en toch essentieel. Noteer uitsluitend de beschermde locatie en het doel, nooit de inhoud van secrets. Leg de huidige werkende release en een bruikbare herstelreferentie vast.

De read-only GitHub-baseline bevat 178 branch-heads en 4.180 tree-entries op main. Actualiseer dit bij aanvang. Vergelijk van iedere branch unieke commits en relevante paden met de gekozen rebuildbasis; alleen de naam of ouderdom is geen verwijderbewijs. Branches met parallel werk worden via normale integratie bijgewerkt.

## 2. Beslismatrix per kandidaat

| Categorie | Handeling |
|---|---|
| Exacte nieuwe Sites-assets/UI | Behouden/overnemen; hash en visuele referentie vastleggen. |
| Werkende domeinlogica, provideradapter, playerfix | Overnemen of aantoonbaar gelijkwaardig vervangen; oude bron pas verwijderen als mapping en tests bestaan. |
| Compatibiliteitsdecoder, oude API nog gebruikt | Behouden totdat actieve/oude apps en opgeslagen publicaties geen afhankelijkheid meer hebben; overgang expliciet meten. |
| Deployworkflow, aangeroepen script, environmentconfig | Contract behouden. Noodzakelijke padwijziging via bestaande flow verifiëren; secret/variable/environments intact laten. |
| Productiedata, uploads, device-/release-identiteit, signing | Buiten bronopruiming; beschermen of verliesvrij migreren met een afzonderlijk gecontroleerd dataplan. |
| Historisch besluit, incidentkennis, contract | Korte bruikbare samenvatting/verwijzing in `archive/`; Git-commit als herleidbare bron. |
| Gegenereerde oude build, duplicate source, ongebruikte variant | Verwijderen zodra afhankelijke imports/services/workflows zijn vervangen en geen uniek werk verloren gaat. |
| Onbekende afhankelijkheid | Gericht onderzoeken; overige bewezen opruimbare paden gaan wel door. |

Vul `execution/opruimregister.csv` vóór en na de uitvoering in. Per regel: omgeving/branch, resolved pad, head/hash, type, actieve referenties, noodzakelijke kennis/data, opvolger, herstelreferentie, besluit, verificatie, verwijdercommit/tijd. Maak de reden toetsbaar; 'oud' is onvoldoende.

## 3. Archief dat de nieuwe repo helpt

Maak in de doelrepository één `archive/` met:

- README met doel, datum, voorrang van de nieuwe canon en wat nadrukkelijk geen runtime meer is.
- Branch-head- en verwijdermanifest, met commithashes waar oude bron terug te vinden is.
- Relevante beslissingen, mapping van oude naar nieuwe API/schema/module en incidentlessen voor offline/LG/Android/deploy.
- Alleen noodzakelijke niet-reproduceerbare bronreferenties waarvoor Git-history onvoldoende is; geen secrets, grote builds, dependencytrees of kopie van iedere oude app.

Het meegeleverde `archive/` is het model, niet een bewering dat de echte developmentopruiming al is uitgevoerd. Een apart beschermde rollbackvoorziening is geen map vol verouderde runtime in de nieuwe source tree. Migreer noodzakelijke DB-migratiehistorie of runtimecompatibiliteit niet naar een inert archief zolang uitvoering daarvan nodig blijft.

## 4. Uitvoering in controleerbare batches

1. Zet de nieuwe werkbasis op development neer en leg actuele baseline/rollback vast.
2. Breng per domein noodzakelijke logica over, verbind de exacte UI en verifieer de echte keten.
3. Schakel afhankelijke imports/buildcontexts/services naar de nieuwe implementatie. Controleer dat geen lopend proces, mount of symlink meer naar het kandidaatpad wijst.
4. Verwijder de beoordeelde overbodige bestanden in gewone Git-commits, met verwijdermanifest. Pas relevante bestaande branches via hun normale integratieroute aan. Geen force-push, history rewrite of brancheverwijdering.
5. Verwijder de bijbehorende oude developmentdirectories uitsluitend op opgeloste absolute paden uit het register. Bescherm configuratie/signing/data vóór de handeling. Gebruik geen naamwildcards over de server, geen serverbrede prune en geen volumes-prune.
6. Controleer imports, build, tests, services, assets, workflows en de gedeployde SHA. Vergelijk behoudsregisters voor deployment en Android.
7. Rapporteer wat is verwijderd, wat om concrete afhankelijkheden blijft, en welke branch/path nog onderzocht moet worden. Laat een batch niet als 'hele repo schoon' doorgaan.

Voer geen meegeleverde historische reset-/retention-/rolloutworkflow uit alleen omdat die in de baseline staat. Het behouden van de bestaande pipeline betekent niet dat elke operationele actie tijdens de rebuild nodig is.

## 5. Rollback en stopcriteria

Leg vóór iedere batch vast welk codecommit, releaseartifact, schema-/datastaat en configuratiecontract herstel mogelijk maken. Test het herstel van de applicatie zonder device-ID's, pairing of cache opnieuw aan te maken. Een code-rollback alleen is onvoldoende wanneer een nieuwe migratie de oude code onbruikbaar maakt; gebruik eerst compatibele migraties en bewijs read/write-compatibiliteit.

Stop uitsluitend de betreffende destructieve batch als een pad onvoorzien live data draagt, signing-/configmaterialen niet veilig zijn, een symlink/mount buiten de bedoelde scope uitkomt of uniek werk niet herstelbaar is. Los de afhankelijkheid op en voer daarna de al geautoriseerde cleanup uit. Herhaalde algemene toestemming voor dezelfde development-sourcecleanup is niet nodig.
