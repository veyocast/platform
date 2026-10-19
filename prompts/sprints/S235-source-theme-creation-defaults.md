# S235 — Source-thema voor nieuwe ontwerpen

Voortzetting van de geautoriseerde volledige rebuild en expliciete herhaalde
Source-afkeuring. Eigen branch `veyocast/s235-source-theme-defaults`, worktree
`/home/codex/repos/castivo-s235`, basis5365998e (S234 met normale mainb342merge).
S234-UI volgt eerst zijn eigen CI/staging/productie; deze branch niet integreren
vóór die gewone uitrol. Geen amend/rebase/forcepush. Lees normale README, PLANS,
TASK_LEDGER, technische/design/Publisher/security/offlinecanons en dit prompt.

Het read-only voorstel `/tmp/veyocast-s235-source-theme-contract-proposal.md`
SHA219ac4d097ede8fa568745785cf1a7448467aa86b0958b1a9afefc9e0831ddae
is het bindende beperkte ontwerp, met onderstaande exacte aanvullingen. De
oude tijdelijke SQL/pgTAPdrafts zijn voorbeelden, niet uitgevoerd bewijs.
Zeven Sourcevelden krijgen onafhankelijke persistente nieuwe-ontwerpdefaults.
De bestaande Royal Current-uitrol, tenant_settings.default_theme_id, oude
profile.revision/appearance/updated_by/theme_version, ontwerpen en immutable
releases blijven eigen autoriteiten. Geen demo-save of hernoemde oude uitrol.

## Vastgezette ABI en Sourcegrenzen

- Payload exact accent/font/mode/scale/background/motion/showLogo; geen schema-
  versie, URL of ander veld. Exacte enums/bounds uit voorstel; case van HEX bewaren.
- Nieuwe defaults zijn nullable met eigen safeintegerCAS0..MAX_SAFE_INTEGER.
- Oningestelde beginwaarden komen uit daadwerkelijke Source store.tsx: accent
  FieldFlow `#006D83`, OnzeTrots `#1268e8`; fontManrope, mode light, scale100,
  background clubkleur, motion rustig, showLogo true. Expliciet oningesteld,
  geen afleiding van bestaande Royal Currentappearance. Echte versies1.0.0/11.0.0.
- SourceAdminmodal erft daadwerkelijk26pxh2 en onder600px24px, niet generieke
 19/17. Gebruik960px/370op390,22/18radius,22x26/18padding,18pxstackgap,
  echte2/1kolommen/preview en44pxcanon. Source CSS/assets blijven bytegelijk.
- Georgia→Serif metfontChangedtrue; light heeft backgroundlightvoorrang;
  dark/auto gebruikt clubkleur→gradient of gekozen gradient/stadium. Auto is
  geen klok/OS/Player-runtimefunctie. Behoud overige feiten en gekozen logo-ID.
- Defaultkeuze leest tenant_settings; geen writer verandert die selectie.
  Onbekende historische defaultThemeId blijft opgeslagen en geeft een zichtbare
  starterfallback. Geen defaultinhoud uit previews in echte ontwerpen opslaan.
- Bestaand scratch/pending en bestaande projectseeds worden nooit uit nieuwe
  defaults herbouwd. De legacy nieuwe-bronroute mag naar unified wizard sturen,
  uitsluitend zonder projectparam; bestaande projecttak bytegelijk houden.

Publieke SQL-ABI exact bestaande draftnamen:
`read_sync_theme_creation_defaults_v1(p_tenant_id uuid)` geeft
`{schemaVersion:1,tenantId,defaultThemeId,profiles:[{themeId,themeVersion,revision,
configured,defaults}]}` terug met exact de twee ondersteunde profielen.
`save_sync_theme_creation_defaults_v1(p_tenant_id uuid,p_theme_id text,
p_expected_revision bigint,p_defaults jsonb,p_idempotency_key uuid)` geeft
`{schemaVersion:1,outcome:'applied'|'noop',tenantId,themeId,revision,defaults}`.
Volledige parentreceipt vóór profielCAS; noop geen revisiebump. Alleen ontbrekend
vereist profiel provisionen, geen onvoorwaardelijke ensure-INSERT-pauseguard.

