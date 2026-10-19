# S243 — Echte schermkeuze en schermwizards

**Playlist toewijzen** opent een compacte playlistkeuze voor het geopende
scherm. De gekozen bestaande immutable publicatie gaat naar de bestaande
beveiligde review, met uitsluitend dit scherm voorgeselecteerd. De bevestiging
blijft expliciet. Een fout of een GET-vergelijking behoudt die schermcontext;
een ongeldige, vreemde, uitgeschakelde of geblokkeerde bestemming kiest nooit
een ander scherm.

## Source en productgrenzen

De gekozen immutable Source is
`docs/sync-v1-rebuild/handoff/reference/sites-sync/src/modules/Players.tsx`:
de picker op regels 117/138, Schermindeling en Bedrijfstijden op 122/123.
De lokale Source-`publish`-simulatie op 108 is geen productwriter. De echte
picker gebruikt de bestaande `latestAssignableScreenReleases`-projectie van
laatste gepubliceerde versies per niet-gearchiveerde playlist. Detail krijgt
de al geladen projectie door, zonder extra releasequery of conceptpublicatie.

De Source-dialog houdt de echte focus/Escape-terugkeer, één playlistlabel,
de bestaande versiehelper en één volledige veiligheidsuitleg. De dubbele
DialogDescription is als afzonderlijk geautoriseerde presentatiecorrectie
verwijderd; alle overige markup, slots, classes, handlers en callbacks in
`sync-screen-detail.tsx` blijven bytegelijk. De pickerintro luidt nu
“Kies een playlist voor …”. Leesbare taaktekst is minimaal 14 px en de echte
select-, CTA- en sluit-hitareas zijn minimaal 44 px.

De bestaande tenant/capability-, immutable-, risico-, preflight- en
idempotencycontroles blijven leidend. De servercommand blijft
`reassignRelease` → `reassign_playlist_release_v2`. Het verborgen
`screenContext` is onbetrouwbare UI-context en wordt geen command- of RPC-veld.
De parser onderscheidt afwezig van expliciet leeg, herhaald, niet-string en
ongeldig. Maximaal 100 UUIDs en 3.699 tekens worden vóór deduplicatie begrensd;
UUIDs worden genormaliseerd. De review en action begrenzen context opnieuw tot
eigen tenant-preflight. Een lege expliciete selectie krijgt geen standaarddoel.
Een vroeg foutpad draagt alleen syntactische context over; de volgende
reviewrender doet opnieuw tenantvalidatie. Er is geen vrije return-URL.

De GET-vergelijkform draagt alleen de opgeloste UUIDs mee in één conditioneel
`screens`-veld. De aparte actionadapter behoudt context op alle foutpaden en
bij succes. Het genormaliseerde bewijs reproduceert de volledige originele
actionbytes na wegnemen van uitsluitend deze UI-adapter; RPC, guards, nonce en
restore zijn gelijk.

De review houdt de bestaande semantische succesbadge en achtergrond. Alleen
binnen deze review zet een `display: contents`-scope badges op 14 px en hun
succesvoorgrond op de bestaande officiële `--vc-semantic-success-text`-token.
Hiermee verdwijnt de daadwerkelijk gemeten 4,32:1-contrastfout van de oude
11 px-badge. Source-export, gedeelde UI en tokenbestanden blijven ongewijzigd.

## Schermindeling en bedrijfstijden

Alle oorspronkelijke layout-CSS blijft bytegelijk als prefix. Lokale
compositiondialog-/editformselectors geven 14 px taaktekst, 44 px controls en
Source-accent/focus. De bestaande drie stappen, alle zones, portraitpreview,
state, CAS, nonce en replay blijven behouden. Editor en action zijn bytegelijk.
De preview bevat bewust de bestaande inhoudspresentatie en is geen nieuw
player- of publicatierenderpad.

De originele fullpagecapturen bewijzen op 390 px een pagina van 5.778 px,
met de form op y=2.097,22 na apparaatfeiten op y=1.255,27. Op 1440 px was
het 3.659 px, met de form op y=1.367,88 na feiten op y=948,05. Daarom staat de
echte form nu vóór de apparaatfeiten. Start-/TV-instellingen, apparaatfeiten,
installatiecontext en historie hebben native disclosures zonder gecontroleerde
openprop. Hero-testactie, foutmelding en actuele historystatus blijven zichtbaar.

Na uitsluitend verwijderen van de nieuwe disclosurewrapper is de form
bytegelijk; de bestaande facts/form/compatibility/history-children en alle
statushelpers zijn gelijk. Perioden, nachtoverschrijding, tijdzone,
uitzonderingen, override/vervaldatum, CEC-uitleg, testvoortgang en historie
blijven bereikbaar. De native switchinput, handlers, settingsschema en acties
zijn behouden. De lokale layout geeft 44 px hitareas en een passende mobiele
period-grid. Een echte statewijziging houdt de geopende disclosure open.

De huidige gemeten paginahoogten zijn 3.413 px op 390 px en 2.368 px op
1440 px, circa 41% respectievelijk 35% korter. De form begint op y=1.213,88
respectievelijk y=884,97, vóór de secundaire apparaatfeiten. Er zijn geen
velden, waarschuwingen of functionaliteiten verwijderd om deze reductie te halen.

## Beschermde nulmeting en verificatie

