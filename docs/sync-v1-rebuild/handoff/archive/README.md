# Compact archive voor de doelrepository

Neem dit model over als `archive/` in de VeyoCast-rebuildrepository en vul het tijdens de uitvoering in. De echte repository en developmentserver zijn bij het samenstellen van dit pakket niet opgeschoond.

Bewaar hier bruikbare besluiten, API/schema-/modulemapping, player-/LG-/Androidincidentlessen, broncommitverwijzingen, de actuele branch-headinventaris en het definitieve verwijdermanifest. Verwijs voor oude bron naar herstelbare Git-history of een beheerde noodzakelijke snapshot.

Bewaar hier geen secrets, `.env`-inhoud, signingkeys, dependencies, complete oude applicatiekopieën of grote gegenereerde builds. Verplaats actief benodigde code en migratiehistorie niet naar een inert archief. Onnodige bestanden moeten daadwerkelijk uit de actieve branches verdwijnen.

Voorrang: `docs/OPDRACHTCANON.md` en `docs/V1-REBUILD-CANON.md` in dit pakket. Oude documenten zijn historische feiten, geen hernieuwde instructie om lokaal/WSL te bouwen of cleanup te verbieden.

Aanbevolen index na uitvoering: `bronverwijzingen.json`, `branch-heads.json`, `verwijdermanifest.csv`, `contractmapping.md`, `besluiten.md` en `incidentlessen.md`. Vul echte waarden in; creëer geen fictieve voltooiingsbewijzen.
