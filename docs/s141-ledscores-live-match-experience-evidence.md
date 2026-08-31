# S141 — LED Scores live wedstrijdervaring

## Besluit

S141 scheidt blijvende wedstrijdinformatie van tijdelijke aandachtmomenten:

| Onderdeel | Productvorm | Gedrag |
|---|---|---|
| Stand, klok en verloop | Dynamische playlistslide | Gebruikt de laatst beschikbare geldige status binnen een immutable ontwerp-, snapshot- en fallbackgrens. |
| Goal | Overlay | Start direct op de scoredelta en kan binnen dezelfde zichtbare overlay worden verrijkt met de later gekozen speler. |
| Thuis-/uitopstelling | Overlay | Volgt de expliciete LED Scores-opstellingsknop; thuis en uit hebben afzonderlijke vormgeving. |
| Start, rust en einde | Overlay | Volgt alleen een verse semantische statusovergang en wordt na startup, matchwissel of reconnect niet historisch afgespeeld. |

De live tussenstand is dus echte playlistcontent. De playlistrelease bevriest
templateversie, vormgeving, bindings en een checksum-geverifieerde fallbackposter.
De actuele score, klok en tijdlijn komen uitsluitend uit één begrensde,
gevalideerde latest-state voor de connection-ID die in die release is
toegestaan. Een statusupdate muteert nooit de release.

Goal, opstelling en wedstrijdfase blijven tijdelijke deliveries boven de
bestaande last-known-good release. De Player blijft een device, opent geen
providerverbinding en verwijdert of vervangt de onderliggende playback niet.

## Identiteit en late scorer

`scoreboard.scored.id` is een scoreknop-ID en nooit een speler-ID. De adapter
correleert een late scorerkeuze deterministisch met de scorerpositie bij de
resulterende score. De database bewaart stabiele identiteit als tenant +
verbinding + providerteam + providerspeler; naam, rugnummer en foto blijven
verrijkbare eigenschappen.

De goal kan daardoor meteen met team en score starten. Kiest de gebruiker
daarna speler 9, dan krijgt dezelfde actieve overlay een hogere enrichment-
sequence met naam, rugnummer en gevalideerde foto. De animatie start niet
opnieuw. Ontbrekende of ambigue spelers blijven eerlijk generiek; VeyoCast
gokt nooit op basis van alleen een naam.

## Roster- en fotogrens

- alleen het eigen roster wordt standaard verwerkt en bewaard;
- verwerking van het tegenstanderroster vereist expliciete
  `includeOpponent`-toestemming in de gepubliceerde configuratie;
- geselecteerde spelers hebben voorrang bij fotoverrijking; een begrensde
  actieve fallback kan lege opstellingen aanvullen zonder een volledig rauw
  roster naar browser of Player te sturen;
- een late provideropstelling krijgt maximaal één gerichte refresh, zodat een
  trage spelerslijst niet tot replay of een onbegrensde ophaallus leidt;
- providerfoto's worden alleen server-side van de vaste HTTPS-host
  `api.ledscores.score.tel` opgehaald, zonder redirects, met byte-, type- en
  dimensiegrenzen;
- een geaccepteerde foto wordt naar WebP genormaliseerd en content-addressed
  opgeslagen als
  `tenants/{tenant_id}/assets/{asset_version_id}/player.webp` in de private
  `provider-assets`-bucket;
- tenantbrowser en Player ontvangen nooit een provider-URL of volledig
  providerroster, alleen een kortlevende signed VeyoCast-URL waar nodig.

Wanneer toestemming voor tegenstanders wordt ingetrokken, worden
tenant-zichtbare tegenstanderspelers, historische verrijkingen, lineup-
deliveries en spelerdata direct geredigeerd of verwijderd. Bekende beperking:
reeds opgeslagen binaire fotobytes kunnen in de private, uitsluitend
service-role toegankelijke providercache blijven staan tot een latere
transactionele cleanup. Die bytes zijn nooit rechtstreeks browser- of
Player-zichtbaar en worden na opt-out niet meer in nieuwe tenantpayloads
opgenomen.

## Responsive beheerervaring

Studio biedt twee duidelijke producten:

1. `Wedstrijdanimaties` — een vijfstappenwizard voor momenten,
   databinding/vormgeving, veilige mediafallback, doelgroepen en controle;
2. `Live tussenstand` — een echte slide met expliciete keuze voor liggend of
   staand, scorebord of wedstrijdcentrum, klok, tijdlijnlimiet,
   laatst-bekende gedrag en een werkelijke 16:9- of 9:16-preview.

