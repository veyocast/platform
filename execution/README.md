# Registers voor de uitvoerende Codex

De bestanden hier zijn werkregisters voor de echte developmentuitvoering. Lege velden en status 'nog niet bewezen' zijn bewust geen voltooiingsclaim.

- `omgeving-inventaris.json`: werkelijke dev-host, paden, services, data/config en herstelreferenties invullen. Geen geheimen.
- `scenario-acceptatie.csv`: alle 148 prototype-ID's, met productievertaling, implementatie en bewijs. Vul per regel de echte opvolgende commit en testresultaten in.
- `opruimregister.csv`: concrete paden/branches, actieve afhankelijkheden, opvolger, herstel en uitgevoerde verwijdering.
- `configuratiebehoud.csv`: vóór/na naam/scopecontract van environments, secrets, variabelen en benodigde operationele instellingen; nooit waarden.
- `visuele-acceptatie.csv`: referentie/rebuild/screenshots/diff onder dezelfde omstandigheden.
- `android-upgrade.csv`: geïnstalleerde en nieuwe package-/versie-/publieke signingmetadata, gegevensbehoud en fysieke tests.

De feitelijke read-only nulmeting staat onder `reference/legacy-baseline/`. Gebruik die als startpunt, maar actualiseer heads, settings en omgeving voordat de uitvoeringsregisters worden ingevuld.
