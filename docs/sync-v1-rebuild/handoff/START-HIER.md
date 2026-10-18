# VeyoCast · V1 Rebuild · Codex-overdracht

Versie 2.0 · 17 oktober 2026 · Opdracht: een nieuwe implementatie met de exacte huidige Sites-interface en behoud van de werkende VeyoCast-logica.

**Geef Codex dit volledige pakket en laat het beginnen met `CODEX-STARTPROMPT.md`.** De startprompt bevat een uitvoerbare opdracht; `docs/OPDRACHTCANON.md` legt de laatste afspraken bindend vast. `docs/V1-REBUILD-CANON.md` omvat de volledige V1. Dit pakket vervangt de instructies uit het eerdere Sync-handoverpakket.

## De afspraken in één overzicht

| Onderwerp | Vast besluit |
|---|---|
| Ontwerp | Alleen prototype 1 / Sync. Huidige Sites-UI, UX, beelden, fonts, teksten, componenten, statussen en responsive gedrag exact overnemen. |
| Hero | Het bestaande 3D Screen Sync-beeld op publieke marketing én player-opstart. Origineel en WebP-varianten zijn inbegrepen. |
| Bouwomgeving | Bouwen en integreren op de developmentserver. Eerst werkelijke host, paden en actieve processen vaststellen. |
| Opruimen development | Oude VeyoCast-/Castivo-bron- en bouwbestanden mogen weg zodra noodzakelijke logica, configuratie en herstelreferenties zijn veiliggesteld. Deze toestemming is gegeven. |
| Opruimen GitHub | Onnodige bestanden in relevante branches verwijderen via gewone commits. Compacte `archive/` met nuttige historie, contracten en manifest. Geen afvaldump. |
| Deploy | Bestaande workflows, environments, secrets, variabelen, runner-/signing- en releasecontracten behouden. |
| Bestaande logica | Werkende services, API's, identiteiten, publicaties, planning, bronadapters, caching en recovery behouden en aantonen. |
| Android | Bestaande apps bijwerken met dezelfde applicationId en juiste signing. Nieuwe Sites-iconen en hero toepassen. Geïnstalleerde gegevens en pairing blijven bestaan. |
| Compleet | Publieke SEO-site, webbeheer, native beheer, spelers, alle V1-domeinen en bewijsbare acceptatie. Een frontenddemo is geen productie-implementatie. |

## Leesvolgorde

1. `CODEX-STARTPROMPT.md` — startopdracht aan de uitvoerende Codex.
2. `docs/OPDRACHTCANON.md` — opdrachtgrenzen en voorrang.
3. `docs/V1-REBUILD-CANON.md` — volledige product- en runtimecanon.
4. `docs/VISUELE-OVERNAME.md` — exacte ontwerp-, asset- en screenshotacceptatie.
5. `docs/LOGICA-PARITEITSMATRIX.md` — behouden gedrag en bewijs.
6. `docs/ONTWIKKELING-EN-OPRUIMING.md` — developmentserver, archive en verwijderprocedure.
7. `docs/DEPLOY-EN-GITHUB-BEHOUD.md` en `docs/ANDROID-UPDATE-CONTRACT.md` — actuele repositorycontracten.
8. `docs/IMPLEMENTATIE-EN-ACCEPTATIE.md` — bouwvolgorde en definitie van gereed.
9. `docs/BRONNEN-EN-BEWIJS.md` en `docs/CONFLICTEN-EN-VOORRANG.md` — herkomst en begrenzing van eerdere afspraken.

## Wat er concreet in het pakket zit

| Map | Inhoud en gebruik |
|---|---|
| `reference/sites-sync/` | Ongewijzigde volledige getrackte bron van de huidige Sync-publicatie, inclusief marketingbron, assets, lockfile, 148 scenario's en oorspronkelijke controleprogramma's. Alleen referentie; oude documenten hebben niet opnieuw voorrang. |
| `reference/marketing-publication/` | Exacte gepubliceerde HTML/CSS/JS/assets, negen publieke pagina's, sitemap en robots. |
| `reference/original/` | Originele 17-pagina's tellende V1-repoanalyse/PDF plus leesbaar tekstextract. |
| `reference/sites-publication/` | Herkomstgegevens en bestaande publicatiecapture van de marketinghome. |
| `reference/legacy-baseline/` | Geverifieerde GitHub-bronfragmenten, workflow-/Androidcontracten en branchinventaris op vaste commit. |
| `assets/android-icon-kit/` | Van het exacte Sites-beeldmerk afgeleide Android-/Expo-iconresources en reproduceerbare export. |
| `archive/` | Compact archiefmodel dat de uitvoerende Codex in de doelrepo invult. |
| `execution/` | Registers voor inventaris, opruiming, configuratiebehoud en acceptatie tijdens de uitvoering. |
| `scripts/verify-package.py` | Offline integriteitscontrole van dit pakket. |

De oude ZIP binnen `reference/sites-sync/public/assets/` is bewust meegeleverd omdat de vastgepinde bron ernaar linkt. Die ZIP is een historische snapshot, geen tweede opdracht. Gebruik uitsluitend de startprompt en canon in de root van dit nieuwe pakket.

## Referenties bekijken

- Sync: https://veyocast-v1-design-lab.dgwebserv.chatgpt.site/?design=sync
- Handovervoorbeeld: https://veyocast-v1-design-lab.dgwebserv.chatgpt.site/?design=sync&page=handover
- Publieke marketing: https://veyocast.dgwebserv.chatgpt.site

Als toegang tot Sites ontbreekt, blijft alle vastgepinde broncode en het gepubliceerde marketingresultaat beschikbaar in dit pakket. Maak de bron toegankelijk op de developmentserver voor visuele vergelijking. De meegeleverde `.openai/hosting.json`-bestanden identificeren bestaande referentieprojecten; gebruik die niet om de doelrepo onbedoeld naar Sites te publiceren.

## Controle en status

Na uitpakken, vanuit deze map:

```sh
python3 scripts/verify-package.py
```

`docs/PAKKETCONTROLE.md` beschrijft de feitelijk uitgevoerde pakketcontroles. De eerdere prototypechecks staan ongewijzigd in `reference/sites-sync/docs/TESTRESULTATEN.md`. Fysieke apparaten, echte providers, serverrechten en productie-uitrol zijn daarmee niet getest.

Dit is het complete uitvoeringspakket. Er zijn voor deze overdracht geen developmentbestanden of GitHub-bestanden verwijderd, geen workflows/secrets aangepast en geen Android-apps uitgebracht. Dat werk is de opdracht aan de uitvoerende Codex op de juiste developmentomgeving.
