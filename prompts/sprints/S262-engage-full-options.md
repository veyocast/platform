# S262 — Volledige Engage-opties met leesbare pagina’s

Voer binnen de bestaande expliciete rebuildopdracht het bewezen verschil uit
waar Sync dertien tot vierentwintig Engage-opties weigert. Basis:
`fcd23d72ecbc822a69f7e4c2654b1355dedf8a28`; branch
`veyocast/s262-engage-full-options`; worktree `castivo-s262`. Root beoordeelde
vooraf het bronplan, de concrete ownership en oudereclientcompatibiliteit.

Exclusieve ownership omvat exact 26 paden: het presentatiecontract en de twee
huidige JSON-schema’s; bestaande contracttests voor Sync-slide/dynamic; renderer,
CSS, Engage-projector en hun twee tests; Studio Sync-test; Control Engage-action,
nieuwe actiontest en uitsluitend de Engage-pager in de bestaande createwizard;
nieuwe native Engage-optiespec; eigen pgTAP-test; uitsluitend de CLI-aangemaakte
forwardmigratie `20261019135521_sync_engage_full_options.sql`; eigen doc, dit
prompt en de eigen ledgersectie. De zes aanvullende Playerpaden zijn capability,
runtime, manifestroute, release-envelope en hun twee bestaande tests. Geen
package-, lockfile-, offline-/serviceworker- of historische SQL-wijziging.

Nieuwe polls bevatten expliciet `optionsPerPage: 4` voor alle twee tot
vierentwintig opties. Behoud alle ID’s, labels, volgorde, stemmen en privacyregels.
Gebruik dezelfde paginateller in wizard, editor, volledige export, releasefreeze
en Player. Historische ongemarkeerde twee/twaalf-optiedocumenten behouden hun
éénpagina-binary en tijdssemantiek. Geen automatische omzetting van oude kaarten,
truncate, mutabele release, postervervanging of vereenvoudigde offlineactivatie.
Een livebron met andere bevroren optie-ID’s/volgorde/lengte wordt geweigerd.

Gebruik voor gemarkeerde landscape maximaal vier antwoorden in twee kolommen,
expliciete metadata op de laatste rij en horizontale ademruimte van 1,2cqw naast
0,2cqw rijruimte. Portrait gebruikt de gecontroleerde compacte QR-strook en
expliciete vraagvarianten; behoud volledige gegevens, Source-fontfamilies,
OnzeTrots-assets, QR-maat/padding/quietzone en logische antwoordfonts van minimaal
26 pixels. Laat de wizard per pagina wisselen met 44-pixelknoppen. Controleer
160-tekenvragen, vier 160-tekenlabels tegelijk, ongebroken tekst en laatste
pagina’s met één/twee/drie antwoorden. Geen clipping, ellipsis, automatische
fontverkleining, assert- of deadlineversoepeling.

Onderhandel de nieuwe Engage-pagingcapability naast normale Sync. Oudere/noheader-
profielen krijgen dezelfde volledige gevalideerde binary/hash/duur zonder het
onbekende DOM-veld of bijbehorende online uitbreiding. Toets hoofd/compositie,
ETag/Vary/304 en ongeldige headers. Claim geen fysieke clientdowngrade of LKG-proef.

Behoud alle oorspronkelijke private admission-/releaseguards. Nieuwe helper:
immutable, security-invoker, lege search_path en expliciete revokes voor public,
anon, authenticated en service_role. JSONB4 en4.0 moeten dezelfde teller geven.
Alle 199 historische migraties blijven bytegelijk; geen publieke RPC/ACL/RLS-
verbreding, backfill, dependency- of tokenwijziging.

Root gaf afzonderlijk GO voor de echte begrensde checks. Native V10 is gesloten:
8/8 PASS, 104 oorspronkelijke PNG’s, 84 geometrieën, 390/1440 in beide oriëntaties,
30 seconden per geval/180 globaal/één worker/0retry. Root beoordeelde gewone en
maximale beelden. De oorspronkelijke unitrun120, getroffen projectorchecks55,
laatste DOM17 en scopedlint zijn afzonderlijke overlappende bewijzen.

Gecombineerde DB V18 is gesloten met exit0: normale CLI-remote-reset201,
gerichte187 pgTAP-checks, volledige136 bestanden/4454 checks en CLI-errorlint0.
De pgTAP-uitvoering gebruikt twee expliciete equivalente lokale pg_prove-
containers; normale volledige CLI/CI blijft apart nodig. Echte managed bootstrap,
gepinde normale CLI-defaultprivileges en telemetrie-opt-out zijn harnasconfiguratie,
geen product-/rechtenherstel. Alle rode historische bewijzen blijven behouden.
Geen QA57621/57622- of oude57722-writes; alle eigen actors/aliases/geheimen gesloten.

Root autoriseerde na de echte groene closure uitsluitend de drie eigen
registraties en daarna een gewone commit/push/draft-PR tegen
`veyocast/s244-integrated-sync-acceptance`. Bewaar de overige 23 bestanden exact
bevroren. De echte MP4/QR-keten is alleen voorbereid; geïntegreerde foundation,
volledige Player/offline, fysieke proeven en uitrol zijn nog open. Geen afgeronde
volledige prototypevergelijking claimen: **0/5 volledige ronden**.
