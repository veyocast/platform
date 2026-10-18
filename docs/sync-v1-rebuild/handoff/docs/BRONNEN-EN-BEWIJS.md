# Bronnen, herkomst en bewijsgrenzen

Peildatum: 17 oktober 2026. Dit document beschrijft wat voor het nieuwe handoverpakket is vastgelegd, niet wat de toekomstige rebuild al heeft uitgevoerd.

## Primaire referenties

| Bron | Vastgelegde versie | Betekenis |
|---|---|---|
| Sites Sync | Versie 2, commit `8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a` | Visuele en interactieve autoriteit voor prototype 1; volledige getrackte bron byte-identiek in `reference/sites-sync/`. |
| Sites marketing | Versie 1, commit `69461726f0d9e17b535dfaa0652cc18ed75c1fdd` | Exacte negen publieke pagina's en gebouwde assets in `reference/marketing-publication/`. De bewerkbare marketingbron zit in de Sync-bron. |
| GitHub | `veyocast/platform`, main `20729be35d38dc8eb67b836160632ac7c3ea5153` | Bestaande deploy-/Androidcontracten en branch-/padinventaris. Geen volledige nieuwe productiecheckout in dit pakket. |
| Oorspronkelijke V1-analyse | `reference/original/VeyoCast-Repoanalyse-en-V1-Voorstel-2026-10-17.pdf` | Originele 17-pagina-analyse, meegeleverd zonder wijziging. Het tekstextract is afgeleid leesmateriaal. |
| Bestaande Sync-canon | `reference/sites-sync/docs/V1-SYNC-CANON.md` | Uitgewerkte functionele details; nieuwste opdrachtcanon/rebuildcanon gaan voor bij verschil. |
| Acceptatiecatalogus | `reference/sites-sync/docs/ACCEPTATIE.md`, `src/coverage.json` | 148 scenario-ID's en 24 journeys; catalogus, geen universeel geslaagde testuitslag. |
| Prototypecontrole | `reference/sites-sync/docs/TESTRESULTATEN.md` | Eerder uitgevoerde component-/DOM-/build-/SEOchecks met expliciete beperkingen. |

Sites-ID's, live URL's, versies en deploymentverwijzingen staan in `reference/sites-publication/sites-provenance.json`. Daarin staan geen tijdelijke toegangstokens of downloadcredentials. De overgenomen publicatiecapture toont de publieke marketingroot en is gelabeld als bestaande capture, geen eigen nieuwe visuele browseracceptatie.

## GitHub-bewijs

`reference/legacy-baseline/deploy/` bevat de volledige branchinventaris van 178 branches, de niet-afgeknotte main-tree met 4.180 entries, alle 25 workflows en geselecteerde onderliggende deploy-/Compose-/Docker-/migratie-/healthbestanden. De 50 geselecteerde bestanden zijn tegen hun oorspronkelijke Git-blobhash gecontroleerd. Manifesten bevatten immutable bron-URL's en hashes.

`reference/legacy-baseline/android/` bevat 26 geselecteerde Android/Expo-/playercontractbestanden, eveneens tegen Git-blobhash gecontroleerd, met `evidence.json`. Sommige onderwerpen/workflows overlappen de deploybaseline; de beide selecties hebben ieder hun eigen bewijsmanifest.

Dit is gericht bronbewijs, geen audit dat elk bestand op alle 178 branches overbodig is. De uitvoerende Codex moet unieke branchwijzigingen en actieve omgevingsafhankelijkheden onderzoeken voordat hij verwijdert. Historische documenten in de baseline zijn geen opdracht om oude resetworkflows te draaien of opnieuw lokaal/WSL te bouwen.

## Niet vanuit deze sessie vastgesteld

- Actuele development-hostnaam, bronpad, processen, volumes, secretslocaties en geïnstalleerde apps.
- Werkelijke GitHub Settings-inhoud/scopes, environmentbescherming, extra secrets/variables en runnerregistraties. Namen in workflows zijn wel brongecontroleerd.
- Laatst verspreide Android-versionCodes, huidige Play-trackstatus, signing-/uploadcertificaatfingerprints en echte in-place update.
- Echte provideracceptatie, server-RLS-/autorisatietests, databaseherstel, mailbezorging, billingvrijgave en fysieke LG-/Androidduurproef.
- Nieuwe browser-/screenshottests of Lighthouse-/veldmetingen van de toekomstige implementatie.

Deze punten staan als uitvoeringsgates in de canon, niet als reeds geslaagde claims. De rebuild wordt daarmee niet beperkt tot wat het prototype lokaal kan simuleren.

## Integriteit en gebruik

`manifests/sites-files.json` is de SHA-256-inventaris van beide exacte Sites-snapshots. `manifests/assets.json` legt de merkassets, fonts en afgeleide Android-iconen vast. `manifests/package-files.json` omvat alle pakketbestanden behalve zichzelf. `scripts/verify-package.py` controleert aanwezigheid, bytes, ongewenste extra bestanden, Sites-/asset-hashes, beide legacy-blobaudits en alle 148 unieke scenario-ID's.

De meegeleverde bron en publicatie zijn referenties. Kopieer niet blind `.openai/hosting.json` naar de productiecheckout om een andere hostingflow te starten. Gebruik de bestaande GitHub/development-/stagingarchitectuur en neem de UI/UX zonder verandering daarin over.

Het oude `VeyoCast-V1-Sync-Handover.zip` binnen de exacte Sites-snapshot blijft uitsluitend aanwezig om de snapshot en bestaande downloadlink te behouden. De nieuwe rootprompt, opdrachtcanon en rebuildcanon supersederen de instructies daarin. Codex moet niet meerdere tegenstrijdige oude prompts uitvoeren.
