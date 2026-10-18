# S231 — Rawmedia in de gekozen Source-editor

## Opdracht en besluiten

Voortzetting van de expliciet geautoriseerde volledige startprompt, niet van de
uitgestelde provider-/hardware-inrichting. Werkbasis f2a543c2c7906287fae39976f4a72cac005077b7
(S230), worktree /home/codex/repos/castivo-s231, branch
veyocast/s231-media-content-frames. S230-PR256/CI en staging/productie worden
onafhankelijk door root afgerond; deze taak verandert geen deploymentworkflow.

De echte rawmedia-Bewerkenroute opent nog een Media-inspector, geen SourceStudio.
Voeg een eigen tenantgebonden, gereviseerd media-ontwerp toe dat naar bestaande
geverifieerde assetbytes verwijst. Dupliceren maakt een logische inhoudskopie,
geen nieuwe upload of fysieke bestandkopie. Geen asset-UUID als Studio-project
behandelen, geen vrije Studio30s-render als willekeurig lange video gebruiken.

De Source is immutable Content.tsx/StudioPage/ContentMedia en bestaande CSS/assets.
Rawmedia is geen van de36families. Gebruik dezelfde Source-editorstructuur,
responsive flow, fit/focus en naam/orientation/durationbediening. Source rendert
bij rawmedia geen tekst/logo/footeroverlay: voeg er geen toe. Zulke velden zijn
hooguit expliciet begrensde opgeslagen metadata, niet zogenaamd zichtbaar beeld.
Trim/audio/volume blijven de bestaande echte playlistplaatsingsbediening;
geen nieuwe globale knoppen bedenken. Geen automatische clipping op30/120/180s.
Werkelijke assetbytes en bestaande geldige duur blijven behouden.

Opslaan maakt een nieuwe immutable frameversie. Bestaande playlistplaatsingen
blijven pinned en veranderen alleen na expliciet verversen; hun bestaande
plaatsingsoverrides blijven behouden. Gepubliceerde releases blijven onveranderlijk.
Alleen de server resolveert frameversie naar bestaande mediapresentatievelden,
met bron-ID/checksum/bytescontrole en expliciete frameversieprovenance.
Gebruik/archiefimpact en retentie moeten framekopieën van dezelfde asset kunnen
onderscheiden. Geen nieuwe Playerrenderer, workertranscode of decoder nodig.

## Governance en voorlopige ownership

Lees vooraf README, PLANS, TASK_LEDGER, technical-/design-/Publishercanon,
security-RLS/Playerofflinecanon en S226/S230. Supabasevaardigheden zijn van
 toepassing voor databasewerk. Fysiekehardware/24u, SendGridcredentials,
YouTube/Mollieaccountinrichting blijven uitgesteld; ze blokkeren dit softwarewerk niet.

Root bezit uitsluitend dit prompt, shared contractdefinitie en expliciet nog toe
te wijzen integratiecode/evidence/ledger. Nog GEEN andere writerownership:
eerst een read-only exact SQL-/RPC-/readmodel-/retentieplan, daarna bevestigt
root concrete unieke paden en het APIcontract vóór productcode. Een agent mag
geen high-conflictpad of bestaand protocol op eigen initiatief wijzigen.

Geen commit/push/merge/deploy door subagents. Geen package/lock/workspace-,
workflow-, service-worker-, native signing- of providerconfigwijzigingen.
Geen installatie door agents; root regelt eenmaal frozen/offline afhankelijkheden.
Geen reset van QA57621/DB57622; DBgates uitsluitend de bestaande disposable
mirror57721/57722 na rootcoördinatie. Eén browserworker tegelijk. Bewaar alle
bestaande captures/pogingen en huidige data; echte acceptatie gebruikt alleen
nieuwe exact geregistreerde eigen fixtures met hashcontrole van oude baselines.

## Benodigde gates

Betekenisvolle contract/RLS/CAS/idempotentie/tenant-A↔B/source-integritytests,
nieuwe versie versus frozen oude plaatsing/release, duplicate zonder bytekopie,
archive/restoreimpact en retentiebehoud. Echte upload→editor save/reload→gebruik
in playlist→immutable publicatie→download/hash/first-frame en cold-offline,
plus verloren-receipt/retry en actuele/foreign actorgrenzen. Desktop/mobiel
Sourcevergelijking met dezelfde data, aXe/44px/focus/overflow. Daarna bestaande
volledige CI en normale integratie/uitrol. Geen algemene pixel-/V1claim zolang
concrete vereisten onbewezen zijn.

