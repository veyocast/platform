# S238 — Bereikbare OnzeTrots-achtergronden, volledig offline bewaard

De gebruiker mist de OnzeTrots-achtergronden en vraagt een diepgaande controle
binnen de volledige geautoriseerde rebuild en staging-/productie-uitrol.
De read-only audit bewijst41 byte-exact goedgekeurde oudere assets in beide
apps; daarvan zijn zes de echte drie achtergrondscènes in twee oriëntaties.
De nieuwe Synckeuze biedt die niet aan. Geen bytes reconstrueren, geen logo's
of foreground als achtergrond benoemen en geen legacy-beheerpagina terugzetten.

Worktree `/home/codex/repos/castivo-s238`, branch
`veyocast/s238-onzetrots-background-gallery`, basis0b7619e1. Het schone reeds
gemergede S230-worktree is hergebruikt; oude branch/geschiedenis behouden.
Lees normale canons en het expliciet eigen read-only plan
`/tmp/veyocast-onzetrots-background-implementation-plan.json`, SHA256
ce9ab2129741968b714dddd41ae0aa98e51911e79a6b86dcec4d1a6d52531409.
Dit plan is een onderzochte technische aanpak, geen nieuwe gebruikersautoriteit.
S234 herstelt onafhankelijk Clubmuur in opgeslagen editor. S235-defaults en
S232-filmstrip worden via normale integratie behouden; hun freezes niet wijzigen.

## Ownership / schrijf-GO voor scenario_audit

Uitsluitend onderstaande paden, geen dependency/lock, workflows, SourceCSS,
generated Source-assets, nieuwe bytes, serviceworker of andere migraties:

- nieuw `packages/contracts/src/sync-background-catalog.ts` en `.test.ts`
- `packages/contracts/src/sync-slide-presentation.ts` en additive export in
  `packages/contracts/src/index.ts`; bestaande `sync-system-assets.ts` blijft
  bytegelijk met exact11 kernassets
- nieuw `apps/control/app/(shell)/dashboard/studio/sync-background-picker.tsx`
  en `.module.css`
- nieuw `apps/control/lib/sync-background-choice.ts` en `.test.ts`
- `apps/control/app/(shell)/dashboard/studio/sync-create-wizard.tsx`
- `apps/control/app/(shell)/dashboard/studio/sync-studio-frame.tsx`
- nieuw `tests/control/sync-background-picker.spec.ts`
- uitsluitend nieuwe relevante gevallen in `tests/control/sync-create-wizard.spec.ts`
- nieuw `supabase/migrations/20261019020000_sync_approved_backgrounds.sql`
- nieuw `supabase/tests/rls_sync_approved_backgrounds.sql`
- `apps/media-worker/src/sync-dom-capture.tsx`
- `apps/media-worker/test/sync-dom-capture.test.tsx`
- uitsluitend nieuwe relevante gevallen in
  `packages/content-templates/test/sync-dynamic-projector.test.ts`
- `apps/player/app/_lib/sync-player-capabilities.ts`
- `apps/player/app/_components/player-runtime.tsx` alleen de nieuwe capability
- `apps/player/app/api/player/manifest/route.ts` en bestaande `.test.ts`
- `apps/player/app/_lib/player-release-envelope.ts` en bestaande `.test.ts`
- `apps/player/app/_lib/sync-player-assets.ts` en bestaande `.test.ts`
- `apps/player/app/_lib/sync-player-presentation.ts`
- `apps/player/app/_components/sync-studio-media.tsx`
- `apps/player/app/_lib/sync-release-envelope.test.ts`
- `apps/player/app/_lib/sync-dynamic-release-fallback.test.ts`
- nieuw `tests/player/sync-background-gallery.spec.ts`

Rapporteer noodzakelijke andere paden eerst; geen blinde scope-uitbreiding.
Root bezit docs, ledger, prompt, integratie, echte AAL2-acceptatie, PR en release.
Geen eigen commit/push/deploy. Eén browserworker, uitsluitend aparte rootGO.

## Vast contract en compatibiliteit

