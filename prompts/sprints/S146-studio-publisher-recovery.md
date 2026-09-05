# Sprint S146 — Studio- en Publisherrecovery

## Doel

Herstel de concrete regressies die na S145 zichtbaar bleven in Studio,
schermtoewijzing, guided publish en de overige Control-routes. Lever een
professionele FieldFlow-ervaring waarin `Welkom bezoekers` en `Welkom
scheidsrechters` elk één gekoppeld meerteamscomponent zijn, een playlist echte
doelschermen kan kiezen en historische immutable releaseversies niet als een
onbegrensde selectielijst worden gepresenteerd. Stop tegelijk dat gewijzigde
`latest`-slides synchroon en zonder backpressure steeds nieuwe releases voor
ongebruikte of nog niet bijgewerkte schermen produceren.

## Normatieve bronnen

1. De actuele expliciete gebruikersinstructies en aangeleverde screenshots zijn
   leidend voor de beschreven regressies en zichtbare uitkomst.
2. `AGENTS.md` en de verplichte repo-canons blijven bindend voor security/RLS,
   immutable releases, locked assets, toegankelijkheid en Player/offlinegedrag.
3. De in S145 goedgekeurde FieldFlow-referentieroutes blijven visuele
   regressiegrenzen. S146 mag Overzicht, Planning, Schermen, Studio en Marketing
   niet terugzetten naar de afgekeurde S144-uitvoering.
4. Bestaande productiondata en screenshots zijn bewijs, geen opdracht om
   historische immutable records te wijzigen of te verwijderen.

## Vastgestelde oorzaken

### Gekoppelde Sportlink-welkomstcontent

De bestaande bulkbuilder paste team × blueprint toe op alle typen. Daardoor
leverde een keuze voor 22 teams ook 22 afzonderlijke bezoekers- of
scheidsrechterconcepten op. De wizard gebruikte hiervoor een per-teammatrix en
had geen aggregate selectiecontract.

### Testportrait in schermkeuzes

De schermloader gaf iedere historische `playlist_release` door aan de create-
en bulkformulieren. Omdat releases terecht immutable en append-only zijn,
verscheen een playlist met honderden versies honderden keren als
`Testportrait · versie N`.

Daarnaast bestond sinds S96 de generieke trigger
`dynamic_slide_auto_publishes_latest`. Iedere gewijzigde, gereed gerenderde
`latest`-snapshot kon daarmee synchronisch alle gebruikte default-
releasevertakkingen klonen naar nieuwe immutable playlistreleases. Dat is een
bevestigd repositorymechanisme voor herhaalde automatische versieaanmaak; het
bewijst zonder hosted database- en auditreadback niet welke actor, job of
snapshotwijziging iedere historische `Testportrait`-versie heeft veroorzaakt.

### Ontbrekende publicatiedoelen

De draft-preflight laadde schermen, devices, maximaal duizend heartbeats en alle
release-items als één samengestelde operatie. Een fout in één optionele query
maakte `screenStates` leeg en werd in de journey getoond alsof er geen
doelschermen bestonden.

### Achtergebleven Control-routes

De shell kende expliciete FieldFlow-presentatie alleen voor de vijf
S145-referentieroutes. Playlists, Publicaties, Slides, Bronnen, Sponsor Hub,
Engage, Team, Instellingen, Account, Support en Activiteit vielen terug op één
generieke secondary-presentatie. Publicatie- en detailroutes konden bovendien
ten onrechte op editorgeometrie lijken.

## Vereiste uitkomst

### Eén welkomstcomponent per doeltype

- `sportlink.visitor_arrivals` en `sportlink.referee_arrivals` maken ieder
  maximaal één logisch component per batch, ongeacht het aantal gekozen teams.
- De teamkiezer ondersteunt zoeken, alle teams selecteren, zichtbare tags en
  afzonderlijk verwijderen. Een lege of dubbele selectie is ongeldig.
- Ieder team start met `competitionSelectionMode: auto_current` en lege
  competitie-, fase-, poule- en seizoenvelden. De beheerder kan per team bewust
  één gesynchroniseerde competitiecontext vastzetten.