## Bevestigde verdere scope vóór writers

De primaire librarykaart behoudt assetUUID/id en `media:assetUUID`, met ALTIJD
expliciet eigen frameId/versionId ook bij archived/onbeschikbare placement.
Copies gebruiken een nieuwe frameUUID en `media-frame:frameUUID`. Geen backfill
of dubbele primaire kaart. Eerste expliciete save maakt primary+v1 atomair;
GET schrijft niets. Archief wijzigt alleen frame, niet asset.

De Source overschrijft tijdens playback de editorvoorkeur met screen-/zone-
oriëntatie (Players.tsx33/44); geen nieuwe incompatibiliteitsblokkade bedenken.
Source-background is echter echte zichtbare logica bij contain/transparantie:
beide themegradients, light/gradient/stripes/clubmuur en gekozen private foto.
Die mag niet als inerte metadata worden weggerapporteerd. Root bevestigt daarom
vóór implementatie een kleine additieve backgroundpresentatieadapter voor de
beide Players, zonder engine/cache/LKG/timers of bestaand itemkind te wijzigen.
Nieuwe backgroundmedia worden via de bestaande geverifieerde manifestassets
verzameld en offline gedownload; geen URL/dataURL in opgeslagen settings.

Root bezit eerst uitsluitend packages/contracts/src/media-frames.ts, bijbehorende
test, exportregel in index.ts en de twee nieuwe playlistbatchoperaties in
playlist-batch.ts. De overige concrete writergrenzen worden na het vastzetten
van dit gedeelde contract per bestand in dit prompt toegevoegd.

### Bevestigde UIwriter

`release_audit` bezit uitsluitend de additieve propsslots in
`apps/control/app/(shell)/dashboard/studio/sync-studio-frame.tsx` en nieuwe
`content/media-frames/media-frame-editor.tsx`, `media-frame-editor.module.css`,
`media-frame-presentation.ts` en bijbehorende pure test. Bestaande defaults
blijven bytegedrag; alle previewlocaties gebruiken de nieuwe slots wanneer
rawmedia actief is. Geen bestaande doc-/actions-/route-/DB-/Playerwrites.
Root bezit `content/media-frames/media-frame-types.ts`, `media-frame-actions.ts`
en hun tests/routes/readmodel/integratie die later concreet worden bevestigd.
De onderstaande typesstub is vóór UIcode de overeengekomen props-/resultgrens.

UI gebruikt het bestaande SyncStudioFrame uitsluitend als formulierchrome, met
canonical MediaFrameSettings apart en zonder StudioDocument/renderopdracht.
Geen lastValid fallback/clipping van canonical metadata door het generieke
Sync-presentatieschema; expliciete gevalideerde adapter. Inerte metadata blijft
als metadata herkenbaar en voegt geen zichtbare tekstlaag toe. Sourcefit/focus,
naam, oriëntatie en duur blijven echte controls; thema/achtergrond werken echt.
Versiehistorie levert settings plus geverifieerde sources. Bij onzeker antwoord
blijft het volledige oorspronkelijke command vóór POST actor/tenant/frame- of
primaryassetgebonden bewaard; reload/retry voert exact hetzelfde uit.

### Bevestigde DBwriter en gedeeld ABI

`media_db` neemt vanaf20:25UTC de nog onbeschreven DBpaden over van de niet
meer actieve `binary_review` en bezit uitsluitend nieuwe forwardmigration
`supabase/migrations/20261018200500_sync_media_frames.sql` en nieuwe betekenisvolle
`supabase/tests/s231_media_frames.sql`, plus eigen `/tmp`-bewijs. Geen andere
migration/source/type/seed/contractwrites. Nieuw schema media_frames,
media_frame_versions en media_frame_version_assets (roles media/background);
immutable versies/refs, tenant-compositeFKs/RLS/defaultdeny en RESTRICT. Ontwerp-
copy wijzigt geen MediaAsset/variant/objectbytes. SQL valideert exact het gedeelde
`packages/contracts/src/media-frames.ts`, ook bij directe RPCcalls.

ABI vast vóór writes:
- create_media_frame_v1(p_tenant_id uuid,p_frame_id uuid,p_source_asset_id uuid,
  p_expected_sources jsonb,p_settings jsonb,p_idempotency_key uuid).