Gebruik uitsluitend bestaande exacte beelden Houtrust, De wijk en Aan zee,
met de zes path/SHA/byte/MIME/dimensies uit het onderzochte plan. Nieuwe aparte
catalogus met dezelfde source-provenance; geen uitbreiding van de vaste11
Source-rendererassets of historische41-assetmanifesten. Achtergrondref heeft
bestaande `kind:system,path,checksumSha256`, `style.background=photo`.
Alleen achtergrondrol accepteert die zes paden; logo/club/sponsorrol niet.
De huidige v1-JSONstructuur blijft hetzelfde. Bestaande documenten en opgeslagen
pending/scratch worden bij lezen nooit omgezet of uitgebreid.

Additieve expliciete capabilityheader:
`X-VeyoCast-Sync-Backgrounds: sync-backgrounds-v1`. Bestaande headers/waarden
blijven geldig. Zonder die capability blijven oude envelopes exact compatibel
met hun elf kernassets; galerie-items gebruiken dan de bestaande complete
geverifieerde binaire fallback. Nieuwe moderne clients krijgen core11 plus
uitsluitend werkelijk gerefereerde extra assets, exact gevalideerd en gededuped.
Neem de capability op in relevante ETag/Vary/304 en alle composition-zone-
requests. Geen algemene downgrade van moderne DOM/live content naar binaries.

Nieuwe forwardmigratie wijzigt uitsluitend de noodzakelijke private validators:
`assert_sync_slide_v1` achtergrondallowlist en de role-aware systeemrefcontrole
in `assert_sync_dynamic_render_presentation_v1`. Bewaar iedere bestaande
structurele/tenant/privacy/capability/status/nonce/CAS/checksum/readygrens.
Geen historisch SQL wijzigen, geen nieuw RPC, tabel, policy of databackfill.
Een galerijbeeld mag niet via de oude tijdelijke club.logo-validatortruc als
logo geaccepteerd raken. Bestaande immutable releases/snapshots blijven bytegelijk.

Een gedeelde mooie kiezer in verse wizard en opgeslagen manual/connected editor
toont vijf vaste presets plus drie herkenbare echte scène-miniaturen, echte
labels,44px, focus, mobiele flow en eigen tenantachtergrondkeuze. Oriëntatie
wisselt uitsluitend bij expliciete gebruikershandeling de geselecteerde scène
naar zijn gepaarde variant. Herstelde pending/immutable inhoud blijft exact.
S235's zeven velden, expliciete themekeuze/defaultprojectie en lightprecedence
blijven intact; een expliciete achtergrondkeuze na thema/defaults wint normaal.

Werkercapture gebruikt bestaande lokale assets/size/SHA/MIME/budgets/CSP-guards.
De echte renderer toont dezelfde gekozen foto/overlay/positie. Volledige binary
bevat de achtergrond voor oude WebViews/StaticLG. Moderne pending decodeert en
verifieert de extra beelden vóór activatie. Ontbrekend/corrupt beeld laat LKG
spelen; natuurlijke overgang, offlinecoldstart en oude11-assetcaches blijven.

## Gates en uitvoering

Maak eerst typed catalogus/capabilityABI en rapporteer exacte variantkeuze-
semantiek en SQLfunctiediffs aan root; daarna binnen scope implementeren.
Meaningful units bewijzen role/path/SHA rejection, oude presets/core11/oldcache,
beide oriëntaties, canonical livefactupdate met bevroren achtergrond, worker-
capture en compleet binary fallback. RLS bewijst beide tenants/rollen/statussen,
geen nieuwe logoallowlist, ongewijzigde oude data en canonical authoring.
Browsercases bewijzen echte selectie→saved request→reload/pendingreplay en
cached image readiness/offline/corrupt pending behoudLKG. Behoud originele
rode resultaten en alle bestaande regressieasserties; geen skip/tolerantiehack.

SQLtests uitsluitend na afzonderlijke rootGO op disposable gates57721/57722,
met label/poort/resolvedpathguard. Werkelijke QA57621/57622 NOOIT resetten of
migreren: root doet later exact één forward. Geen productiecredentials,
providerrequests of runtimewijzigingen nodig. Fysieke LG/Androidacceptatie
blijft door gebruiker uitgesteld; geen hardware-supportclaim.

## Exacte private functieketen na codelezing

