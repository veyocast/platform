# VeyoCast canon alignment en productroadmap S20-S37

## Status en doel

Dit document vertaalt de actuele codebase, het VeyoCast technical/design canon
en het aangeleverde uitgebreide technische canon naar een uitvoerbaar programma.
Het document is normatief voor de volgorde en scope van S20-S37, maar vervangt
de bestaande security-, design-, player- en deploymentcanons niet.

De roadmap heeft vier doelen:

1. de bestaande veilige player- en databasebasis behouden;
2. ontbrekende identity-, platform- en tenantbeheerfuncties afronden;
3. Control herontwerpen rond samenhangende gebruikerstaken;
4. productwaarde toevoegen zonder pilot-, security- of offlinegaranties te
   verzwakken.

## Uitgangssituatie op main

De codebase heeft al een werkende verticale keten voor tenantgebonden media,
playlist drafts, immutable releases, schermen, pairing en online/offline
playback. De belangrijkste open gaten zijn:

- actieve tenantcontext kiest impliciet de eerste membership;
- platformmutaties hebben nog geen MFA/AAL2-gate;
- autorisatie gebruikt verspreide rolsets in plaats van capabilities;
- teambeheer en tenant invitations zijn niet end-to-end beschikbaar;
- tenantstatus en schermlimiet zijn niet overal transactioneel afgedwongen;
- Control-pagina's zijn per resource gegroeid en missen detailroutes en een
  gezamenlijke publicatieflow;
- Pilotflow dupliceert productiefunctionaliteit en bevat ontwikkelgerichte UX;
- de media-worker draait nog niet als production service;
- gestructureerde observability, SLO's, alerts en restorebewijs zijn onvolledig;
- fysieke LG-validatie en de 24-uurs mixed-media soak zijn nog open launchgates.

## Programma-indeling

| Programma | Sprints | Resultaat |
|---|---|---|
| Trust en beheer | S20-S22 | Canonieke contracts, expliciete tenantcontext, MFA, capabilities en compleet platform-/teambeheer |
| Control UX en kernjourneys | S23-S28 | Nieuwe informatiearchitectuur, Media, Playlist Studio, Releases, Schermen en operationeel dashboard |
| Production en pilot | S29-S30 | Production worker, observability, herstelbewijs en een afgetekende release candidate |
| Productiviteit en planning | S31-S32 | Bulkacties, templates, opgeslagen views, schermgroepen en scheduling |
| Integraties en commercialisatie | S33-S36 | Offline-safe providers, billing en optionele advertenties na expliciete go/no-go's |
| Onderzoekshorizon | S37 | Alleen gevalideerde discovery voor AI, native wrappers, LAN relay en andere latere opties |

## Uitvoeringsprompts

Voor iedere sprint bestaat een afzonderlijke startprompt in `prompts/sprints/`:

| Sprint | Prompt |
|---|---|
| S20 | `S20-canon-application-boundaries.md` |
| S21 | `S21-identity-tenant-context-capabilities-mfa.md` |
| S22 | `S22-platform-lifecycle-team.md` |
| S23 | `S23-control-ux-foundation.md` |
| S24 | `S24-media-workspace-resumable-upload.md` |
| S25 | `S25-playlist-studio-readiness.md` |
| S26 | `S26-release-center-preflight-impact.md` |
| S27 | `S27-screen-fleet-onboarding.md` |
| S28 | `S28-operational-dashboard-action-inbox.md` |
| S29 | `S29-production-operations-observability.md` |
| S30 | `S30-pilot-release-candidate.md` |
| S31 | `S31-productivity-bulk-templates-views.md` |
| S32 | `S32-screen-groups-scheduling.md` |
| S33 | `S33-integration-framework-offline-widgets.md` |
| S34 | `S34-sport-provider-discovery.md` |
| S35 | `S35-billing-entitlements.md` |
| S36 | `S36-optional-ad-network.md` |
| S37 | `S37-controlled-research-horizon.md` |

De roadmapsectie is normatief voor de volledige scope; de prompt is de
paste-ready startinstructie. Bij conflict geldt de strengste security- of
offlinegarantie en wordt het conflict eerst gedocumenteerd.

## Niet-onderhandelbare programmaregels

- RLS blijft default deny en iedere nieuwe tenanttabel krijgt `tenant_id` als
  `NOT NULL`, passende indexes en tenant-aware foreign keys.
- URL- of clientstate is nooit voldoende autorisatiebewijs; iedere serveractie
  valideert gebruiker, tenant, capability en resource ownership opnieuw.
- De service-role key blijft uitsluitend in expliciete server-only boundaries.
- Een playlist release blijft immutable. Rollback betekent een expliciete
  nieuwe assignment van een bestaande release, nooit mutatie van historie.
- De player blijft een device en wordt geen Supabase Auth-gebruiker.
- Een pending release kan nooit current worden voordat alle bytes geverifieerd
  zijn.
- Live omgevingen tonen geen fixtures, fake KPI's, fake notificaties of
  gesimuleerde successen.
- Mobile wordt per journey sequentieel ontworpen; geen verkleinde desktopeditor.
- Nieuwe UI gebruikt semantische tokens en gedeelde componenten.
- Iedere sprint bevat loading-, empty-, ready-, error-, forbidden- en relevante
  partial-successstates.
- Databasewijzigingen volgen expand/contract; destructieve downmigrations zijn
  geen rollbackstrategie.