- mutate_media_frame_v1(p_tenant_id uuid,p_frame_id uuid,p_expected_revision integer,
  p_operation text,p_payload jsonb,p_idempotency_key uuid).
  save-payload {settings,expectedSources}; duplicate-payload {newFrameId};
  archive/restore-payload {}. Geen andere operations/keys.
- SuccessJSON {frameId,frameRevision,versionId,versionNumber,outcome}; outcome
  created/saved/duplicated/archived/restored/noop. FrameRevision is operationalCAS;
  versionNumber is de contentversie. Eerstecreate expectedRevision0, latere>0.
  Receipts van dezelfde actor/tenant/nonce+body vóór CAS/status; PT409-conflicten.
- get_media_frame_source_v1(p_tenant_id uuid,p_asset_id uuid) returnsjsonb
  {mediaAssetId,kind,title,fileName,width,height,durationSeconds,variant:{variantId,
  checksumSha256,byteSize,storageBucket,storagePath,mimeType},poster:zelfde|null}.
  Alleen tenant-scoped geverifieerde readybron. Root signeert paden met huidige
  gebruikerssession, geeft de browser uitsluitend DTOs/ephemeralURLs/fingerprint.
- get_media_frame_usage_v1(p_tenant_id uuid,p_frame_id uuid): begrensbaar gelijk
  bestaand get_media_asset_usage rowmodel usage_type/resource_id/title etc;
  onderscheid exactframe, ongeacht gedeeldeasset. Root leest count exact/range.
- Bestaande batch krijgt add_media_frame{clientId,frameId,expectedVersionId} en
  refresh_media_frame{itemId,expectedPinnedVersionId,versionId}, volgens shared
  schema. Bewaar bestaande PT409wrapper/privatebase en alle oude branches.

Draftitems hebben nullable media_frame_id/media_frame_version_id en expliciete
media_frame_overrides. Neem intent mee bij expliciete patch, ook gelijk-waarde-
patch. Refresh verandert alleen niet-overridden defaults; relevante defaults
zijn durationSeconds/fitMode/cropFocusX/Y/displayTitle/accessibilityName en
backgroundColor. Trim/audio/volume/transition/visibility blijven exact staan.
Kopieer binding+overrides via item-/playlistduplicate, authoringsnapshot,
release-restore en templateinstantiatie. Replace_media wist oude binding.

Release-items krijgen nullable immutable media_frame_provenance_json, afgeleid
vóór insert uit echte source-item en versie/refs, nooit clientJSON. Shape:
{schemaVersion:1,tenantId,frameId,versionId,versionNumber,settings,sourceAssets,
overrides}; sourceAssets bevat [{role,mediaAssetId,variantId,checksumSha256,
byteSize,storageBucket,storagePath,mimeType,width,height,durationSeconds}].
Root ontdekte dat huidige player-release-envelope.ts rechtstreeks
playlist_release_items selecteert; één extra nullable selectkolom is dus genoeg,
geen nieuw extra manifest-RPC/query/flag of destructieve signatureswap nodig.

Bibliotheekview: behoud alle bestaande kolommen/typen/volgorde, voeg achteraan
nullable media_frame_id/media_frame_version_id toe. Primarykaart behoudt
media:assetUUID en id=assetUUID; copies media-frame:frameUUID. Zelfs archived/
onbeschikbare source houdt eigenframe-ID/revisie voor veilig herstel; placement
is alleen beschikbaar met exact huidige geldige versie en bronhashes.
Frame-place descriptor {kind:'media_frame',frameId,versionId}; bron-ID blijft
expliciet buiten die logische identiteit.

Lockingkeuze: neem de bestaande tenant-media-metadatalock vóór rowlocks in de
betrokken wrappers en bescherm eerstecreate versus Storage-delete. Valideer
actuele actor/cap/tenant vóór een tenantlock; geen foreigntenantlock-DoS.
Respecteer bestaande lockvolgorde; geen asset-sharelock ná playlistlock.
Beperk Storage-deleteguard tot framegerefereerde assetpaden; behoud bestaande
policies en andere bucketsemantiek. Bestaande fysieke retentie is al geblokkeerd;
nieuwe FK/referenceguards beschermen ook gearchiveerde frameversies.

DBgates uitsluitend bestaande disposablemirror /tmp/veyocast-s226-gates-db op
API57721/DB57722. Binary mag daar na eigen migrationreview reset+RLS uitvoeren;
nooit QA57621/57622 reset/apply. Root reviewt en past later één forwardmigration
op echte lokale QA toe voor de nieuwe fixtures. Geen prodcredentials of remoteDB.