Contractexports in nieuw `packages/contracts/src/sync-theme-creation-defaults.ts`:
`SyncThemeCreationDefaults`, `SyncThemeDefaultsProfile`,
`SyncThemeDefaultsReadModel`, `SyncThemeDefaultsCommand`, `SyncThemeDefaultsAck`
plus overeenkomstige strict Zodschemas. Command exact5sleutels tenantId/themeId/
expectedRevision/defaults/idempotencyKey. Schema's bewaren geldige body/nonce;
ACK strikt tegen oorspronkelijke command/revisie/thema/tenant/payload toetsen.
Serveractie `saveSyncThemeCreationDefaultsAction(input:unknown,expectedActorScope)`
geeft `{ok:true,value:SyncThemeDefaultsAck}` of
`{ok:false,code:'invalid'|'denied'|'conflict'|'unavailable',uncertain,message}`.
Readonly `readSyncThemeCreationDefaultsAction(expectedActorScope)` gebruikt
zelfde resultvorm met ReadModel. Bepaal alleen verse eigen actor+tenantserverside.

## Exclusieve ownership vóór writes

`media_db` bezit uitsluitend nieuw
`supabase/migrations/20261019010000_sync_theme_creation_defaults.sql` en
`supabase/tests/rls_s235_sync_theme_creation_defaults.sql`. Geen bestaande SQL,
seed, databasepackage/types, dependencies, workflow, Control, Player wijzigen.
Gebruik drie kleine nieuwe functiondefs/2kolommen zoalsdraft, ACL/defaultdeny,
search_pathleeg en bestaande capability/receipt/lifecycle/pauseguards. Bestaande
profielen krijgen uitsluitend nieuwe kolommen, provisioning alleen ontbrekend.
Bewijs gevulde oude ontwerp-/publicatierijen en behoud van oude rollout-API.

`scenario_audit` bezit uitsluitend nieuw contractsbestand + eigen `.test.ts`
en de noodzakelijke additive export in `packages/contracts/src/index.ts`;
nieuw `apps/control/lib/sync-theme-creation-defaults.ts` + `.test.ts` voor pure
projector/beginwaarden; nieuw themes/sync-theme-defaults-data.server.ts en
sync-theme-defaults-actions.ts met eigen tests; bestaande wizarddata/types/
state/component en hun eigen tests uitsluitend voor daadwerkelijke defaults-
integratie; bestaande slides/new/sync/page.tsx uitsluitend genoemde verse tak.
Geen Theme-UIpagina/dialog, SQL, renderer, globaleCSS, assets, Player, package/
lock ofworkflow. Zet eerst contractexports+UI-propsvoorstel vast en meldUIagent;
geen dubbele reader/writer/projector inclient. Bronpreservatie/legacyjournals
blijven leidend. Nieuwe API is expliciet mislukt als read corrupt/mislukt is;
geen stille fallback die opgeslagen data overschrijft.

`release_audit` bezit uitsluitend themes/page.tsx voor juiste settings.read-
guard en catalogus→Source-dialogintegratie met bestaande catalogusread, nieuw
sync-theme-defaults-dialog.tsx/.module.css en zuivere lokale recovery-state/
.test.ts in dezelfde map, plus nieuw tests/control/sync-theme-defaults.spec.ts.
Geen serveractions/contracts/wizard/SQL/Source/sharedCSS/depswijzigingen.
Gebruik afgesproken exports. Eigen actor+tenant+themejournal vóórPOST, volledig
JSONopslagbaar, verliesantwoord/reloadzelfdebody+nonce, onzekere afwijzinghoudt
pending. Scope/late-resultaatfence, opslagfoutgeenPOST; expliciete conflict/
dirty-close-herstelkeuzes. Bewaar echte advancedhuisstijluitrol-link.

Root bezit docs,ledger,prompt, bewijs/integratie/CI/actualQA en uitrol. Wijzigingen
buitenownership eerst concreet stop-report. Geen eigen commit/push/deploy/install.
Eén browserworker op expliciete rootGO; eerst code/statics/freeze.

## SQL-uitvoering en betekenisvolle gates

Alleen disposable `/tmp/veyocast-s226-gates-db`, CLIprojectveyocast-s226-gates,
API57721/DB57722, docker supabase_db_veyocast-s226-gates mag na eigen exacte
label/poort/resolvedpathcheck worden gespiegeld/gereset. S232gates zijnafgerond;
geen andere SQLagent voert er nog tests uit. Root verleent uitsluitend voor
S235 deze reset/test/lint-GO. WerkelijkeQA57621/57622, uploads/auth, staging en
productie blijven onaangeraakt. Geen historyrepair/include-all/dbpush naarQA.
De S235branch heeft196basis-migraties; met deze forward197. S232migratie blijft
alleen in zijn eigenbranch tot normale integratie, geen heimelijke repoSQLcopy.