- Post-MVP-sprints starten pas na de S30 pilotgate, tenzij het werk strikt
  read-only discovery is en de critical path niet belast.

## Doelarchitectuur Control

### Route- en contextmodel

Voorkeursmodel:

```text
/platform
/platform/tenants
/platform/tenants/[tenantId]
/platform/users
/platform/audit
/platform/system

/t/[tenantSlug]/overview
/t/[tenantSlug]/publish
/t/[tenantSlug]/media
/t/[tenantSlug]/media/[assetId]
/t/[tenantSlug]/playlists
/t/[tenantSlug]/playlists/[playlistId]/edit
/t/[tenantSlug]/releases
/t/[tenantSlug]/releases/[releaseId]
/t/[tenantSlug]/screens
/t/[tenantSlug]/screens/new
/t/[tenantSlug]/screens/[screenId]
/t/[tenantSlug]/team
/t/[tenantSlug]/settings
/t/[tenantSlug]/audit
```

De tenant slug is navigatiecontext, geen securityboundary. De server resolveert
de slug naar een tenant-ID en controleert daarna membership/platformcapability.
Platformgebruikers betreden een tenant via een expliciete actie. Tenantwissel
moet clientcaches, selectionstate en open mutatieforms veilig resetten.

### Hoofdnavigatie

```text
Overzicht

Content
  Media
  Playlists
  Releases

Distributie
  Schermen
  Apparaten en synchronisatie

Organisatie
  Team
  Instellingen
  Auditlog
```

Pilotflow verdwijnt uit productionnavigatie. De route mag tijdelijk als
afgeschermd testharnas blijven bestaan totdat de nieuwe publish- en
screen-onboardingjourneys dezelfde live E2E-dekking hebben.

### Canonieke journeys

#### Content publiceren

```text
upload/selecteer media
  -> verwerking gereed
  -> playlist draft
  -> preview en readiness review
  -> immutable release
  -> doelschermen
  -> download/verificatie volgen
  -> actief op scherm
```

#### Scherm toevoegen

```text
logisch scherm aanmaken
  -> limiet bevestigen
  -> optioneel content kiezen
  -> pairingcode claimen
  -> eerste heartbeat ontvangen
  -> release en opslag controleren
  -> onboarding afronden
```

#### Probleem herstellen

```text
actie-inbox
  -> resource-detail
  -> oorzaak/gevolg/herstelactie
  -> expliciete mutatie
  -> audit/sync-event bevestigt resultaat
```

## S20 - Canonharmonisatie en application boundaries

### Doel

Eén VeyoCast-doelcanon en een incrementele architectuurbasis creëren voordat
nieuwe UI en mutaties verder groeien.

### Werkpakketten

#### S20-A - Canon en ADR-harmonisatie

- Maak VeyoCast-terminologie leidend en verwijder NXTCast-namen uit nieuw
  normatief materiaal.
- Markeer kern-MVP, pilotgate, post-MVP en research expliciet.
- Leg afwijkingen tussen huidige code en doelarchitectuur vast.
- Maak ADR's voor tenantcontext, capability-autorisatie, transportcontracts,
  observability en Control-route-indeling.
- Actualiseer README, PLANS, TASK_LEDGER en relevante canons.

#### S20-B - Packages en dependencyrichting

- Introduceer minimaal `packages/contracts`, `packages/domain` en
  `packages/auth`.
- Contracts bevatten Zod schemas en transporttypes, zonder React/Next/Supabase.
- Domain bevat pure businessregels zoals readiness, capabilities en
  statustransities.
- Auth bevat capabilitybeslissingen, nooit alleen UI-helpers.
- Voeg importboundarytests toe: browser kan geen server-only modules importeren;
  apps mogen niet circulair van elkaar afhangen.
- Migreer alleen nieuwe of actief gewijzigde flows; geen big-bang rewrite.

#### S20-C - Service- en repositorypatroon

- Definieer een vaste structuur voor server actions/route handlers, services en
  data access.
- Maak veilige typed errorcodes voor validation, forbidden, conflict, not found
  en temporarily unavailable.
- Verbied raw database-errors en stacktraces in responses.
- Leg idempotencyregels vast voor provisioning, invitations, publish en pairing.

### Verificatie

- dependencygraph zonder verboden imports;
- contract- en capability-unittests;
- bestaande lint/typecheck/unit/build-gates;
- service-role- en clientbundleboundarytests;
- documentreview op conflicterende canonregels.

### Exitcriteria

- één actuele VeyoCast-roadmap is vindbaar;
- packageverantwoordelijkheden zijn toetsbaar;
- volgende sprints kunnen contracts gebruiken zonder gedeelde appcode te
  importeren.

### Non-goals

- bestaande features volledig herschrijven;
- UI-redesign;
- nieuw databaseproductgedrag.

## S21 - Identity, expliciete tenantcontext, capabilities en MFA

### Doel

Iedere request werkt in een expliciete, server-side gevalideerde context en
gevoelige platformmutaties vereisen AAL2.

### Werkpakketten

#### S21-A - Capabilitymodel

- Definieer platform- en tenantcapabilities, waaronder:
  `platform.tenant.read`, `platform.tenant.create`,
  `platform.tenant.lifecycle`, `platform.user.manage`, `tenant.media.write`,
  `tenant.playlist.write`, `tenant.playlist.publish`, `tenant.screen.manage`,
  `tenant.team.manage`, `tenant.settings.manage` en `tenant.audit.read`.
