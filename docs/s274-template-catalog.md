# S274 — Compacte platformtemplatecatalogus

De oude catalogus zette iedere database-template in een grote kaart met een
markup-placeholder. De echte bevroren pagina werd circa75.452px hoog bij390 en
26.145px bij1440. De catalogus heeft nu een compact overzicht, een zoekveld,
statusfilter en serverpaginering van20. Mobiel staan naam en beschrijving over
de volle kaartbreedte; vorm en status staan ernaast. Alle templates en hun
versies blijven via de bestaande detailroute bereikbaar.

De bestaande capabilitycontrole en canWrite-grens blijven gelijk. De bestaande
user-scoped Supabaseclient leest eerst een exact, gefilterd aantal en daarna
alleen de begrensde pagina. Sortering op updated_at/id is deterministisch;
versiedata worden alleen voor de zichtbare IDs gelezen. Het GET-formulier start
op pagina1; paginalinks behouden filters. Ongeldige/te hoge pagina’s worden
begrensd en wildcardtekens in namen worden letterlijk gezocht. Count-/lijst-/
versieleesfouten tonen een herstelbare fout, geen lege-success-state. Ontbrekende
versiedata worden onderscheiden van nog niet publiceren. Geen nieuwe RPC,
mutator, database-/RLS-/historiewijziging of previewclaim.

Definitieve native Chromiumcases390/1440:2PASS10,771s,0skips/retries. De echte
async page/JSX/CSS las gecontroleerd45records: twintig per pagina, template21
via Volgende, terug via Vorige, zoeken1resultaat/status15resultaten,
99999→laatste5records, ongeldige pagina→eerste20, lege toestand, drie
leesfoutgrenzen en leesrechten zonder aanmaakactie. Queryvolgorde, twintig-grens,
stabiele sortering, maximaal20versieIDs en letterlijke %-/_-zoektekst zijn
gecontroleerd. Native GET-formulieren/links werken;0writes/browserfouten,
aXe0violations,44px/14pxvelden, beide viewports zonder document-/tabeloverflow.
De mobiele naamcel is breder dan de twee metadata-kolommen; hun y-positie is
gelijk. Werkelijke Sync-primarykleur wordt expliciet gecontroleerd.

Definitief nativebewijs:
`/dev/shm/veyocast-s274-native-candidate-a2b022d4-fbdd-4558-9959-38588bb07dd7`.
ScopedESLint en volledige Control-typecheck zijn0 in
`/dev/shm/veyocast-s274-static-084d555d-3ef6-4927-964f-1fc1ce1258a6`; daarna
veranderde uitsluitend de lokale mobiele CSS-specificiteit, opnieuw native groen.
Rootbron/geïnstalleerde SDK bleven gelijk en alle eigen runners/browsers sloten.
De eerste ontbrekende select-labelmatch, een onvolledige fixture-shell en een
mobiele cascadefout blijven als oude eigen outputs behouden; geen rode output is
gewist of als definitieve pass gepresenteerd. De fixture gebruikt nu dezelfde
Sync/app-shell-classcombinatie als de echte app.

Dit is echte component-/querycode met gecontroleerde session/database/Next-host.
Het is geen nieuwe Next-build, echte Auth/RLS-/provider-/Sourcepixelacceptatie
of volledige visuele ronde. Normale exacte-head CI en integratie volgen.
