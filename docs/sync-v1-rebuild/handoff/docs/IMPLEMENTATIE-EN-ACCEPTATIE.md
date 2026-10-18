# Implementatie en aantoonbare acceptatie

## Bouwvolgorde op development

| Stap | Uitvoering | Uitgangscriterium |
|---|---|---|
| 0. Feiten vastleggen | Omgeving, branches, services, huidige data/app/release-ID's, deploymentsettings, rollback en hashbaseline. | Geen onbekende actieve afhankelijkheden binnen de eerste wijzigingsbatch; bestaande workflowcontracten vastgelegd. |
| 1. Exacte UI-basis | Sync-componenten, CSS, assets, fonts, routes, states, responsive en native mapping. | Referentie/rebuild naast elkaar; geen nieuw ontwerp. |
| 2. Eén echte verticale keten | Content → Studio → playlist → preflight → release → device → bevestiging. | Werkelijke serverdata en fysieke playeractivering, negatieve gevallen en behouden oude release. |
| 3. Volledige domeinpariteit | Planning, zones, bedrijfsuren, bronnen, twee thema's, 17 families, producten, sponsors, Engage, rollen/support/platform/billingflags. | Matrix volledig geïmplementeerd en per bewijsniveau onderbouwd. |
| 4. Marketing en native apps | Negen SEO-routes, echte aanvraagketen, Android/Control-update incl icon en hero. | Indexeerbare publieke HTML en echte inboxflow; in-place upgrade met behoud van data. |
| 5. Gerichte cleanup | Geverifieerde oude developmentpaden en overtollige branchbestanden, compact archive. | Verwijdermanifest, geen gebroken imports/workflows; naam/scopecontracten behouden. |
| 6. Bestaande releaseflow | Vereiste CI-gates, stagingbuild/deploy, smoke en acceptatie. | Concrete SHA/URL/resultaten; dezelfde deploymentketen; rollback beschikbaar. |
| 7. Overdracht | Release notes, app-artifacts, configuratie-/datamapping, screenshots en bewijsregisters. | Alle verplichte gates aantoonbaar af; resterende uitzonderingen expliciet. |

Werk in kleine geïntegreerde batches; functies hoeven niet tot de laatste stap in een losstaande nieuwe app te blijven. Houd oude apps en actieve publicaties bruikbaar gedurende de overgang. Code kan opnieuw worden georganiseerd, de logica en visuele uitkomst niet ongemerkt gewijzigd.

## De 148 scenario's blijven behouden

`reference/sites-sync/src/coverage.json` bevat exact 148 scenario-ID's. De volledige toelichting en 24 risicojourneys staan in `reference/sites-sync/docs/ACCEPTATIE.md`. `execution/scenario-acceptatie.csv` maakt ieder ID expliciet aftekenbaar voor de rebuild, met separate kolommen voor prototypegedrag en productie-/hardwarebewijs.

De demoformulering 'gesimuleerd', lokale opslag of een aangevinkt scenario wordt niet tot productieacceptatie verheven. Voor ieder ID moet het passende echte gedrag worden aangesloten en het juiste bewijsniveau ingevuld. Vul NVT alleen met een concrete onderbouwing; een uitgeschakelde featureflag bewijst niet dat de V1-feature is gebouwd.

## Bewijsniveaus en releasegates

| Niveau | Verplicht bewijs |
|---|---|
| Pakket/bron | Hashes, broncommit, behoudsinventaris, API-/domeinmapping, reproduceerbare builds. |
| UI/component | Alle routes en states, echte formulierfeedback, invoerherstel, focus, rollen en responsive geometrie. |
| Server/integratie | Autorisatie buiten UI, cross-tenant negatieve tests, revisions/conflict, idempotentie, jobretry, echte opslag, audit. |
| Data/migratie | Stabiele ID's en relaties, actieve/oude publicaties leesbaar, compatibiliteit oude apps, herstelproef. |
| Provider | Werkelijke Sportlinkdatasets/accountrechten, Twelve importfouten, RSS/LED/YouTube fallback, echte mail-/betaalstatus waar vrijgegeven. |
| Hardware | Android general/TV/Control in-place upgrade, LG-profiel, koude offlineboot, cachefout, opslagdruk, renderercrash, D-pad en echte playerbevestiging. |
| Operatie | Bestaande CI/deploygates, staging-SHA, health, promotion/rollbackcontract, begrensde telemetry/DB-load en minimaal 24 uur relevante fysieke playback. |
| Publiek | Negen routes, canonicals/statuscodes, sitemap/robots, 404, beeld/fontgedrag, toetsenbord/mobiel, echte aanvraag/inbox/retry en gemeten prestaties. |

## Minimale eindproeven

1. Twee tenants en rollen: geen cross-tenant toegang via aangepaste URL, requestbody, object-ID of directe API. Native en web hetzelfde beleid.
2. Nieuw ontwerp in beide thema's/orientaties, lange tabel/RSS paging, heropenen en versieconflict zonder invoerverlies; beide bestaande themafamilies getest.
3. Playlist met dubbele plaatsing, verschillende overrides, verborgen item, trim/audio en prijs-/themesnapshot: oude publicatie blijft onveranderd.
4. Publiceren naar online/offline device: onderscheid desired/verified/active, corrupt of onderbroken download, veilige overgang, last-known-good en echte acknowledgement.
5. Planning met groep/individueel, overlap, middernacht, zomer-/wintertijd, vier composities en terugkeer naar default zonder zij-/onderzoneverlies.
6. Bestaande Android-installatie bijwerken met hetzelfde package/signing, hogere code en bestaande track. Geen nieuwe deviceclaim, cache-/sessie-/pending-uploadverlies. App-icon en hero kloppen op echt apparaat.
7. LG mediadecoderfout/code 4, zichtbaar-frameherstel, itemtimer, video mute, cache-/Rangevarianten en geometrie op het werkelijk gebruikte model; geen modern CSS-lek in legacy runtime.
8. Bronuitval/identieke bronhash, verkeerde teamselectie, verlopen LED-event, dubbele stem/webhook/aanvraag en race bij publicatie: correct begrensd herstel en geen schijnsucces.
9. Cold boot offline, langdurig mixed-media afspelen en herhaalde sync: geen vastloper, onbeperkt opslaggebruik of nutteloze DB-writes.
10. Cleanup en deploy: iedere verwijdering herleidbaar, alle benodigde workflows/scripts aanwezig, secrets/vars/environments behouden, staging via bestaande flow gezond en rollback concreet.

## Wat 'klaar' niet betekent

Een geslaagde TypeScriptbuild, een frontendvinkje of een groene mocktest bewijst geen fysieke playback, providerrecht, serverbeveiliging, ontvangen aanvraag of Androidupdate. De oorspronkelijke prototypechecks mogen als historisch bewijs worden genoemd met hun beperkte scope. Voer de relevante nieuwe tests opnieuw op de echte implementatie uit en geef ieder resultaat een commit, omgeving, tijd, methode en bewijsbestand.

Een noodzakelijke productiedeploy of nieuwe incasso-/restrictieactivering wordt pas de volgende concrete beslissing nadat het geautoriseerde development-/stagingwerk is afgerond. Gebruik de normale bestaande workflow; bouw geen tweede deploymentpad.