### Bevestigde rootintegratie en aparte testwriter

Werkbasis is inmiddels normaal gefastforward naar61dec8aac2702ccd4a17b89174c67f5a3ced412d;
S230 native-detailsfix en diens test raken geen nieuwe S231-writerpaden.

Root bezit concreet nieuwe `content/media-frames/media-frame-data.server.ts`,
`media-frame-archive-actions.tsx`, `content/media/[frameId]/page.tsx` en
`content/media/source/[assetId]/page.tsx`; bestaande `content/page.tsx`, `model.ts`,
`model.test.ts`, `content-workspace.tsx` alleen voor expliciete framevelden,
routes/plaatsing en frameacties; de al toegekende types/actions/contracts;
nieuwe gedeelde `packages/content-templates/src/media-frame-background.ts` met
pure test/exportregel in index.ts; Player `player-manifest.ts`,
`player-release-envelope.ts`, `player-cache.ts`, `sync-player-assets.ts`,
`player-runtime.tsx`, `screen-composition-zone.tsx` en de exacte legacy-runtime-
achtergrondadapter, plus gerichte eigen tests. Alleen additieve geverifieerde
assetcollectie/localisatie/achtergrondpresentatie; geen switch/timer/LKG-
versimpeling, decoderwijziging, nieuwe identity of serviceworker. Root bezit ook
eigen bewijs/docs/ledger. Nieuwe concrete bestaande Playerpaden vóór edit
nogmaals hieronder noemen zodra hun locatie is vastgesteld.

Exact Playerrootpaden: nieuwe `_lib/player-media-frame.ts`,
`_lib/player-media-frame-payload.ts` en hun tests; bestaande
`_lib/lg-legacy-page.ts` en diens gerichte test, `_lib/player-cache.test.ts` en
`_lib/player-release-envelope.test.ts`, plus nieuwe browserfixture indien nodig.
De kleine frameassetmap gebruikt het bestaande dynamic-assettype/collector:
maximaal één private achtergrond óf alleen de checksumbound clubmuurasset.
Daarvoor worden de elf algemene Syncassets niet extra aan een rawmediarelease
toegevoegd. Dit behoudt de bestaande strikte algemene assetmanifesten en voorkomt
een nieuwe onnodige cacheprofielgrens. Dezelfde pure Sourcebackgroundfunctie
wordt voor modern en als Chrome79-veilige ingebedde functie voor LG gebruikt.

`scenario_audit` krijgt naast read-only S230-CIwatch uitsluitend nieuwe
`content/media-frames/media-frame-actions.test.ts`, voor de daadwerkelijke
reeds geschreven serveractions. Geen productedits of installs/commits. Test
actuele capability/tenant vóór RPC, exacte oorspronkelijke commandbody/nonce,
onzeker antwoord versus PT409, verkeerde receipt en private bronpad/fingerprint-
guards. Root beheert mogelijke actionfixes na concrete bevindingen.

Vóór browsercode krijgt UIwriter release_audit ook exclusief het nieuwe
`tests/control/sync-media-frame-editor.spec.ts`: echte component/SSR-adapter met
alleen gecontroleerde Next/actiontransportgrens, verloren receipt/reload met
andere firstcreate-propsframeId, drie previewlocaties, metadata/sourcebinding,
44px/aXe/viewport/focus. Eén Chromiumworker, geen nieuwe Nextserver of installs.
Behoud mislukte pogingen en rapporteer productfindings; geen criteria afzwakken.

Root bezit ook nieuwe `content/media-frames/media-frame-card-preview.tsx` en
bijbehorende tests, voor Sourcegetrouwe saved fit/focus/achtergrond in de kaart.
De primary-IDregel blijft gelijk. DBwriter bevestigde vóór transportwijziging
create-RPC extra laatste `p_is_primary boolean DEFAULT true`: explicietfalse
maakt bij Dupliceren vóór eersteSave alleen een eigen logische copyv1. Shared
createcommand heeft optional isPrimary; ontbrekend blijfttrue. Receipt bevat
ook dit besluit; de bestaande legacykaart blijft zichtbaar zolang primary ontbreekt.

