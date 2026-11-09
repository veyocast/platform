# S295 · Hosted stagingbewijs op 9 november

Geteste stagingruntime: `da3d1242c92beedee3e8d8d8d2c8d35404ab4ae6`, de gemergde
S295-release. De normale [stagingdeploy](https://github.com/veyocast/platform/actions/runs/42610413960)
is geslaagd, inclusief runtimeverificatie, pairing en standalone LG-recovery-
smoke. De bestaande [publicatieprobe op staging](https://github.com/veyocast/platform/actions/runs/42617321321)
en [read-only productieprobe](https://github.com/veyocast/platform/actions/runs/42618161387)
zijn eveneens geslaagd. Beide probes gebruikten `quiesce_worker=false`.

## Afbakening en echte keten

De aparte interne stagingtenant `29590000-0000-4000-9000-000000000001` heeft drie
expliciete testschermen en canaryplaylists. De bestaande S292-canary, Duindorp-
tenant, productiecontent en Duindorp-planningen zijn behouden. Bronwaarnemingen
zijn genormaliseerde, representatieve fixtures door de echte Sportlink-mapper.
Er zijn geen Sportlink-providercredentials in deze stagingtenant. Alle
Sportlink-syncpolicies staan er uit: players doen geen providerrequests.

De fixtures gaan door `complete_sportlink_sync_v5`, de bestaande gecontroleerde
Sync-authoring en de daadwerkelijk gedeployde worker. Die worker claimt en
uploadt zelf het DOM-descriptorartefact en verwerkt de gepubliceerde dataqueue.
Er is geen handmatige rendercompletion, fake Storage-response of onderschepte
manifest-/heartbeatresponse gebruikt. Publicatie verloopt via de bestaande
`mutate_playlist_batch_v1` en `publish_playlist_to_targets_v3`.

Chromium opent vervolgens werkelijk `https://staging-player.veyocast.nl`, met
het normale manifest, deviceauth, service worker, assetvoorbereiding en zichtbare
Source-renderer. `scripts/probe-staging-canary-player.mts` bewaart uitsluitend
geschoonde ETags, revisies, hashes, framebewijzen en screenshots. Tokens blijven
in lokale bestanden met mode 0600; geen HAR of browsertrace met credentials.

## Zichtbare resultaten

| Proef | Werkelijke uitkomst |
| --- | --- |
| Eigen programma en uitslag | Eigen 3–1 en volgend eigen programma zichtbaar in alle waargenomen revisies. |
| Nieuwe poulewedstrijd | Wedstrijd tussen twee andere teams verschijnt met 0–0; landschapsrevisie 3 → 4. |
| Scorecorrectie | Dezelfde wedstrijdcode wordt 2–0; landschapsrevisie 4 → 5. Geen extra playlistrelease. |
| Alleen officiële stand | Positie 2 → 1, punten 3 → 9 en doelsaldo +2 → +5, onafhankelijk van uitslag en programma. Eén bronrun bereikt beide oriëntaties. |
| Complete stand | 14 officiële fixturestandrijen, eigen team herkenbaar. De laatste rij is ook daadwerkelijk binnen de geclipte scrollviewport gemeten en gefotografeerd, in beide oriëntaties. |
| Drie detailruns en een latere programmarij | Alle vier echte completions slagen. Beide poulewedstrijden blijven actief; `missing_sync_count=0`; de bestaande 3–1 en gecorrigeerde 2–0 blijven officieel. |
| Identieke inhoud | Na detail-/programmaobservaties blijft de inhoudsrevisie 5 en dezelfde hash behouden; `checked_at` schuift van 12:28:07 naar 12:31:07 UTC. De echte Player ontvangt 304. |
| Tweede familie | Een gepubliceerde dynamische menukaart neemt de nieuwe gekoppelde productnaam over via `manage_tenant_product_v2`, zonder extra renderjob of playlistrelease. De bestaande prijsgoedkeuring houdt de gepubliceerde € 2,50 vast. |

Alle drie playlists houden exact één immutable release. Er zijn in totaal drie
initiële renderjobs, één per ontwerp; gewone bronupdates creëren geen nieuwe
renderjob of ontwerp. De webplayers gebruiken de normale productie-interval
van acht seconden. De afzonderlijke S295-browsertests met langere periodieke
interval bewijzen specifiek de activatietrigger, herhaalde IDs, één-itemlussen,
zones, offline/herstel en oude antwoorden; die gecontroleerde proeven zijn
apart van deze hosted canary vastgelegd.

## Gemeten tijden

Deze tijden beginnen bij een geslaagde ingest van de **fixture**. Ze zijn geen
meting van vertraging bij de echte Sportlink-provider. Een frame hieronder is
de eerste door de echte Player gemelde revisie; de opgenomen screenshots
bevestigen daarna leesbare, zichtbare inhoud.

| Wijziging | Geslaagde sync → eerste gemelde frame |
| --- | --- |
| Alleen stand, correctie 9 → 3 punten | 28,64 s |
| Nieuwe 0–0 | 22,38 s |
| Correctie naar 2–0 | 28,71 s |
| Alleen stand naar twee schermen | 30,85 s portret; 51,50 s landschap |
| Gekoppelde productnaam | 9,85 s |

Bij de laatste gezamenlijke standenrun (`22cff42d-f022-4c8d-9742-3447d1ad69be`)
is de afzonderlijke keten gemeten: ingest → `published_dynamic_data` is 6,93 s
voor portret en 8,89 s voor landschap; die datarevisie → gemeld frame is
23,91 s respectievelijk 42,61 s. De natuurlijke lus-/paginagrens blijft dus
onderdeel van de levertijd. Het onderliggende release-ID blijft gelijk.

De ruwe geschoonde waarnemingen, bronrun-ID's, snapshot-ID's, hashes, ETags,
200/304-antwoorden en framecorrelaties staan in
`staging-database-chain-2026-11-09.json`, `staging-frame-summary-2026-11-09.json`
en `staging-2026-11-09/**/evidence.json`. De screenshotparen tonen werkelijk
dezelfde gepubliceerde inhoud, geen nagebouwde presentatie.

## Read-only Duindorp-baseline

Productie Control en Player melden nog SHA
`282bcec3e986207b5b01ea186325297b2b974b11`. De geautoriseerde diagnose op
12:35 UTC leest alleen bestaande metadata. De wedstrijdpolicy is elk uur;
laatste succes 11:47:39 UTC, volgende reguliere run 12:46:49 UTC. De officiële
standpolicy is dagelijks; laatste succes 8 november 15:14:43 UTC, volgende
run 9 november 15:14:11 UTC. Detailruns lezen een begrensde batch van 100.

De gebruikte Uitslagen-slide is
`sportlink.club_results_previous_7_days`, alle teams, thuis/uit beide,
`maxItems=200`. De gepubliceerde Onze wedstrijddag gebruikt `auto_current`,
team `218380`, opgelost naar poule `826233`, canonieke competitie
`89578cd804224102bbc4210cf1eea97ec87ec203dd1ab5f4b2d8792f8b501322` en een
legitiem nullseizoen. Beide hebben live-data aan en renderer
`sync-onzetrots-v9` via DOM-protocol 2. Exacte versies, snapshots, periodes,
hashes en bindings staan in de twee `production-*-2026-11-09.json`-bestanden.

S295 voegt een begrensde centrale catch-up toe met de bestaande leases,
cooldown en backoff. Het standaard maximum voor een gepubliceerde wedstrijddag
is 3.600 seconden; een expliciete nullpolicy behoudt alleen de reguliere
frequentie. De bestaande productiepolicyfrequenties zijn niet herschreven.

## Grenzen en herstel

Dit bewijst de echte hosted webplayer en worker met representatieve brondata.
Het bewijst geen nieuwe externe Sportlink-providerwaarneming en geen fysiek
Android-, LG- of LED-paneel. Er is geen aangesloten Android-/LG-hardware;
standalone LG-smoke en softwareprofielen blijven afzonderlijk benoemd. Een
lokale datumgrens, geldige lege selectie en deelbronfouten zijn via de bestaande
geïsoleerde SQL-/echte Player-proeven bewezen, geen versnelde productieklok.

De oude, nog wachtende probes van de vorige sessie zijn geannuleerd en vervangen
door de expliciete nieuwe read-only probe. De productieomgevinggoedkeuring
gebruikte de actuele uitdrukkelijke gebruikersautorisatie, zonder een
onafhankelijke menselijke review te suggereren. De worker is niet gestopt.

De testbrowserprocessen zijn na het vastleggen gesloten. Canarybronnen hebben
geen providerpolicies aan en richten zich uitsluitend op de drie testschermen.
Bij vervolgproeven worden alleen deze doelbindings gebruikt. Productiepromotie
van de volledige S296–S301-opdracht volgt pas na de bijbehorende review/CI en
de normale stagingverificatie van die uiteindelijke SHA.