DB: capability/tenantA-B/anon/directDML/paused/archived, exact7velden/CAS/noop,
receipt vóórCAS/changedbody/unknownnonce/revocation/resume/atomicrollback,
missing-onlyprovisionguard én paused bestaandeprofielen, gevulde immutable
oldrowsbehoud, echte sessieraces, verse fullRLSsuite+public/privateerrorlint.
Pure/server: projectie alle36families/beidethemas/standen,Georgia/fontChanged/
lightprecedence/noURLs, verseactorscope/strictACK/geenoudeuitrolRPC.
Browser:390/1440Sourcechrome/44px/aXe/focus/Escape/scroller, zevenwerkelijke
velden→echterenderer, pendingstorage/lostresponse/reload/lateactor/CASrecovery.
Root aparte echte AAL2save/receipt + nieuwe manual/connected frozenstijl en
oude designs/releases/hashbehoud, staging/productie. Geen volledigeV1claim.

Root volledige foundation vindt na concurrency-timeouts een echte package-
boundarytestfout: de nieuwe Vitesttest staat ten onrechte onder contracts/src,
waardoor een frameworkimport in productiebron wordt gezien. Root neemt
uitsluitend dit testbestand over en verplaatst het naar
`packages/contracts/test/sync-theme-creation-defaults.test.ts`, met alleen
relatieve importaanpassing. Alle assertions blijven bytegelijk, scanner/
dependencies/lock niet wijzigen. Behoud beide rode fullrunlogs; daarna volledige
zelfde30 testtaken opnieuw met concurrency2, zonder deadlineverruiming.

De daaropvolgende volledige suite vindt één bestaande statische UI-contracttest
met een verplaatste link: catalogus-Instellen opent nu de echte Source-dialog;
de theme-scoped geavanceerde uitrolhref staat in die dialog, niet meer op de
cataloguskaart. Root bezit uitsluitend dat ene testgeval in
`apps/control/lib/dynamic-slide-versioning-ux-contract.test.ts`: lees aanvullend
de echte dialogbron en toets dezelfde theme-scoped uitrolhref daar, plus
catalogus→dialogverbinding. Alle andere assertions, aantallen en deadlines
blijven behouden. Geen productwijziging of omzeilen van de uitrolgrens.

## Root echte route-audit: cataloguspreview

De vierde echteAAL2proef bereikt alle zeven ingesteldevelden zonderwrite maar
stopt terecht op echtewholepageaXe: de oude catalogusmock heeftFieldfloworange
#ff7a1a en laagcontrast8pxtekst. Dit is een echteproductbevinding, geenreden
aXeuittezetten of achtergrondteexcluderen. Root krijgt aanvullend uitsluitend
nieuwe `apps/control/app/(shell)/dashboard/themes/sync-theme-catalog-preview.tsx`
en `.module.css` plus de reedsowned cataloguspagevrij: vervangdecoratie door
dezelfde SyncSlideStaticView/createSyncStudioStarter/applydefaults alsnieuwe
ontwerpen. Toon echte opgeslagenprofieldefaults ofexplicieteSourcebeginwaarden,
geen claimdatnieuwe-ontwerpdefaults alglobaaluitgeroldzijn. Miniatuur is een
benoemd beeld met expliciete toegankelijke alternatieftekst; microscopische
TVpixels zijn decoratievebeeldinhoud en geen tweede interactieve UI. Geen
controls of echteveldenverbergen. Primairecataloguscopy/metadata14px. Geen
manifest/token/SourceCSS/security/writer/schemawijziging. Echteharnessvorige
0command/alleoudegegevensbehouden; origineleaXerood blijft. Verduidelijkte
wrappedselectlocators en gebatchteidentieke162tabel-hashreads zijnharnessdelta's.

## Root normale dependencyintegratie
Integreer S234 via gewone merge, behoud2nieuwe defaults-browsercases en alle
11bestaandecases bytegelijk; importeer het door S234 geëxtraheerde gedeelde
fixturehelper. Root ownership omvat uitsluitend imports in eigen spec en
het verwijderen van één bestaande lege EOFregel in die helper (geen gedrag).
Actuele20wizard/defaultscases na integratiePASS0skip0retry; oorspronkelijke
merge-/whitespacebevinding bewaard. SQL blijft identiek aan echteQA-forward.