Concrete actorfinding vóór upload: root bezit nu alleen additieve opt-in
expectedActorScope-header in bestaande `playlists/_components/sites/upload-media.ts`
en `app/api/media/images/route.ts` met gerichte routetest. Bestaande callers zonder
header behouden hun contract; S231 vraagt de nieuwe header verplicht aan vanuit
zijn eigen editor. Route weigert scopewissel vóór client/formdata/Storagewrites.
Geen sessionkey, authschema of bestaande uploadlimiet wijzigt.

### Bevestigde playlistwriter voor echte expliciete versie-refresh

scenario_audit krijgt vóór writes exclusief bestaande `playlists/data.ts`,
`playlists/[playlistId]/sites-editor-data.ts`, de bijbehorende
`playlist-studio-contract.ts`, `playlists/_components/sites/model.ts`,
`playlist-editor.tsx`, `sites-playlist-workspace.tsx`, `playlist-command-plan.ts`
en hun bestaande tests plus nieuwe gerichte hersteltests. Exacte repository-
paden eerst in bericht aan root bevestigen. Alleen mediaFramebinding,
geverifieerde pinned/currentversie, expliciete refresh_media_frame, correcte
berekening van defaults versus intentoverrides en duurzaam origineel batch-
command actor/tenant/playlistgebonden vóór POST met identieke reload/replay.
Geen signedURLs in journal, geen nieuwe SQL/RPC of andere authoringrewrites.
Frame-rawduur mag niet door oude180s-presenterlimiet worden geclipt. Voeg geen
onbedoelde patch toe die na refresh oude defaults terugschrijft. Root bezit
onverminderd Content/cards/actions/contracts/Player; UIwriter MediaFrameEditor;
DBwriter migration. Dezelfde agent houdt de lichte S230-CIwatch aan.

De concrete nieuwe uploadcode CONTEXT_CHANGED vereist ook uitsluitend de
errorcode-union in `apps/control/lib/media/image-upload-api.ts`; root bezit die
additieve regel. De actoruploadroute-tests bewijzen weigeren vóór alle writes.

Playlistwriter krijgt ook de twee ontdekte ontbrekende grenzen expliciet:
`playlists/[playlistId]/page.tsx` voor actor/tenantprops en `playlists/sites-batch-actions.ts`
uitsluitend voor optionele expectedActorScope bij savePlaylistBatch, met diens
gerichte tests. Bestaande callers behouden hun defaultcontract; de actieve nieuwe
workspace moet scope doorgeven en vóór RPC vers laten vergelijken. Geen verdere
actie-/routewijzigingen of globale plannerrewrite.

Readmodelpadcorrectie: `playlists/sites-editor-data.ts`, zonder [playlistId].
Root bezit nieuwe `content/media-frames/media-frame-copy-usage.test.ts` voor de
twee nieuwe prepare-/usageactions; de bestaande82tests blijven bij scenario_audit.

UIwriter release_audit krijgt na eigen editorfreeze uitsluitend aanvullend
nieuw `tests/control/sync-media-frame-card-actions.spec.ts` voor echte root-
Contentkaartacties met gecontroleerde serveractiontransporten: firstcopy zonder
primary, journalvóórPOST/unknownresponse/reloadsamecommand, archiveconfirmusage/
geenwritevoorconfirm, receiptnaarchivedstate, scopewissel, 44px/aXe. Root bezit
alle cardactionproductfixes. Eén browserworker tegelijk; geen Next/installs.

Na echte kaart-aXefailures bezit root ook uitsluitend nieuwe
`media-frame-archive-actions.module.css` voor de dialoogbeschrijving en
bevestigknop met bestaande merk-/teksttokens. Root herstelt focusterugkeer via
onCloseAutoFocus/triggerref in de eigen cardcomponent. Geen globale Source/UI-
CSS of contrastcriteria wijzigen. Roodbewijs blijft behouden.

Concrete volledigePlayerunitbevinding:3bestaande lg-sites-runtime-tests hebben
alleen geëxtraheerde releaseAssets-functie zonder haar nieuwe echte helper.
Root bezit daarom uitsluitend die VMharnessopbouw in `_lib/lg-sites-runtime.test.ts`
voor het opnemen van de echte ingebedde validator en checksumbound clubmuurconfig.
Geen assertion/testbody/criteria veranderen, geenstubvalidator. Eerste474PASS/
3ReferenceErrorFAIL blijft behouden; daarna volledige477cases opnieuw vereist.