- Het contract en de database accepteren 1–100 unieke `teamContexts` alleen op
  beide aankomstblueprints; de primaire legacy-`context` is exact de eerste
  teamcontext.
- Bestaande gewone programma-, uitslag- en standslides blijven team × type.
- Bestaande aankomstslides zonder `teamContexts` blijven leesbaar; bewerken
  normaliseert ze zonder oudere immutable snapshots of releases te herschrijven.
- De snapshotbuilder selecteert uitsluitend thuiswedstrijden voor de gekozen
  teams en contexten, begrenst de uitvoer tot 40 items en bewaart de bestaande
  last-known-good-/immutable keten.

### Scherm- en releasekeuze

- Create- en bulktoewijzing tonen per niet-gearchiveerde playlist uitsluitend
  de hoogste immutable releaseversie; playlistnaam is de menselijke optie.
- Eén bounded fleet-RPC retourneert per niet-gearchiveerde playlist de nieuwste
  release plus oudere releases die nog werkelijk door een scherm, schermgroep
  of actieve planning worden gerefereerd. De UI projecteert daaruit alleen de
  nieuwste toewijsbare optie.
- De volledige releasehistorie blijft immutable beschikbaar voor historie,
  audit en rollback. S146 verwijdert of muteert geen bestaande release.
- De fix voorkomt dat honderden historische `Testportrait`-versies de
  keuzelijst vullen en voert geen automatische cleanup uit. De exacte actor- en
  jobprovenance van bestaande productieversies volgt uitsluitend uit hosted
  readback.

### Begrensde dynamische publicatie

- De synchrone auto-publishtrigger wordt forward-only vervangen door een
  duurzame private wachtrij met precies één pending record per tenant en
  playlist.
- Een wijzigingsburst krijgt eerst 30 seconden settletijd. Nieuwe verzoeken
  schuiven binnen hetzelfde batchvenster samen tot uiterlijk vijf minuten na
  het eerste verzoek; een playlist kan maximaal één in aanmerking komende
  automatische publicatiebatch per vijf minuten starten.
- Render-readiness, workerbeschikbaarheid en Player-backpressure mogen een
  batch langer uitstellen. Ze veroorzaken nooit extra tussenreleases: de
  nieuwste aanvraag blijft in hetzelfde pending record staan.
- Publicatie vereist minimaal één gekoppelde Player op een relevante
  default-releasevertakking. Iedere relevante default-Player moet de vorige
  release als actief hebben bevestigd voordat een volgende automatische batch
  ontstaat.
- Alleen releasevertakkingen met zo'n gekoppelde, actieve default-Player worden
  gekloond. Ongebruikte, geplande of historische vertakkingen veroorzaken geen
  afzonderlijke automatische release.
- Iedere succesvolle batch maakt uitsluitend nieuwe immutable releases. Zij
  verplaatst default- en gewenste pointers pas na volledige materialisatie en
  wijzigt nooit de actieve last-known-good release van de Player.
- Een fout rolt de gedeeltelijke batch terug, bewaart het ene pending record en
  gebruikt begrensde exponentiële retrybackoff. Verdwenen of definitief
  onbruikbare targets worden zonder release uit de pending toestand gehaald.

### Begrensde guided publish

- De tenant-scoped schermquery is de enige harde datavereiste om targets te
  tonen. Ontbrekende device- of cachetelemetry levert een zichtbare waarschuwing
  en `unknown`, niet een lege targetlijst.
- Alleen paired devices en checksums van hun actieve releases worden geladen;
  release-ID's worden in batches van maximaal 100 opgevraagd. Er is geen
  tenantbrede scan van alle release-items of maximaal-duizend-heartbeatquery.
- Actieve en onderhoudsschermen zijn selecteerbaar; disabled schermen blijven
  zichtbaar maar buiten de uitrol. Zoeken, alles selecteren en wissen zijn
  beschikbaar.
- `blocked` stopt publicatie. `warning` en `unknown` vereisen expliciete
  risicobevestiging. De server hercontroleert revision, readiness, targets en
  preflight in de beveiligde publishactie.