- Map bestaande rollen exhaustief naar capabilities.
- Centraliseer `requireCapability()` en gebruik dezelfde read-only beslislaag
  voor navigatie en actievisibility.
- Test iedere rol/capabilitycombinatie.

#### S21-B - Tenantcontext

- Voeg tenant-slugroutes of een gelijkwaardig expliciet contextmodel toe.
- Resolveer tenantcontext uitsluitend server-side.
- Controleer membership/status bij iedere protected layout, loader en mutatie.
- Voeg veilige redirect voor ontbrekende, ingetrokken of gearchiveerde context
  toe.
- Implementeer een werkende tenant-switcher met keyboardbediening.
- Wis tenantgebonden query-, selection- en formstate bij contextwissel.
- Voorkom cross-tenant dataflash en stale routercache.

#### S21-C - MFA/AAL2

- Voeg enrollment, challenge, recovery en sessiestatus toe met Supabase MFA.
- Vereis AAL2 voor tenant creation/lifecycle, platformuserbeheer en andere
  expliciet gevoelige acties.
- Toon oorzaak, gevolg en herstelactie bij AAL1.
- Test downgrade, verlopen challenge, replay en open redirects.

#### S21-D - Tenantstatus enforcement

- Definieer gedrag voor active, paused en archived.
- Paused: reads en bestaande playerplayback blijven beschikbaar; nieuwe
  mutaties/pairing/publicatie worden volgens expliciet beleid geblokkeerd.
- Archived: geen normale tenantmutaties; herstel uitsluitend via bevoegde
  platformactie.
- Dwing status af in databasefuncties/services, niet alleen in navigatie.

### Verificatie

- role/capabilitymatrix;
- AAL1/AAL2 E2E;
- twee tenants per gebruiker en hostile slug/ID tests;
- ingetrokken membership tijdens actieve sessie;
- browsercache- en back/forwardtests;
- RLS blijft laatste datagrens.

### Exitcriteria

- geen impliciete `memberships[0]`-selectie;
- iedere mutation heeft één centrale capabilitycheck;
- platformmutaties zonder AAL2 falen veilig;
- paused/archived gedrag is aantoonbaar.

## S22 - Platform lifecycle, provisioning en tenantteam

### Doel

Platform- en tenantbeheerders kunnen organisaties en toegang volledig beheren
zonder handmatige Supabase-operaties.

### Werkpakketten

#### S22-A - Tenant provisioning v2

- Breid tenant creation uit met eigenaar-e-mail, schermlimiet, locale en
  timezone.
- Maak tenant, defaults, owner invitation en audit-event transactioneel en
  idempotent.
- Maak de platformadmin niet automatisch eigenaar van iedere tenant, tenzij dit
  expliciet wordt gekozen en geaudit.
- Toon provisioningstatus en veilige retry bij partiële externe e-mailfouten.

#### S22-B - Platform tenantdetail en lifecycle

- Voeg tenantdetail toe met status, limiet, leden, schermen, storage en recente
  events.
- Implementeer pause, reactivate en archive met bevestiging en impacttekst.
- Implementeer schermlimietwijziging met bescherming tegen een limiet onder
  huidig gebruik.
- Voeg expliciet "Open vereniging" toe voor bevoegde platformrollen.

#### S22-C - Team en invitations

- Lijst actieve leden, pending, expired, accepted en revoked invitations.
- Nodig per e-mail en rol uit; verstuur opnieuw zonder token te hergebruiken.
- Wijzig rollen en trek toegang in.
- Voorkom verwijderen/degraderen van de laatste tenant owner.
- Voorkom self-lockout en bevestig destructieve wijzigingen.
- Registreer volledige maar privacyveilige audit-events.

#### S22-D - Platformgebruikers

- Beheer platformrollen apart van tenantrollen.
- Alleen platform owner mag owners/admins beheren volgens capabilitybeleid.
- Toon MFA-status zonder MFA-secrets of recoverydata.

### Verificatie

- transactionele provisioning- en idempotencytests;
- invitation expiry/replay/wrong-email/wrong-tenant;
- laatste-owner en self-lockouttests;
- AAL2 en platformrolmatrix;
- mailprovider via fixture in CI, echte authorized staging-smoke apart;
- auditassertions voor iedere mutatie.

### Exitcriteria

- een nieuwe tenant kan zonder handmatige databaseactie worden overgedragen;
- tenant owners beheren zelfstandig hun team;
- lifecycle en limieten zijn server-side afgedwongen.

## S23 - Control design system, informatiearchitectuur en responsive shell

### Doel

Een consistente UX-basis maken waarop alle volgende resourcejourneys worden
gebouwd.

### Werkpakketten

#### S23-A - Shared UI adoption

- Maak `@veyocast/ui` de bron voor Button, IconButton, Badge, Alert, Field,
  EmptyState, ErrorState, PageHeader, Toolbar, DataTable en Inspector.
- Migreer shellprimitives incrementeel en verwijder duplicaten zodra geen
  consumer resteert.
- Verwijder component-level hardcoded brandkleuren.
- Documenteer states en mobilegedrag in Storybook.

#### S23-B - Nieuwe navigatie