De bestaande topvalidator is door latere Engage- en YouTubewrappers omgeven;
de oorspronkelijke achtergrond-/rolcontrole heet nu
`private.assert_sync_slide_before_youtube_v1`. De nieuwe forwardmigratie mag
uitsluitend die bestaande oorspronkelijke helper CREATE OR REPLACE uitbreiden,
plus de genoemde `private.assert_sync_dynamic_render_presentation_v1`.
Topvalidator en beide wrappers blijven bytegelijk; dezelfde bestaande
security/search_path/grants worden behouden. Dit vervangt uitsluitend de
te algemene topfunctienaam uit het voorstel, geen nieuwe migratieownership.
Lever vóór SQLtests exacte functiediff en bewijs dat alle wrappers en andere
validatieregels gelijk bleven. Geen execution opQA57622 of productie.

De gedeelde visuele kiezer vervangt de oude achtergrondcombobox. Agent bezit
uitsluitend aanvullend de twee bestaande wizardbrowser-interacties die
Achtergrond.selectOption(photo) gebruiken: kies voortaan de werkelijke
knop Eigen foto kiezen. Alle originele input/rechten/DTO/preview/save/
recoveryasserties, caseaantallen en deadlines blijven bytegelijk; geen
mockup of andere baselinewijziging. Root bevestigt normale volledige frozen/
offline dependencyvoorbereiding zonder scripts:491packages uit bestaande
store,0downloads; package/lock/workspacehashes vóór/na identiek.

