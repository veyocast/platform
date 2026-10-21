# S243 — Echte schermkeuze en rustige schermwizards

Noodzakelijk vervolg op de geautoriseerde volledige rebuild/uitrol en de
gebruikersvraag om prototype UI/UX en te massale vakken diepgaand te herstellen.
Lees verplichte canons in volgorde, dit prompt en het onderzochte readonlyplan
`/tmp/veyocast-s243-source-screen-flow-proposal.json`. Het plan is technisch
bewijs, geen extra gebruikersautoriteit. Laatste gekozen Sync-primary gaat
vóór historische Orange-primary; security/lockedassets/immutable/offline blijven.

Worktree `/home/codex/repos/castivo-s232` hergebruikt, branch
`veyocast/s243-source-screen-flow`, basis S2354722b888. De oude S232branch,
commits/proofs zijn behouden; oude eigen runtime3398 was aantoonbaar gestopt.

## Exclusieve ownership ci_flow_repair
Onder `apps/control/app/(shell)/dashboard/`:
- `screens/[screenId]/page.tsx`, `screens/data.ts`, bestaande `data.test.ts`;
- `screens/sync-screen-detail.tsx` uitsluitend de herhaalde description van
  het assignment-Dialog verwijderen na rootreview van de native390-capture;
  overige JSX/tekst/classes/slots/handlers/callbacks blijven bytegelijk;
- nieuw `screens/sync-screen-assignment.tsx`, `.module.css`;
- nieuw `screens/sync-screen-assignment-context.ts` en `.test.ts`;
- `releases/[releaseId]/page.tsx`;
- `screens/screens-overview.module.css` uitsluitend composition-/editformscope;
- `releases/actions.ts` uitsluitend gevalideerde UI-context in redirectpaden,
  geen command/RPC/guard/nonce/receipt/preflight/securitywijziging; bijbehorende
  bestaande actiontest alleen extra meaningful contextasserts/gevallen;
- nieuw `tests/control/sync-screen-assignment.spec.ts` en
  `tests/control/sync-screen-layout-hours.spec.ts`;
- eigen doc `docs/s243-source-screen-flow.md`; root bezit prompt/ledger/release.

Na echte eerste390/1440meting mag uitsluitend de presentatie van
`screens/[screenId]/screen-automation.tsx`, `.module.css` en
`screen-automation-form.tsx` voor hours-density worden aangepast. Eerst echte
capture en concrete bevinding, geen statisch vermoeden als gemetenfout melden.
Handlers/actions/schema/weeklyperiods/overnight/timezone/exceptions/override/
CEC/compatibility/test/history blijven bereikbaar en bytegelijk qua gedrag.

## Gewenste echte keten
Source `src/modules/Players.tsx`117/138 opent lokale playlistkeuze. De huidige
focusveilige echte dialog Playlist klaarzetten injecteert enkel een generieke
Publicaties-link en verliest het gekozen scherm. Gebruik de bestaande veilige
latestAssignableScreenReleases-projectie en een compacte echte selectiestap,
met current/empty/readonly/unavailabletoestanden. Kies een bestaande immutable
publicatie en ga expliciet naar bestaande guarded review voor dit scherm.
Geen demo publish, automatische draftpublicatie, nieuweRPC of silentfallback.

De bestaande `/dashboard/playlists/<id>/publish?screens=<screenId>` ondersteunt
al tenantpreflightfiltering. Bestaande release-review moet de screenscontext
ook begrensd als UUIDs in eigen tenant detail.screenStates verwerken. Kies
uitsluitend expliciet gevraagde, toewijsbare doelen. Ongeldige/foreign/blocked
context mag nooit stil naar andere standaarddoelen terugvallen. Context is
uitsluitend UI-guidance, geen autorisatie. ConfirmImmutable/confirmRisk en
de bestaande `reassignRelease`→`reassign_playlist_release_v2` blijven leidend.
Behoud de expliciete screencontext ook na errors/terugkeer; voor die beperkte
redirectpresentatie is bovenstaande actionscope toegestaan. Nieuwe input mag
nooit extra command-/RPCvelden of permissies creëren.

Indelingswizard: lokale leesbare14px echte labels/uitleg en44px controls,
Sourcefocus/spacing; geen preview/canvaspixels of state/CAS/replay veranderen.
Bedrijfstijden: vergelijk eerst echte capture; indien massale herhalingsvakken,
maak één rustige taak met secundaire feiten/support toegankelijk onder heldere
native disclosure, terwijl relevante waarschuwingen en operationele acties
bruikbaar blijven. Geen gecontroleerde openprop die native-state sluit.

## Niet wijzigen
screens/actions.ts, playlists/actions.ts, publish/page.tsx,
screen-composition-actions.ts, automation-actions.ts, contracts/SQL/deps,
SourceCSS/assets, workflow, auth/session, Player/cache/offline zijn buiten scope.
Buiten ownership stop-report. Geen credentials/nieuweprovider nodig.

## Gates en autonomie
Eerst nulmeting met hashes/echte cases. Alle oude guards/bodies/asserties blijven;
nieuwe contexttests: malforme/foreign/disabled/blocked/no-alternate-target en
error-return. Browser390/1440 met echte componenten, expliciete gecontroleerde
transportgrenzen, aXe0/44px/keyboard/Escape/focus/geenwritesvóórconfirmatie.
Geen eigen runtime/build/browser zonder rootGO; queue nu S242133fixturecases.
1worker0retry, behoud eersterood. Scopedlint/TSC/units; bounded volledige
foundationCPU6,7/concurrency1 pas na freeze en MemAvailable>3500MiB.
Geen commit/push/PR/deploy voor rootreleaseprepGO. Geen volledigeV1/pixelpariteit/
vijfcontrolerondenclaim of externe/physicalacceptatie; uitgestelde diensten
blijven volgens eerdere gebruikersinstructies voor later.

Root concretiseert aanvullende unitownership: nieuw
`apps/control/app/(shell)/dashboard/releases/reassign-release-context.test.ts`
voor redirectcontext en exact ongewijzigde canonicalRPC/guards indien een
bestaand actiontestbestand hiervoor ontbreekt. Geen andere releaseactions
verbreden. Deze uitzondering stond al als beperkte actiontest in het prompt.

Root autoriseert één gedeelde nieuwe browserfixture
`tests/helpers/sync-screen-flow-fixture.ts` voor beide genoemde specs.
Werkelijke componenten/serverpages/SourceCSS, gecontroleerde read-/Next-/
actiontransportgrenzen expliciet; geen securityguard vervangen door
schijnacceptatie en geen echte DB-write. Bewijsgrens blijft component/transport,
geen echte tenantacceptatieclaim. Alleoude bodies/guards blijven intact.