- Implementeer de groepen Overzicht, Content, Distributie en Organisatie.
- Scheid platform- en tenantcontext visueel en semantisch.
- Verwijder Pilotflow uit productionnavigatie.
- Behoud inklapbare desktoprail, mobile sheet, skiplink en toetsenbordflow.
- Maak tenantwissel en actieve context altijd zichtbaar.

#### S23-C - Resource page contract

- Standaardiseer breadcrumb, H1, status, primaire actie en secondary actions.
- Definieer toolbar, filters, sortering, pagination en URLstate.
- Gebruik detailroutes of inspector; geen alles-in-één pagina zonder motivatie.
- Definieer skeleton/loading, empty, error, forbidden en stale states.
- Maak tabellen op mobiel priority-based card rows.

#### S23-D - UX research en evidence

- Test de huidige en nieuwe kritieke journeys met minimaal platformadmin,
  tenantadmin en editor.
- Meet aantal stappen, fouten en herstelvragen.
- Leg desktop 1280+, tablet en 320/390 px evidence vast.

### Verificatie

- Storybook en componenttests;
- axe/WCAG 2.2 AA-smokes;
- keyboard-only critical navigation;
- responsive screenshots;
- no-horizontal-overflowtests;
- designcanonchecklist per route.

### Exitcriteria

- alle volgende resourcepagina's gebruiken dezelfde patronen;
- shell bevat geen dode knoppen of fake live-notificaties;
- mobile is taakgericht en niet mini-desktop.

## S24 - Media workspace en resumable upload

### Doel

Van de mediapagina een betrouwbare bibliotheek en uploadworkspace maken voor
kleine én grote batches.

### Werkpakketten

#### S24-A - Library en detail

- Introduceer lijst/raster, server-side pagination, zoeken en filters op type,
  status, datum en gebruik.
- Voeg `/media/[assetId]` of een toegankelijke inspector toe.
- Toon veilige metadata, varianten, verwerking, gebruik en auditgeschiedenis.
- Toon nooit langdurige signed URLs in serialiseerbare state.

#### S24-B - Resumable upload

- Definieer upload intent, chunk/session metadata, finalize en idempotency.
- Ondersteun voortgang, pauzeren, hervatten, retry en cancel.
- Herstel een onderbroken upload na navigatie/reload waar veilig.
- Toon batch- en per-filelimieten vooraf.
- Server valideert MIME, signature, grootte, tenant, quota en storagepath.

#### S24-C - Processing en herstel

- Toon queued, processing, ready, validation_failed en quarantined met duidelijke
  oorzaak/gevolg/herstelactie.
- Voeg begrensde retry voor toegestane foutklassen toe.
- Maak uploaden mogelijk terwijl andere items verwerken.
- Laat archiveren eerst actieve draft-/release-impact tonen.

#### S24-D - Media usage foundation

- Maak een efficiënte serverquery voor asset -> playlist drafts -> releases ->
  schermen.
- Gebruik deze dependencydata in detail en toekomstige impactanalyse.

### Verificatie

- chunk replay, resume, cancel en idempotent finalize;
- MIME mismatch, oversize, path traversal, quota en cross-tenant;
- navigation tijdens upload;
- mobile upload en keyboard library;
- private Storage en signed-URL expiry.

### Exitcriteria

- grote MP4-upload kan veilig hervatten;
- gebruiker begrijpt verwerking en kan toegestane fouten herstellen;
- gebruik van een asset is zichtbaar vóór archiveren.

Implementatiestatus S24: gerealiseerd op
`veyocast/s24-media-workspace-resumable-upload`. De browser kan bevestigde TUS-
chunks na navigatie of reload hervatten zodra de gebruiker hetzelfde lokale
bestand opnieuw selecteert; browsers geven een eerder gekozen `File` bewust
niet zonder nieuwe toestemming terug.

## S25 - Playlist Studio, concurrency en publicatiegereedheid

Implementatiestatus: review op `veyocast/s25-playlist-studio-readiness`. De
gescheiden lijst/detailroutes, revision-aware commandgrens, centrale
readinessberekening, Playercontract-preview en responsieve editor zijn geleverd.
Zie `docs/s25-playlist-studio-readiness-evidence.md` voor bewijs en expliciete
restscope.

### Doel

Een duidelijke editor maken waarin meerdere gebruikers geen wijzigingen
verliezen en iedere blokkade vóór publicatie begrijpelijk is.

### Werkpakketten

#### S25-A - Playlist list en detailroutes

- Scheid playlistlijst en editor.
- Voeg zoeken, filters, sortering, archive status en laatst bewerkt door toe.
- Laat concept, laatst gepubliceerde versie en toegewezen schermen zien.

#### S25-B - Editor workspace

- Desktop: mediaselector, ordelijke timeline/lijst en preview zonder overmatige
  panelen.
- Mobile: sequentieel media kiezen, volgorde, instellingen en preview.
- Ondersteun keyboard reorder, duur, fit, muted en verwijderen.
- Bescherm dirty state en navigatie.

#### S25-C - Optimistic concurrency

- Voeg version/revision token toe aan playlist drafts.
- Iedere mutatie vergelijkt expected revision.
- Toon een typed conflict met reload/compare/herhaaloptie; nooit silent overwrite.
- Test twee browsers en gelijktijdige publish/edit.

#### S25-D - Publicatiegereedheid

