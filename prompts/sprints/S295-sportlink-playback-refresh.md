# S295 — Sportlink-resultaten en controle bij iedere vertoning

Uitvoering van de gebruikersopdracht van 7 november 2026. Start op actuele
remote main `282bcec3e986207b5b01ea186325297b2b974b11`; eigen worktree
`/home/codex/repos/veyocast-sportlink-playback`, branch
`veyocast/s295-sportlink-playback-refresh`. Het opgegeven `castivo`-werkpad
bestaat niet op deze host.

Ownership: Sportlink-worker, integratie/mappers, actieve SQL-completion- en
snapshot/projectiegrenzen via nieuwe forwardmigratie, OnzeTrots-matchdayprojector,
Player-activatie/manifest/natuurlijke grens inclusief composities en legacy,
gerichte regressies/probes/bewijs, deze prompt, PLANS en TASK_LEDGER.
De echte portrait-frameproef breidt ownership noodzakelijk uit naar de gedeelde
OnzeTrots-view, een begrensde matchday-CSSmodule en haar bestaande generator:
de oorspronkelijke portrait-CSS verbergt alle uitslagkaarten na de eerste.
Alleen een gevalideerde set met andere pouleteams krijgt ruimte voor twee of
drie bestaande kaarten; de drie panelen en cardtypografie blijven behouden.
De gekoppelde standscroll gebruikt de werkelijke viewport en bestaande vaste
paginaduur; de drie bestaande motioncallers in Control, Player en Worker
geven die duur door. Dat voorkomt afgesneden standrijen zonder releasewijziging.
Het generieke optionele `dynamicData`-veld breidt de manifest- en legacy
payloadbuilders additief uit voor RSS/menu/product en MenuDocument-binaries;
ook deze serverbuilders en hun tests vallen onder Player-ownership. Het oude
strikte `dynamicTemplate`-schema blijft behouden.
De verplichte mobiele Control-gate bevat op de baseline een verouderde
exacte URL-verwachting: `/dashboard/studio` verwijst al naar
`/dashboard/content`. Ownership omvat uitsluitend de passende verwachte
bestemmings-URL in `tests/e2e/control-mobile-scroll.spec.ts`, met behoud van
alle oorspronkelijke routebezoeken, viewports en inhoud-/scrollasserties.
De productroute en time-outs veranderen hiervoor niet.
Databaseagent is de enige migratiewriter; Player en Worker hebben afzonderlijke
paden. Root integreert en bezit operatie/bewijs/ledger. Geen dependency-, locked
asset-, serviceworker- of bestaande-klantplanningwijziging.

Bron→sync→database→queue→published_dynamic_data→manifest→gevalideerde projectie
→zichtbaar frame moet afzonderlijk worden bewezen. Productiediagnose bij
Duindorp is read-only en scopegebonden. Gebruik voor muterende acceptatie een
eigen lokale tenant en een afzonderlijke stagingcanary. Providercredentials,
devicetokens en raw providerresponsen komen nooit in logs/bewijs.

Behoud strikte eigen-teamselectie, thuis/uit en resolvercontext. Voeg expliciet
gevalideerde pouleuitslagen toe binnen het bestaande Uitslagen-paneel; behoud
drie panelen, eigen-teammarkering, officiële volledige stand en OnzeTrots-stijl.
Detailwaarnemingen bewijzen geen scopeafwezigheid en wissen geen officiële score.
Volledige scopewaarnemingen en lokale tijdgrenzen bepalen actuele selecties.
Een technische of partiële bronfout behoudt geldige blokken.

Iedere werkelijke dynamische afspeelbeurt controleert VeyoCast conditioneel.
Geverifieerde lokale inhoud start direct; actuele data wisselt op de bestaande
natuurlijke grens. Gebruik afspeeliteratie en item-/zone-identiteit, bestaande
coalescing/backoff, capabilities, LKG en assetvoorbereiding. Bronacquisitie blijft
centraal en beleid-/leasegebonden; configuraties en releases blijven immutable.

Normale workspace-, database/RLS-, build-, Player/offline-, Playwright- en
relevante toegankelijkheidsgates zijn vereist. Exacte geteste SHA, rode
reproducties, groene verificatie, stagingframes, tijdmetingen en concrete
toegangs-/hardwaregrenzen worden in de eigen bewijsdoc en PR vermeld.
