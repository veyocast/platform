# Begrensde actuele Source-video

De bestaande immutable publicatie behoudt haar release-, item-, versie-,
snapshot-, template- en configuratie-identiteit en oorspronkelijke volledige
export. Een gekwalificeerde `sync-dynamic-binary-v1` Player kan daarnaast een
volledige video van nieuwere gepubliceerde bronfeiten ontvangen. Dit verandert
uitsluitend de geautoriseerde delivery-envelope; er ontstaat geen nieuwe
Media-, renderjob-, ontwerpversie- of releaserij.

`20261018103016_sync_published_binary_refresh.sql` breidt de bestaande
`private.published_data_refresh_queue` uit met een data-/binaryfase. De oude
dataworker claimt uitsluitend data. `claim_dynamic_render_job_v3` gebruikt
dezelfde bestaande worker, leasefencing, Source-renderer en FFmpeg-uitvoer.
Nieuwe feiten worden samengevoegd in één rij per tenant/configuratiesnapshot.
DOM-feiten wachten niet op een toekomstige encode. Verschillende encodes
starten minimaal vijf minuten na elkaar; dezelfde mislukte hash krijgt hooguit
drie pogingen. Gewijzigde feiten tijdens een lease worden daarna opnieuw als
data samengevoegd.

Elke configuratie bezit drie vaste private Storage-prefixen: current, previous
en een inactieve schrijfplaats. De oorspronkelijke publicatie-export valt daar
buiten en blijft behouden. Een video is maximaal 64 MiB en zijn poster maximaal
16 MiB; alle drie plaatsen samen tellen mee voor een tenantbudget van 512 MiB.
Vóór iedere renderpoging wordt 80 MiB afzonderlijk en duurzaam gereserveerd.
`20261018123001_sync_binary_storage_fencing.sql` geeft iedere poging een
nooit hergebruikte lease-UUID vóór de SHA in de bestandsnaam. De worker neemt
éérst de exacte bestandslijst op, valideert daarna zijn actuele SQL-lease en
verwijdert uitsluitend die vastgelegde namen. Een vertraagde oude listing mag
zo geen inmiddels actuele bestanden van een opvolger verwijderen. Ook gelijke
bytes van twee pogingen hebben verschillende namen.

Een huidige/inactieve plaats heeft hooguit drie nog onbekende schrijvers;
nieuwe bronhashes resetten deze grens niet. Hun afzonderlijke 80 MiB-reserveringen
blijven naast geregistreerde artifacts meetellen voor het tenantbudget van 512 MiB.
Succes geeft uitsluitend de eigen reservering vrij. Onbekende oude schrijvers
worden niet door leaseverloop, een lege listing, een nieuwe succesvolle poging
of snapshotretentie vergeten. Budget- of schrijversuitputting stopt nieuwe
encodes; current/previous playback blijft behouden.

Bij referentieveilige snapshotretentie ruimt dezelfde bestaande worker de
bekende bestanden op via de Storage-API. Een fout houdt verwijzingen en budget
vast met backoff. Zijn er onbekende schrijvers of oude reserveringen, dan blijft
het private record staan met `binary_writer_drain_required` en één dag backoff.
Alleen een expliciete operatorcontrole die de betreffende oude workers
beëindigd/bevestigd heeft, gevolgd door gerichte namespace-opruiming, mag die
reserveringen vrijgeven. Een lege Storage-listing bewijst geen beëindigde writer.
Er is geen automatische onbegrensde herallocatie of extra queue/poll.

De device-geautoriseerde bestaande bootstrap neemt de identiteit van de
bevestigde binary mee in `data_key`, ook voor compositiezones. Daarmee wordt
een eerdere ETag ongeldig zodra de encode gereed is, onafhankelijk van het
eerdere moment waarop bronfeiten zijn ververst. De tweede targetcontrole
voorkomt een verouderde response bij een gelijktijdige wijziging. Er is geen
extra Player-poll of apart manifest-RPC bijgekomen.

De Player controleert tenantpad, profiel, configuratie, datarevisie, volledige
duur/alle pagina's, bytes en SHA. Download en verificatie onderbreken de huidige
uitzending niet. Een voorbereide kandidaat wisselt op het natuurlijke einde
van de huidige volledige video. Beschadigde/onbeschikbare uitvoer verdringt
nooit de lokaal geverifieerde release. Bestaande per-asset retrybudgetten blijven
leidend. Tijdelijke herregistratie van dezelfde installatie herstart de
bestaande afspeelsessie niet; echte credentialwijzigingen blijven afzonderlijk.