- Bouw één pure/domain readinessberekening.
- Controleer lege playlist, processing/failed media, ontbrekende variant,
  ongeldige duur, unsupported orientation en overige contractblokkades.
- Retourneer stabiele reason codes plus gebruikersvriendelijke herstelacties.
- Gebruik exact dezelfde readinesslogica in editor, publishservice en tests.

### Verificatie

- concurrency en stale revision;
- keyboard/mobile editor;
- not-ready asset en cross-tenant asset;
- readiness golden tests;
- preview parity met playercontract;
- dirty state en conflict recovery.

### Exitcriteria

- geen lost updates;
- iedere publishblokkade heeft een concrete herstelactie;
- playlistbewerking is begrijpelijk op desktop en mobiel.

## S26 - Release Center, impactanalyse en schermpreflight

Implementatiestatus: review op `veyocast/s26-release-center-preflight`.
Release Center, golden releasediff, append-only reassignment, per-screen
preflight, guided publish en uitrolfasen zijn gerealiseerd. Zie
`docs/s26-release-center-preflight-evidence.md` voor bewijs en de bewust
conservatieve telemetrygrenzen.

### Doel

Publicatie, historie en uitrol als afzonderlijk operationeel domein zichtbaar
maken.

### Werkpakketten

#### S26-A - Release Center

- Voeg release list/detail toe met versie, actor, datum, notes, itemcount,
  omvang, hashstatus en doelschermen.
- Toon immutable historie en verschil tussen twee versies.
- Bied opnieuw toewijzen van een bestaande release aan zonder release te
  muteren.
- Label huidige, gewenste en historische releases ondubbelzinnig.

#### S26-B - Releasevergelijking

- Vergelijk toegevoegde, verwijderde, verplaatste en gewijzigde items.
- Toon wijziging in totale duur en bytes.
- Gebruik IDs en hashes intern, maar mensvriendelijke titels in UI.

#### S26-C - Preflight per doelscherm

- Bereken ontbrekende bytes per scherm op basis van bekende active/previous
  releases en heartbeat/storage-informatie.
- Controleer schermstatus, app/manifestcompatibiliteit, beschikbare opslag en
  reeds aanwezige content.
- Classificeer ready, warning, blocked en unknown.
- Een warning vereist bewuste bevestiging; blocked kan niet publiceren.
- Een ontbrekende heartbeat wordt nooit als voldoende opslag geïnterpreteerd.

#### S26-D - Impactanalyse

- Toon asset -> playlist -> release -> screen relaties.
- Toon bij playlistwijzigingen welke schermen pas na publicatie veranderen.
- Toon bij archiveren waarom immutable releases intact blijven.

#### S26-E - Publicatiejourney

- Maak `/publish` als begeleide orchestratie boven echte resources.
- Stappen: media/readiness, preview, release metadata, targets, preflight,
  bevestiging, syncstatus.
- Ondersteun hervatten via bestaande draft- en release-ID's; geen verborgen
  tijdelijke productdata.

### Verificatie

- canonical hash/immutability;
- release diff golden tests;
- quota, offline en stale heartbeat preflight;
- concurrent publish;
- multi-screen partial syncweergave;
- volledige live publishjourney.

### Exitcriteria

- gebruiker ziet vóór publicatie risico en omvang per scherm;
- na publicatie is voortgang per scherm traceerbaar;
- historie en rollbackassignment zijn veilig bedienbaar.

## S27 - Schermvloot, devicebeheer en onboarding

### Doel

Schermen van een gecombineerde tabel/formulierpagina naar een beheersbare vloot
met detail, lifecycle en guided onboarding brengen.

### Werkpakketten

#### S27-A - Screen lifecycle en limiet

- Maak scherm creation/update/maintenance/disable transactioneel.
- Dwing `screen_limit` in dezelfde databaseboundary af.
- Voeg veilige naam-, locatie-, orientation- en resolutionupdates toe.
- Definieer gedrag van disable/maintenance voor assignment en playback.

#### S27-B - Guided screen onboarding

- Stappen: schermdetails, limiet, optionele content, pairing, heartbeat,
  storage/appversie, afronding.
- Ondersteun opnieuw openen na verlopen pairingcode.
- Toon pairingtoken of device secret nooit in Control/logs/URLs.
- Eindig op het nieuwe schermdetail.

#### S27-C - Screen detail

- Tabs: Overzicht, Content, Player, Synchronisatie en Gebeurtenissen.
- Toon active/desired release, laatste heartbeat, runtime state, storage,
  appversie en laatste veilige error code.
- Toon sync timeline met download/verifying/switch/active/failure.

#### S27-D - Device actions

- Rename, revoke, re-pair en controlled retry.
- Bevestig destructieve acties met gevolg voor offline device.
- Rotation/revocation geldt bij eerstvolgende verbinding; offline beperking is
  zichtbaar en gedocumenteerd.

### Verificatie

- schermlimietconcurrentie;
- pairing expiry/replay/double claim/rate limiting;
- wrong tenant en revoked device;
- eerste heartbeat journey;
- desired/current status en offline gedrag;
- mobile onboarding en keyboarddetail.

### Exitcriteria

- scherm toevoegen is één begrijpelijke journey;
- support kan status en sync zonder databaseconsole verklaren;
- limiet en device lifecycle zijn server-side beschermd.

## S28 - Operationeel dashboard, actie-inbox, zoeken en onboarding

### Doel