Basis is S235 `4722b888`; oude S232-branch en bewijzen zijn behouden. Originele
pagina's, componenten, CSS en writers zijn vóór edits vastgelegd met SHA-256 in
`/tmp/veyocast-s243-baseline.json` en de bijbehorende map.

- Oorspronkelijke data- en composition-units: 13/13 PASS.
- Nieuwe regressies op originele code: 9 FAIL/5 PASS, log
  `/tmp/veyocast-s243-unit-first-red.log`.
- Correctieve gerichte units: 32/32 PASS, maximaal twee workers. Dit zijn alle
  13 oorspronkelijke units plus 19 nieuwe gevallen. De tussenrun met één
  ontbrekende projectie is bewaard.
- Eerste browsercohort: exact 10, 1 PASS/9 FAIL, 53,4 s. De readonlyguard slaagt;
  picker/context, 12/10 px-layouttaaktekst en urenvolgorde tonen de echte gaten.
- Correctieve cohort 1: 8 PASS/2 FAIL, 27,3 s; 44 px werd tijdens de bestaande
  eindige schaalanimatie als 43,797 gemeten. Wachten op eindopacity stabiliseert
  de meting met ongewijzigde 44 px-grens en ongewijzigde deadline.
- Correctieve cohort 2: 8 PASS/2 FAIL, 34,3 s; een brede value-selector vond ook
  het nieuwe verborgen UI-veld. Exacte `name=screenIds`-scoping bewaart alle
  checkbox- en geen-alternatiefasserties.
- Correctieve cohort 3: 8 PASS/2 FAIL, 39,3 s; de aanvullende review-aXecontrole
  vond het echte oude succesbadgecontrast van 4,32:1. De volledige flow en
  context-/transportasserties vóór deze controle slaagden.
- Correctieve cohort 4: 10/10 PASS in 32,0 s na de lokale officiële-tokenfix.
  Eén worker, nul retries, nul skips, nul niet-uitgevoerd; runner exit 0 en alle
  Chromiumprocessen gesloten. Originele rode logs, traces en capturen blijven
  afzonderlijk behouden.

Na de compacte presentatiepolish slagen dezelfde twee primaire flows opnieuw:
2/2 PASS in 12,3 s, één worker, nul retries/skips/niet-uitgevoerd. Hun nieuwe
native captures op 390/1440 zijn visueel beoordeeld; de complete picker past
zonder overflow. De andere acht gevallen zijn bytegelijk en behouden hun
groene resultaat uit cohort 4. Het volledige cohort en alle tussenresultaten
blijven apart bewaard. Alle browsers en runners zijn gesloten.

Scoped ESLint, strikte spec-TypeScript en volledige Control-typecheck zijn groen.
Op de definitieve productfreeze zijn ook de volledige workspacegates groen,
sequentieel op CPU 6/7, maximaal 2 GiB heap en Turbo-concurrency 1; vóór elke
gate was meer dan 3.500 MiB geheugen beschikbaar:

- `pnpm lint --concurrency=1`: 30/30 taken, 29 cachehits, 8,812 s.
- `pnpm typecheck --concurrency=1`: 30/30 taken, 29 cachehits, 24,323 s.
- `pnpm test --concurrency=1`: 30/30 taken, 28 cachehits, 64,377 s.
  De verse Control-uitvoering bevat 166 geslaagde bestanden/1.656 geslaagde
  cases en 2 bestaande overgeslagen bestanden/34 overgeslagen cases. De
  media-worker-cache behoudt zijn 324 bestaande overgeslagen cases. Deze skips
  worden niet als uitgevoerde acceptatie geteld.

Definitieve productfreeze: `/tmp/veyocast-s243-product-freeze.json`, SHA-256
`c5ed512a25f7a50c1d7d15a6929b5813ed17cc1c07c78e14a0e8b92e4c45d849`.
Het machineleesbare overzicht met scope, bron-/log-/capturehashes,
originele rode cohorten, exacte grenzen en gate-uitkomsten staat in
`/tmp/veyocast-s243-final-proof.json`. Er is voor dit featurebewijs geen
runtime/build, commit, PR of deployment gestart; integratie en releasevoorbereiding
volgen de centrale queue en afzonderlijke rootautorisatie.

## Bewijsgrens

De browserfixture rendert de echte schermdetail- en releasedetailpagina,
bestaande dialogs, layouteditor, urenform, CSS en lokale lettertypen. Alleen
serverreads, Next-navigatie en actiontransport zijn gecontroleerde grenzen.
De primaire cases bewijzen de echte keuze, Escape/focus, immutable review,
GET-FormData, expliciete bevestiging, foutterugkeer, exacte commandsoort,
nonce en doel. De overige cases bewijzen lege/foute/readonly en
vreemde/herhaalde/disabled/blocked-context zonder alternatief, layouttransport
en ongewijzigde ureninstellingen. Alle tien controleren waar relevant geometrie,
overflow, focus en aXe; native captures op 390/1440 zijn visueel beoordeeld.

Een onafhankelijke readonly peerreview vond geen concrete blocker in de
contextadapter of native disclosures. De finale browsercontrole vult diens
statische geometrie-/focus-/aXegrens aan. Dit is component-/pagina- en
UI-transportbewijs. Live Auth/RLS, echte Next-serveractionacceptatie, fysieke
Player/CEC, pixelpariteit met de volledige Source en volledige rolacceptatie
worden hiermee niet geclaimd. Er zijn geen database-, credential-, runtime-,
player-, offline- of immutable-releasecontractwijzigingen uitgevoerd.