### Control-routeherstel

- Eén centrale routemapping levert een title, description, family en layout voor
  iedere bekende tenantroute en haar alias.
- Resourceworkspaces en de publishjourney behouden op desktop één zichtbare
  sidebar en krijgen FieldFlow-spacing, cards, formulieren en tabellen.
- Alleen de echte playlist- en Studio-canvasroutes zijn immersieve editors;
  publish-, publicatie-, slide- en bron-details blijven in de standaardshell.
- Overzicht, Planning, Schermen, Studio en Media behouden hun bestaande
  referentiepresentatie. Platformroutes behouden hun eigen context.
- Mobile is een herontwerp: inhoud staat vóór preview, controls zijn minimaal
  44 px en horizontale overflow of een mini-desktoplayout is niet toegestaan.

## Database en security

- De migratie is forward-only en wijzigt geen bestaande snapshots of releases.
- Teamcontexten moeten behoren tot een actief team van dezelfde tenant en
  Sportlink-databron. Een vastgezette context moet in de gesynchroniseerde
  `competitionOptions` van dat team bestaan.
- De nieuwe batchcommand blijft capability-, actieve-tenant- en
  idempotency-gated. De requesthash voorkomt hergebruik van dezelfde key voor
  andere inhoud en dubbele aankomstcomponenten in één batch falen.
- Private validatie- en snapshotfuncties zijn niet uitvoerbaar door `public`,
  `anon`, `authenticated` of `service_role`; uitsluitend de gecontroleerde
  publieke commandgrens krijgt `authenticated` execute.
- De private releasewachtrij en haar enqueue-, materialisatie- en
  processorfuncties zijn voor client- en workerrollen niet direct uitvoerbaar.
  De bestaande service-role-only renderclaim verwerkt per poll maximaal één
  due playlist zonder zijn renderleasegrens te openen.
- RLS, tenantfilters, de service-role-browsergrens en Player-device-identiteit
  blijven ongewijzigd. Het immutable releasecontract blijft gelden; S146
  verandert wel expliciet de automatische publicatiecadans en targetselectie.

## Verificatie en releasegates

- Gerichte contract-, domain- en Control-tests bewijzen 22 teams → één component
  per aankomsttype, unieke/bounded teamcontexten, legacy normalisatie,
  latest-releaseprojectie, degraded preflight en routespecifieke shellmetadata.
- Gerichte dynamische pgTAP moet enqueue zonder synchrone release bewijzen,
  burstcoalescing, vijfminutenbegrenzing, Player-acknowledgementbackpressure,
  branchfiltering, rollback/retry, LKG-behoud en terminale queuecleanup.
- `pnpm db:reset`, gerichte S146-pgTAP, volledige `pnpm test:rls` en
  error-level Supabase DB lint/advisors zijn verplicht door de migratie.
- Daarna moeten `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
  `pnpm test:a11y` en de brede Chromium-suite volledig groen zijn.
- Desktop- en 390 px light/dark-bewijs omvat minimaal Sportlink wizard,
  schermkeuze, playlist publish en een representatieve resource/detailroute.
- `git diff --check`, secret scan en changed-file ownership moeten vóór commit
  schoon zijn.
- Commit, push, PR/CI, merge en deployment volgen pas na alle lokale gates.
  Staging en productie gebruiken exact dezelfde merge-SHA/image-digest en
  vereisen health-, migratie-, schermkeuze-, publish- en Sportlink-readback.

## Branch en ownership

Branch: `veyocast/s146-studio-publisher-recovery`.

Baseline: `6e6cb7221abd4a1c0bbd95baafc76c4b26991e16`, de gemergede S145-release.
Ownership omvat uitsluitend de in de S146-ledger genoemde Studio-, scherm-,
publish-, Control-shell-, contract/domain-, test-, documentatie- en ene
forward-only migratiepaden. Player-, service-worker-, lockfile-, locked-brand-
en productiecleanupwijzigingen zijn stop-and-report.

Actuele status op 5 september 2026: implementatie en gerichte verificatie zijn
in uitvoering; er is nog geen S146-commit, push, PR, merge of deployment.