Control veranderen van losse resourcepagina's naar een dagelijkse
operationele werkplek.

### Werkpakketten

#### S28-A - Dashboard information hierarchy

- Zet Actie nodig bovenaan.
- Beperk generieke KPI's tot maximaal vier met duidelijke definities.
- Toon fleet health, processing health, recente releases en recente activiteit.
- Iedere kaart linkt naar een gefilterde resourceweergave.
- Geen fake live-data; unknown is een geldige status.

#### S28-B - Actie-inbox

- Definieer server-side signalen voor offline scherm, sync timeout, failed
  processing, publishblocker, invitation expiry en quota pressure.
- Geef severity, eerste detectie, ouderdom, resource, capability en herstelroute.
- Dedupe herhaalde signalen en voorkom high-cardinality events.
- Ondersteun resolved/acknowledged alleen wanneer het operationeel betekenisvol
  is; geen cosmetisch wegklikken van echte problemen.

#### S28-C - Echte globale zoekfunctie

- Zoek tenant-scoped media, playlists, releases en screens server-side.
- Platformcontext zoekt tenants en toegestane platformresources.
- Resultaten respecteren capabilities en tenantcontext.
- Ondersteun toetsenbordnavigatie en recente veilige acties.

#### S28-D - Onboardingchecklist

- Statussen: organisatiegegevens, team/eigenaar, eerste media, eerste playlist,
  eerste release, eerste paired screen en eerste actieve playback.
- Bereken voortgang uit echte resources, niet uit clientflags.
- Checklist verdwijnt of wordt compact na voltooiing, maar blijft heropenbaar.

#### S28-E - Contextuele help

- Koppel help aan foutcodes, readiness reasons en huidige taak.
- Beschrijf oorzaak, gevolg en eerstvolgende herstelactie.
- Geen generieke helpknop zonder bruikbare bestemming.

### Verificatie

- signal generation/dedup/resolution;
- capability-filtered search;
- no-fake-data assertions in production build;
- dashboard deep links en URLfilters;
- onboarding derived-state tests;
- keyboard/axe/mobile.

### Exitcriteria

- gebruiker ziet direct wat aandacht vereist;
- ieder signaal opent de juiste herstelcontext;
- zoeken vindt echte resources zonder data buiten scope.

## S29 - Production worker, observability, SLO's en recovery

### Doel

De bestaande productketen aantoonbaar operabel en herstelbaar maken.

### Werkpakketten

#### S29-A - Media-worker deployment

- Ontwerp een afzonderlijk least-privilege deploymentmodel voor staging en
  production.
- Gebruik immutable image SHA/digest, non-root runtime, resource limits,
  tijdelijke opslag, graceful shutdown en readiness.
- Houd workercredentials buiten webcontainers waar mogelijk.
- Voeg queue drain/rollbackgedrag toe.

#### S29-B - Observability package

- Introduceer `packages/observability` met structured logger, eventcatalogus en
  correlation IDs.
- Redigeer tokens, signed URLs, persoonlijke velden en databaseconnecties.
- Gebruik stabiele eventnamen en bounded-cardinality labels.
- Maak health, readiness en businessstatus expliciet verschillend.

#### S29-C - SLO's en alerts

- Definieer meetbare doelen voor uploadfinalisatie, processingwachttijd,
  publishduur, desired-to-active tijd, heartbeat freshness en player startup.
- Maak alerts voor queueleeftijd, worker errors/retries, offline vloot, sync
  timeout, disk, TLS, deployment en backup freshness.
- Iedere alert linkt naar runbook en relevante Control-filter.

#### S29-D - Backup, restore en rollback

- Leg verantwoordelijkheden en RPO/RTO vast.
- Test database- en configuratierestore in non-production.
- Bewijs image rollback zonder database downmigration.
- Archiveer evidence met SHA, tijden en uitkomst zonder secrets.

#### S29-E - Veilige supportbundle

- Exporteer expliciet toegestane status: service/revision/environment,
  redacted eventcodes, release IDs, appversie en tijdvenster.
- Sluit tokens, URLs, hashes van credentials, user agents met PII en raw logs uit.
- Maak bundle tenant-/platformcapabilitygebonden en audit de export.

### Verificatie

- secret/log leakage tests;
- worker crash/lease/retry/queue soak;
- alert threshold fixtures;
- restore- en rollbackdrill;
- supportbundle allowlisttest;
- staging smoke met echte worker.

### Exitcriteria

- nieuwe MP4 wordt in production verwerkt;
- kritieke degradatie alarmeert met een uitvoerbaar runbook;
- restore en rollback zijn bewezen.

## S30 - Pilot validation en release candidate

### Doel

Een formele go/no-go nemen op basis van echte journeys, hardware en
operationeel bewijs.

### Werkpakketten

#### S30-A - Critical journey suite

- Platformadmin MFA -> tenant + owner invitation.
- Tenant owner -> team, settings en schermlimiet.
- Editor -> resumable image/video upload -> worker ready.
- Editor -> playlist -> readiness -> preflight -> immutable release.
- Admin -> screen onboarding/pairing -> active playback.
- Player -> offline, reconnect, update en heartbeat.

#### S30-B - Reliability en soak

- 24 uur mixed image/video playback.
- Periodieke releases en netwerkverlies/herstel.
- Browser restart, power cycle, corrupt pending asset en quota pressure.
- Workerqueue met retries en restart.
- Meet geheugen, CPU, opslag, eventgroei en black-screen incidents.