Playlistwriter krijgt ook exact nieuw `tests/control/sites-media-frame-playlist.spec.ts`
voor de echte actieve Workspace met gecontroleerd transport en duurzaam command-
herstel, actor/tenantwisseling, pinned/current/refresh en Sourcegebruik. Eén
browserworker; root start de echte UIproef pas nadat deze cohort klaar is.

Twee concrete volledige-flowbevindingen vóór QAapply: (1) een te lange
videoframeduur kan niet geplaatst worden onder het behouden bestaande maximum
max(5,ceil(werkelijke assetduur)); DBwriter heropent uitsluitend eigen migration/
test voor reject-zonder-clipping opcreate/save en bronduurzekerheid. Root/wezen
UIwriter voegt dezelfde bekende bronlimiet voor savevalidatie toe, met behoud
van ongeldige lokale invoer. Afbeeldingen behouden3600s, geen enginewijziging.
(2) interne Playlist-mediapicker moet dezelfde logische frames gebruiken als
Content. Playlistwriter krijgt daarom ook uitsluitend `playlists/library.ts` en
`_components/sites/playlist-media-picker.tsx` plus tests. DBwriter voegt één nieuwe
geautoriseerde read-only libraryRPC toe in eigen migration/tests: correcte
unifiedpagination/search/folder/collection/favorites, originele primary-ID en
extra source_asset_id/media_frame_id/media_frame_version_id. Bestaande fysieke
assetId-ackread voor uploads blijft gelijk, geen stil omzetten van bestaande
rawplaatsingen. RootQAforwardapply wacht op nieuwe DBfreeze en peerreview.

Concrete Playerpeerfinding: bij LGvideo transportretry worden oude achtergrond-
BlobURLs ingetrokken en als string hergebruikt. UIwriter release_audit krijgt
uitsluitend nieuw `_lib/player-media-frame-lg-retry.test.ts` voor een echte
gegenereerde-runtime/VM-regressie van pending én committed retry-lifetimes;
geen productedits, geen browser tegelijk met playlistcohort. Root houdt LGfix.
Vóór fix reproduceert nieuwe test de referentie/eigendomsfout; daarna moeten
nieuwe geverifieerde cacheURLs bij elke vervangende video horen. Geen decoder-,
transportkeuze-, retrybudget-, first-frame- of LKG-versimpeling.

MediaFrameEditor/UIpresenter zijn gefreezed. Root neemt uitsluitend hun gerichte
videobronduurvalidatie over (source.maxDurationDTO, save-refinement/hint/inputmax,
ongewijzigde lokale ongeldige invoer en exact pendingcommand), met gerichte
presentertests. Geen andere UIwriterwijzigingen tijdens deze rootintegratie.

Na de echte read-only bevindingen krijgt release_audit expliciet uitsluitend
`content/media-frames/media-frame-editor.tsx`, `media-frame-types.ts` en
`media-frame-data.server.ts` voor twee herstelgrenzen: actuele actor-writecap
`canReplayPending` los van nieuwe edits op een gearchiveerd frame, en exacte
frozen achtergrondfingerprints buiten de recente24-opties. Root stopt writes
op deze drie paden; diens bestaande videobronduurvalidatie blijft behouden.
Alleen reeds duurzaam bewaarde actor/tenant/resourcegebonden commands mogen
worden herhaald; geen nieuwe commandbody of algemene archive-editbypass.
Alle invoer blijft geblokkeerd tijdens replay; ook de Sourceheader moet de
exacte herhaling kunnen starten. Current frozen sources gaan vóór recente of
vandaagpreferred varianten, zonder historische bytes stil te vervangen.
Betekenisvolle tests blijven beperkt tot de bestaande
`tests/control/sync-media-frame-editor.spec.ts` en nieuw
`content/media-frames/media-frame-data.test.ts`; één browserworker pas na
vrijgave door de playlistwriter. Geen andere productwrites of commits.

Root bezit ook `docs/s231-media-content-frames.md`, de S231-verwijzing in
`PLANS.md`, de eigen S231-ledgerregel en gesaniteerde `execution/evidence/s231-*`
acceptatierapporten. Bewijzen mogen alleen afgeronde concrete proeven claimen;
staging/productie, externe providers en fysieke hardware blijven afzonderlijk.