De animatiewizard bevat afzonderlijke keuzes voor goal, thuisopstelling,
uitopstelling, start, rust en einde. Naam, rugnummer en foto zijn veilige
bindings en hoeven niet per speler als losse overlay te worden ontworpen.
Gecureerde presets begrenzen compositie, typografie en motion; kleurpalet,
typografie, logopositie/-schaal, zichtbare score/klok en relevante goalvelden
blijven doelgericht instelbaar.

Desktop plaatst de preview naast de actieve instellingen. Mobiel toont één
stap per viewport, een duidelijke voortgang en geen horizontale overflow.
Onvolledige actieve ontwerpen blokkeren opslaan met oorzaak, gevolg en
herstelactie. `prefers-reduced-motion` behoudt betekenis met een statische of
korte fadevariant.

## Datalaag en security

- `ledscores_player_identities` bewaart tenantgebonden provideridentiteiten;
- `ledscores_live_match_states` bewaart per verbinding één begrensde actuele
  toestand met monotonische sequence, freshness en maximaal 30 tijdlijnitems;
- de live-slideconfiguratie kiest daaruit maximaal 0–10 zichtbare items;
- `ledscores_match_events` bewaart canonieke overlayevents;
- `ledscores_goal_event_enrichments` bewaart append-only scorerversies;
- de bestaande deliverytabel ondersteunt `goal_enrichment` en
  `match_overlay`, beide per scherm gededupliceerd;
- iedere tenanttabel heeft tenant-ID, tenant-aware foreign keys, indexen,
  forced RLS en default-deny writes;
- worker-RPC's zijn uitsluitend beschikbaar voor `service_role` en vereisen
  daarnaast een actieve verbindinglease;
- de dynamic slide wijst naar een connectiongebonden `ledscores`-datasource en
  bevriest een fallbackstatus in zijn immutable snapshot;
- alleen de publieke, RLS-beveiligde live-statetabel wordt door S141 aan
  `supabase_realtime` toegevoegd; het `realtime`-schema zelf blijft
  onaangeraakt.

De nested authoringconfiguratie wordt zowel in Control als aan de databasegrens
strict gevalideerd. Onbekende keys, ongeldige media, niet-toegestane logo's,
cross-tenant doelen en een uitgeschakelde feature falen gesloten.

## Playerordering en klok

De Player-server serialiseert SSE-hydratie en -uitvoer. Een trage lineup kan
daardoor nooit een latere `lineup_clear` inhalen. Bootstrap en reconnect-
catch-up sorteren goal-, scorer- en matchdeliveries op `executeAt`, waarna
event-ID en sequence voor deterministische deduplicatie zorgen.

Moderne en Chromium-79-compatibele Legacy-runtimes berekenen dezelfde
klokoffset uit gevalideerde `serverTime`. Die offset stuurt `executeAt`, de
lopende wedstrijdklok, freshness/stale-detectie en het herkennen van geldige
last-known state. De prioriteit is:

1. goal en actieve scorerrenrichment;
2. wedstrijdfase of opstelling;
3. live tussenstandslide;
4. gewone playlistcontent.

Lineups pagineren op afstand leesbaar: maximaal elf spelers per landscape-
pagina en acht per portraitpagina. Ontbrekende foto's krijgen een grafische
fallback. Iedere delivery gebruikt dezelfde duurzame `received` plus precies
één terminale `rendered`, `skipped` of `failed` acknowledgement-outbox als
S140.

## Testbewijs

Bewezen op een verse lokale database en de actuele S141-worktree:

- `supabase db reset` groen;
- database-lint zonder nieuwe S141-bevindingen;
- gerichte S141-pgTAP: 71/71;
- volledige RLS-matrix: 68 bestanden, 1.552 assertions;
- `@veyocast/integrations`: 108 tests;
- `@veyocast/media-worker`: 114 tests;
- Control: 278 tests;
- Player-unit: 47 bestanden, 214 tests;
- Player-browsergate: 109/109;
- workspace lint: 30/30 packages;
- workspace typecheck: 30/30 packages;
- workspace test: 30/30 packages;
- workspace build: 18/18 taken;
- accessibility: 36 groen, 1 bewuste live-fixtureskip;
- brede Chromium-E2E: 182 groen, 21 bewuste live/visual-skips;
- afzonderlijke Player-offlinegate: 7/7.

Alle lokale releasegates zijn groen. Alleen de immutable VPS-readback blijft op
dit documentatiemoment ongeclaimd; deployment wordt pas na merge van exact deze
gereviewde `main`-SHA uitgevoerd.

## Rollback

De snelste operationele rollback blijft de tenantflag uitschakelen. Dan stoppen
nieuwe workerclaims en realtime-events, terwijl de Player zijn actieve lokale
release blijft tonen. Een verbinding of gepubliceerde animatieconfiguratie kan
kleiner van scope worden gepauzeerd. Tabellen, auditbewijs en immutable
snapshots worden bij een application rollback niet destructief verwijderd.