## Bewijs

- `sync-binary-installation-continuity.json`: twee onderbroken echte
  installatieverzoeken, vervolgens echte HTTP 200/bound; twee ononderbroken
  24s-loops en behoud van alle drie lokale identiteitsdelen.
- `sync-binary-refresh-boundaries.json`: eerste SHA-gecorreleerde wissel na
  24s, 53 ms tussen einde en nieuwe start. De aanvullende cooldownassertion
  faalde terecht omdat tijdens foutdiagnose vijf minuten waren verstreken;
  die poging blijft afzonderlijk bewaard.
- `sync-binary-refresh-cooldown.json`: echte AAL2-prijscommando's met identieke
  herhaalreceipts, werkelijke bestaande data-/renderworkers, volledige private
  MP4's en SHA's, één samengevoegde rij, een idle worker vóór de deadline en
  302.702 ms tussen encodes. Wissels na 24s met 43/33 ms handoff; vaste plaatsen
  1→2→0, nieuwste uitvoer offline na cold reload, identiteit en immutable
  historie behouden. Laatste uitvoer: 24s/9 regels/3 pagina's, 3.183.585 bytes,
  SHA `95bd4939f16b70749446e3ed50bc3b546e33fba9eec964ddf02f149e1ee60924`.
- `sync-binary-corrupt-candidate.json`: echte servermanifest/private bytes,
  uitsluitend transportbytes bewust veranderd bij dezelfde bestandsgrootte.
  SHA-controle weigert de kandidaat; bestaande retrygrens voorkomt direct
  herdownloaden. Oude complete video blijft actief en start offline opnieuw.
  Geldige transportrecovery wisselt pas na het volledige oude einde.
- Verse geïsoleerde migratierun en volledige RLS: 128 bestanden/3.587 checks,
  waaronder 69 gerichte binarychecks. De twee workerinterleavings (listing vóór
  en na leaseovername) en identieke SHA bij verschillende leases zijn afzonderlijk
  gecontroleerd. Budget/cap weigeren nieuwe claims over bronhashes heen. App-schema-DB-lint op foutniveau nul.
  Workspace lint/type/unit elk 30/30; 25 Studio-browsercases na herstel van de
  Source-versiegeschiedenis. Playerbuild `bdxQ7X0HdiQeUZNLvkTSE`.

De eerdere bytes-/offlineproef `sync-binary-refresh-real.json` blijft PARTIAL:
haar oorspronkelijke timingassertion koppelde oud/nieuw niet op SHA. De
oorspronkelijke indruk en gevonden installatie-/ETagfouten worden niet
achteraf als geslaagde natuurlijke wissel gepresenteerd. Lokale productprijzen
in deze afgebakende QA-bron zijn nu € 6,55/revisie 12; oude mutatietools niet
opnieuw uitvoeren. Dit bewijs betreft opgeslagen canonical feiten, geen
externe provider, realtime binary-scoreoverlay, fysiek apparaat of hosted deploy.

## Herstel en terugrol

Na drie fouten voor dezelfde hash blijven current, previous, de oorspronkelijke
export en eventuele uploadreservering behouden. Nieuwe werkelijk gewijzigde
feiten kunnen de vaste inactieve prefix opnieuw laten reinigen/vervangen.
Voor een expliciete operatorretry zonder gewijzigde feiten: controleer eerst
de concrete fout en Storage-toegang; een databasebeheerder kan vervolgens
transactioneel uitsluitend de bevestigde tenant/snapshot/hash vrijgeven door
`last_failed_hash` conditioneel te wissen en
`private.enqueue_published_binding_v1(tenant,snapshot)` aan te roepen. Een
veranderde hash/lease betekent opnieuw lezen, geen blind herhalen. Dit is
geen publieke browserbevoegdheid of automatische eindeloze retry.

Applicatieterugrol gebruikt de bestaande immutable releaseflow. De additive
migraties blijven staan; oude data-/renderworkers kunnen hun bestaande werk
blijven verwerken en oude clients ontvangen de oorspronkelijke complete
fallback. Nieuwe binarytaken wachten tijdens een oude-workerterugrol op de
v3-worker. Verwijder private cache-/reserveringsrijen of Storage niet om de
terugrol af te dwingen: daarmee zouden bewaakte opruimverwijzingen verloren
gaan. Geen downmigratie, database-reset, uninstall of cache-/pairingwisactie.