Concrete echte publicatiegrens vóór de eerste S231-commit: de oude wizard telt
alleen hoofdmedia en previewt geen frameachtergrond. `scenario_audit` bezit
daarom uitsluitend aanvullend `playlists/[playlistId]/publish/page.tsx`,
`playlists/playlist-preview.tsx`, nieuw
`playlists/publish-media-frame-preview.server.ts` met gerichte test, en nieuw
`tests/control/sync-media-frame-publication-preview.spec.ts`. Binnen de eigen
`library.ts`/sites-model mag de geselecteerde versie optionele `byteSize` en
`backgroundByteSize` krijgen, uitsluitend uit reeds gecontroleerde frozen refs.
Pinned versies worden read-only geresolveerd, nooit door preferred/current
vervangen. Preflight verzamelt hoofd-/private achtergrond-/locked clubmuurbytes
met bestaande SHA-deduplicatie; expliciete backgroundColoroverride inclusief
null onderdrukt die achtergrond. De preview gebruikt dezelfde gedeelde pure
Sourceachtergrond met de geverifieerde URL en eigen fit/focus. Ontbrekende
framebytes blokkeren eerlijk de wizard; oude ongebonden items krijgen geen
nieuwe RPC of gewijzigde previewprops. Geen Player-appimports, SQL, workflow,
engine-, retry- of publicatiehashprotocolwijziging. Eén browserworker na rootGO.

Na bevestigde Source-interactiecontrole wordt uitsluitend de UIwriterownership
heropend voor `content/media-frames/media-frame-editor.tsx`, bijbehorende
`media-frame-presentation.test.ts` en bestaande
`tests/control/sync-media-frame-editor.spec.ts`: zeven bestaande Source-
metadatawaarden blijven werkelijk bewerkbaar (font, scale, alignment,
safeMargin, showLogo, showFooter, motion), via hetzelfde actor-/resourcegebonden
journal, undo en bestaande savecommand. Vormgeving/Instellingen behouden de
Source-controls en Nederlandse labels plus de eerlijke metadatahint; er komt
geen tekst/logo/footer-overlay boven rawmedia. De volledige geldige contract-
domeinen50..150 en2..12 blijven behouden; geen automatische Source-sliderclip.
Eén betekenisvolle browserproef toetst alle7 edits, undo, reload en exact save-
persistence; de14 bestaande cases/asserties blijven intact. Browseruitvoering
wacht expliciet op roots vrijgave na de lopende Playerproef. Geen SQL/contracts,
Player, routes/actions of andere productwrites en geen commit/push door deze
writer. Een uitsluitend noodzakelijke scoped checkbox-CSS-uitbreiding is vóór
schrijven apart aan root voorgelegd.

Root heeft vóór verdere writes deze smalle aanvulling bevestigd: UIwriter mag
ook uitsluitend `media-frame-editor.module.css` voor Source-checkbox14px binnen
44px kliklabel en metadata-formspacing met bestaande tokens aanpassen. Geen
sharedCSS. In `media-frame-presentation.ts` is alleen de form-chromeprojectie
`style.motion = settings.sourceMetadata.motion` toegestaan: bestaande Source-
editorintro gebruikt die echte keuze. Gerichte tests bewijzen alle3 motion-
waarden; overige metadata blijft uitgesloten van de rawmedia-overlay. Player-
payload/globalmotion/engine worden hierdoor niet gewijzigd.

Na de echte ongewijzigde Source-/AAL2-captures geeft root vóór writes uitsluitend
`media-frame-editor.tsx`, zo nodig zijn eigen `.module.css`, en bestaande
`tests/control/sync-media-frame-editor.spec.ts` vrij voor twee aangetoonde
presentatiefouten. De themaswatch krijgt Source `backgroundColor` vanuit de
bestaande opgeslagen accentDTO; geen nieuwe merkhex/tokens. `Accentkleur`
gebruikt exact de bestaande `Field`-props `controlWrapperClassName="vc-color-input"`
en hex-adornment uit `SyncStudioFrame`: compacte native swatch plus de echte
hexwaarde. Er veranderen geen controls, metadata-/save-/actor-/replaycontracten,
CSS elders, series of filmstrip. De oude15 browsercriteria blijven intact;
gerichte metrics voor Source-swatchRGB en compacte inputbreedte/hextekst worden
in de bestaande metadatajourney toegevoegd. Lint/type/full15 gaan vóór één nieuwe
read-only6-state Sourcecapturerun; origineel rawrapport en PNG's blijven bewaard.
Root heeft de enige browserworker hiervoor vrijgegeven. Geen commit/push.