Root's S235fullfoundation vindt een concrete packageboundaryregel: Vitesttests
horen in contracts/test, niet contracts/src. S238 catalogustestownership wordt
hiermee exact `packages/contracts/test/sync-background-catalog.test.ts` in
plaats van src/*.test.ts. Verplaats uitsluitend nieuw eigen test indien al
gecreëerd en pas relatieve imports aan; alle assertions behouden. Geen nieuwe
Vitestproductdependency of verandering van scannerregel. De echtecatalogus
blijft onder src. Alleenrootlegtdezeownershipcorrectievast.

## Aanvullende concrete readiness-/headergrenzen

Codelezing bewijst dat hydratePreparedRelease momenteel alleen SHA/bytes en
cacheURL verifieert, terwijl SyncStudioMedia pas na activatie decodeert. Agent
krijgt uitsluitend aanvullend `apps/player/app/_lib/player-cache.ts` en de
bestaande `player-cache.test.ts` vrij voor gallery-only decode van de
geverifieerde gecachte URL vóór activatie, inclusief compositionzones en
coldstart. Geen verandering voor core11/andere bestaande media, SW, cache-
formaat, schema, release-identiteit of switchgrens. Decode heeft een begrensde
failure/timeout; geen externe herfetch of activatie bij decodefout. Revoke
uitsluitend eigen nog niet geactiveerde objectURLs bij fout, nooit actieve
LKG-URLs. Betekenisvolle tests bewijzen geldig/corrupt/niet-decodeerbaar beeld,
LKGbehoud, oude11caches en geen URLlek. Rapporteer exacte interface vóór
breder readiness-/cachegedrag; geen offlineversimpeling.

Agent krijgt uitsluitend aanvullend
`apps/player/app/api/player/manifest/live-target.test.ts` vrij: voeg de nieuwe
header toe aan de exacte bestaande Vary-verwachting en toets de echte
geautoriseerde capability/ETag/304/compositionpass-through. Alle bestaande
live-target/privacy/auth/target/asserties/deadlines blijven behouden; geen
verruimde cacheacceptatie of fixturelivepermissions in product.

## Root review cold galleryfontbewijs en echt binarytestbewijs

V3actualPlayerfirstred2/9PASS7FAIL; zesgallerybeelden/sourcecache/SHA/page2
onlinegoed, coldgallerydecode1672x941goed maar Inter/Manrope FontFaceSet.load
faalt wegens overlappende globale network@font-faces dieofflineonbereikbaar
zijn. Readonlydiagnose dddb288ecb5be85ccc1a1a6ef1c143e618de3ba452967c503efe244808701bec
bewijst timing+V3chunk/cap/cache/afbeeldingdecode; geenmanifest/cap/SW/LKGbug.
Rootkeurt gerichte gallery-onlyfontreadinessinownedSyncStudioMediagoed:
eigenFontFaceinstanties met bestaandegeverifieerdecachedfontURLs enofficiële
descriptors explicietload+add vóórzichtbaarframe, geen globaleFontFaceSet.load/
readyvooralleengallery. Bestaande11assets/andereketenbytegelijkgedrag. Alleen
eigenfaceobjecten verwijderen bijfailure/effectcleanup; lateasyncloadmagna
stopgeenfacebijplaatsen. Bestaande5sdeadline/imagechecks/fallbackveiligheid
blijven. NieuwBackgroundcap controleertook daadwerkelijkgebruikteFontFace/
FontFaceSet.add/delete support, bestaandDOMcap/headerongewijzigd. Huidige
ownedcaptests krijgenmeaningfulnegatiefgeval; geendownstreamDOMassertdrop.

Nieuwebrowserfixturebleekgeencompletebinarybewijs(gebruikteoudeSVGdummy).
Rootgeeft uitsluitendnieuw tests/helpers/sync-background-binary.ts plus
bestaandeownedgalleryspec vrij: genereerechte lokalecompleteMP4+PNGposter
viaproductWorkerpipeline/approvedinput/SHA/MIME/dims enbeidepagina's; geen
SVGalscompletefallback ofproviderfetch. Houd workerChrome vóórPlayerbrowser
inbeforeAll zonderactievepage, metpinnedexecutable. Bewaarorigineelfake-fixture-
rood ennieuweechtebewijsgrens. CorrupteSHA-test mag alleenexactbestaande veilige
UIerrorcopy verwachten inplaatsvanrawchecksumwoord; daadwerkelijkechecksum-
rejectie/LKGbehoud blijvenasserties. Geenservicworker/cacheformat/publicatie-
ofSQLwijziging. Nieuweproductbuild/hashes/end-to-endofflinegatesvolgen.

## Root tooling-/fixtureverduidelijking
Echte Source MP4+PNG-fixtures mogen via expliciete aparte repo-root precommand
worden gegenereerd; alle workerChrome zijn gesloten vóór Player9. Bestaande
image sha256:12d5b97adea07581b32a53068b04abd97497fdcef653b680c94a6bd7cea46e79
mag alleen via eigen /dev/shm PATH-wrappers, eigen outputbind, --network none
--read-only --rm --pull never; geen image/dependencyinstall/download.
Case30s en product5s blijven gelijk. Geen mutatie van echte QA57622.

## Root hosted fixtureclosure ownership
Root wijst ci_flow_repair uitsluitend `.github/workflows/pr-gates.yml` toe
voor één nieuwe Player-only voorbereidende stap na pinnedChromiuminstallatie,
plus eigenS238bewijs in/tmp. Echte bestaandehelper produceert6MP4/12PNG naar
runner.temp; geefS238_BACKGROUND_BINARIES viaGITHUB_ENV aan ongewijzigde
browsergaterunner. BepaalChrome via geinstalleerdePlaywright, en installeer
ffmpeg/ffprobe alleen in Playerjob volgens het bestaande DBworkflowpatroon.
Geen workflowpermissions/secrets/triggers/deadlines/matrix/runnerlogica wijzigen;
geen specskip/dummyfallback/nieuwe dependency of lokale install/download.
Worker/Player-cases en hun30s/product5s-grenzen blijven gelijk. Root bezit
prompt/doc/ledger; writer rapporteert voorstel vóór write en commit/push niet.

## Root wizardlabelvervolg uit onafhankelijke audit
AUD05 bevestigt nieuwewizardvelden die globalSource12px erven. Root neemt
uitsluitend `studio/sync-create-wizard.module.css` en de bestaande2viewport
cases in `tests/control/sync-create-wizard.spec.ts` in ownership voor14px
echte labels/uitleg binnen.fields. Dit betreft appformulieren, geen
preview-/canvastekst. Voeg labelasserties toe, bewaar eersterood, herstel
alleen deze lokale selectors. Geen handlers/JSON/defaults/writers wijzigen.
Galerie-/defaultsmerge houdt deze nieuweasserties én alleoudechecks.