#### S30-C - Security, a11y en performance

- Auth/RLS/device/upload/workflow red-team.
- Geen critical/high open; medium heeft eigenaar en datum.
- WCAG 2.2 AA op kritieke journeys.
- Control/API/player/worker capacitybaseline zonder ongefundeerde schaalclaim.

#### S30-D - Hardware en disaster recovery

- Minimaal één exact LG model/firmware/browserprofiel.
- Fullscreen/autostart/reboot/power-loss en storage persistence.
- Staging restore en application rollback.

#### S30-E - RC-dossier

- Exacte SHA/digests, evidence-index, known limitations, supportowner,
  escalation en go/no-go.
- Alleen PASS of expliciete NO-GO; gates worden niet verzwakt.

### Exitcriteria

- alle pilotlaunchgates PASS of formeel NO-GO;
- een production pilot heeft support- en rollbackdekking;
- geen geplande feature wordt als shipped gepresenteerd.

## S31 - Productiviteit: bulkacties, templates en opgeslagen views

### Doel

Veelvoorkomend beheer sneller maken nadat de single-resource journeys stabiel
zijn.

### Werkpakketten

- Bulk upload met individuele progress/error/retry.
- Bulk archive/tag voor media met voorafgaande impactcontrole.
- Saved filters/views voor media, playlists, releases en screens; standaard
  persoonlijk, tenantshared alleen met capability.
- Playlist dupliceren met nieuwe draft-ID en zonder releasehistorie te kopiëren.
- Contenttemplates voor goedgekeurde 16:9/9:16 patronen; geen Canva-achtige
  arbitrary editor.
- Snelle acties in command palette, met bevestiging voor mutaties.
- Contextuele helpcontent en lege-state starters.
- Audit en idempotency voor bulkmutaties.

### Verificatie

- partiële batchfailure en retry;
- grote selectie/pagination;
- shared view tenantisolatie;
- template parity met playerpreview;
- keyboard en mobile bulk fallback.

### Exitcriteria

- dagelijkse herhaalhandelingen vereisen aantoonbaar minder stappen;
- bulkacties verliezen geen itemstatus en omzeilen geen impactchecks.

## S32 - Schermgroepen, planning en eenvoudige dayparting

### Doel

Content op meerdere schermen en tijdvakken beheren zonder mutable runtimecontent
of een complexe layoutengine te introduceren.

### Werkpakketten

- Tenant-scoped schermgroepen met many-to-many membership en RLS.
- Assignment aan expliciete screens of groepen met een immutable resolved
  target snapshot per publish/schedule operation.
- Eenvoudige schedule rules met timezone en DST-beleid.
- Dayparting voor releaseassignment, niet voor mutatie van releases.
- Conflictweergave bij overlappende schedules en duidelijke precedence.
- Offline player houdt laatst geldige actieve release; verlopen schedule zonder
  bereik veroorzaakt geen zwart scherm.
- Calendar/listweergave en volgende geplande wijziging per scherm.
- Emergency broadcast blijft afzonderlijk toekomstwerk totdat safety- en
  rollbacksemantiek zijn ontworpen.

### Verificatie

- timezone/DST/clock skew;
- groepsmembershipwijziging versus bestaand target snapshot;
- overlappende schedules;
- offline tijdens scheduleboundary;
- tenantisolatie en capabilitymatrix.

### Exitcriteria

- gebruiker kan voorspelbaar per locatie/tijd publiceren;
- dezelfde inputs geven dezelfde assignmentuitkomst;
- offlinegaranties blijven intact.

## S33 - Integration framework en offline-safe widgets

### Doel

Een provideronafhankelijke server-only adapterlaag bouwen voordat echte
providerclaims worden gedaan.

### Werkpakketten

- `packages/integrations` met capabilities, testConnection, sync, normalize en
  fouttaxonomie.
- Tenant-scoped connection records met secret references, nooit plaintext
  credentials in publieke tabellen of browserresponses.
- Idempotente syncjobs met rate limits, backoff, retention en audit.
- Versioned widget snapshots zonder arbitrary HTML.
- Snapshot wordt immutable aan release gebonden en speelt offline.
- Fake provider voor deterministic CI.
- Control UI voor connect/test/disconnect, syncstatus en widgetconfiguratie.

### Verificatie

- SSRF, credential leakage, wrong tenant en retry storm;
- stale snapshot en fallback;
- fake provider -> release -> offline player;
- geen provider SDK of secret in clientbundles.

### Exitcriteria

- framework werkt end-to-end met fake provider;
- player doet nooit live providercalls.

## S34 - Sportlink/Twelve discovery en begrensde POC

### Doel

Officiële toegang, rechten en technische mogelijkheden bewijzen voordat een
productintegratie wordt beloofd.

### Werkpakketten

- Official-only API-, licentie-, privacy- en SLA-onderzoek.
- Capabilitymatrix voor programma, uitslagen, standen, afgelastingen en andere
  aantoonbaar ondersteunde datasets.
- Geautoriseerde sandbox/fixtures en contracttests.
- Go, conditional-go of no-go per provider en dataset.
- Alleen GO-capabilities krijgen een offline snapshotwidget.
- Geen scraping, undocumented endpoints of echte credentials in repository/
  traces.

### Exitcriteria

- beslismatrix is onderbouwd;
- onbekend wordt niet als feature verkocht;
- elke POC speelt offline via S33 snapshots.

## S35 - Billing en schermentitlements

### Entry gate

S30 is GO en pricing, BTW, grace, cancellation en Mollie-contract zijn formeel
besloten.

### Werkpakketten

- Plans, customers, subscriptions, billing events en entitlements met RLS.
- Mollie-adapter en idempotente, out-of-order veilige webhooks.
- Reconciliation job en append-only financiële events.
- Transparant schermgebruik en planstatus in Control.
- Gracebeleid blokkeert nieuwe pairing/assignment waar nodig, maar veroorzaakt
  geen abrupt offline zwart scherm.
- Upgrade/downgrade/cancel en providerportal waar passend.

### Verificatie

- webhook replay/order/duplicate;
- reconciliation divergence;
- cross-tenant en entitlementrace;
- grace/offline playback;
- geen kaartdata of billingsecret in VeyoCast.

### Exitcriteria

- entitlementeffect is exactly-once/idempotent;
- facturatie en schermtelling zijn uitlegbaar en reconcileerbaar.

## S36 - Optioneel advertentienetwerk en revenue share

### Entry gate

Juridisch/commercieel model, tenantconsent, meetdefinities en fraudebeleid zijn
goedgekeurd. Deze sprint is optioneel en mag NO-GO eindigen.

### Werkpakketten

- Campaigns, creatives, targeting, opt-in/exclusions, allocations,
  playback proofs en revenue ledger.
- Deterministische allocation snapshot die in immutable releases wordt
  opgenomen; geen mutable live advertentie-injectie.
- Tenant houdt zichtbare controle per scherm/groep.
- Proof wording maakt duidelijk dat playback geen gegarandeerde menselijke view
  bewijst.
- Offline proof batches, dedupe, fraud limits en reconciliation.
- Platform-, advertiser- en tenant-UX zonder dark patterns.

### Verificatie

- replay/fabrication/clock skew/offline batches;
- frequency caps en tenant exclusions;
- deterministic allocation;
- financiële rounding/reconciliation;
- privacy- en claimreview.

### Exitcriteria

- geen double count;
- offline playback blijft mogelijk;
- tenantcontrole en measurementtaal zijn eerlijk.

## S37 - Gecontroleerde researchhorizon

### Doel

Latere ideeën onderzoeken zonder ze voortijdig in de productkern te trekken.

### Mogelijke researchtracks

- AI-contentassistent met expliciete menselijke review, provenance en geen
  klantdata voor training zonder overeenkomst;
- native/managed wrappers alleen wanneer fysieke kioskvalidatie een concrete
  browserbeperking aantoont;
- clubhouse LAN relay voor bandbreedtebesparing met cache-integriteit en veilige
  discovery;
- emergency broadcast mode met autorisatie, expiry, audit en betrouwbare
  rollback;
- proof-of-play rapportage zonder misleidende audienceclaims;
- sponsorportal na capability-, privacy- en billingbesluiten;
- OPFS/chunked media store wanneer gemeten hardwarelimieten dit rechtvaardigen.

Iedere track levert een ADR/decision memo, prototype achter featureflag en een
go/no-go. Geen track mag player last-known-good, release-immutability of RLS
verzwakken.

## Afhankelijkheden en parallelisering

### Critical path

```text
S20 -> S21 -> S22 -> S23 -> S24/S25 -> S26 -> S27 -> S28 -> S29 -> S30
```

- S24 en S25 mogen na S23 parallel starten wanneer database- en shared UI-
  hotspots één eigenaar hebben.
- S27 kan parallel met delen van S26, maar pairing/assignmentcontracts worden
  eerst bevroren.
- S28 gebruikt readiness, preflight en screenstatus uit S25-S27 en start daarom
  niet eerder volledig.
- S29-infrawerk kan deels naast S26-S28 lopen, maar de S30 gate vereist alles.
- S31-S32 starten pas na S30 GO, tenzij uitsluitend read-only design/discovery.
- S33-S36 zijn opeenvolgend door hun trust-, legal- en billingafhankelijkheden.

## Verplichte gates per uitvoeringssprint

Altijd:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Database:

```bash
pnpm db:reset
pnpm test:rls
```

Control UI:

```bash
pnpm test:a11y
pnpm test:e2e -- --project=chromium
```

Player:

```bash
pnpm test:player
pnpm test:player:offline
```

Aanvullend per risico:

- clientbundle- en service-role-boundaryscan;
- workflow/actionlint/shellcheck/Compose-validatie;
- live authorized staging-smoke;
- concurrency/fault-injection/soak;
- desktop/mobile screenshots en accessibility notes;
- migration forward/rollbackimpact en runbookupdate.

## Definition of Done per sprint

Een sprint is pas gereed wanneer:

- alle exitcriteria aantoonbaar zijn;
- server-side permissions en RLS-tests bestaan;
- relevante unhappy paths en recovery zijn getest;
- loading/empty/error/forbidden/mobile states gereed zijn;
- audit, observability en privacyimpact zijn verwerkt;
- documentatie, ledger en evidence zijn bijgewerkt;
- geen fake live-data of unrelated diffs bestaan;
- blockers niet als toekomstige generieke TODO zijn doorgeschoven;
- bekende beperkingen een eigenaar en vervolgdatum hebben.
