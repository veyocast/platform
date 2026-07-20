# VeyoCast media-upload threat model

## Scope

Dit model geldt voor de Control-uploadintent, browseroverdracht naar private
Supabase Storage, finalisatie, de mediaworker en gebruiksdata. De player krijgt
uitsluitend assets uit een immutable, volledig geverifieerde release.

## Vertrouwensgrenzen

- Bestandsnaam, extensie, browser-MIME, titel, grootte en TUS-metadata zijn
  onbetrouwbare clientinput.
- De authenticated Supabase-JWT is alleen transportauthenticatie; tenant,
  capability en tenantstatus worden opnieuw server-side bepaald.
- Storage-objectmetadata bewijst geen veilige inhoud. De worker controleert de
  echte container met `ffprobe`, normaliseert naar het playercontract en maakt
  pas daarna de asset `ready`.
- TUS-upload-URL's zijn hervatlocators, geen productautorisatie. VeyoCast slaat
  geen access token, signed URL of signed uploadtoken in de database of eigen
  langdurige clientstate op.

## Dreigingen en controles

| Dreiging | Verplichte controle | Bewijs |
|---|---|---|
| Cross-tenant upload of read | exact `tenant_id`, capability en RLS default deny | `rls_media_resumable_upload.sql` |
| Path traversal of sibling-path write | server genereert het pad; Storage RLS vereist een exacte, actieve intent | RLS traversal- en siblingpathtests |
| MIME/extensie spoofing | server controleert MP4-extensie en MIME; finalize vergelijkt objectmetadata; worker probet inhoud | intent-, finalize- en workertests |
| Oversize of quota race | per-bestandslimiet plus tenantquotacontrole onder een tenant-rowlock | oversize- en quotatest |
| Chunk replay/dubbele submit | unieke `(tenant, actor, idempotency_key)` en idempotente finalize | replaytests voor intent en finalize |
| Onderbroken upload | TUS in vaste 6 MiB-delen, retry, pause/resume en dezelfde file fingerprint | Control-uploadclient en E2E-contract |
| Onveilige of corrupte video | niet-retrybare inhoudsfout gaat in quarantaine; geen variant of playlisttoegang | worker-RPC-test |
| Weesobject na annuleren | TUS termination, exact-pad servercleanup, cancelled/deleted statetransitie | canceltest en runbook |
| Geheimlek via URL/state/log | token alleen in requestheader; eigen localStorage bevat alleen bestandsmetadata, intent-ID en idempotency-ID | schemascan en clientbundelguard |
| Mutable gepubliceerde media | vervangen maakt een nieuw asset; releases blijven immutable | release-RPC en RLS-tests |

## Herstelcontract

- `uploading`: hetzelfde lokale bestand selecteren hervat de bestaande intent.
- `processing`: de asset blijft buiten conceptpublicatie totdat de worker klaar is.
- `validation_failed`: alleen een tijdelijke, herstelbare workerfout mag opnieuw
  worden ingepland.
- `quarantined`: inhoud of metadata is onbetrouwbaar; niet retrien, maar opnieuw
  aanleveren als nieuw asset en het oude item archiveren.
- `ready`: checksum en playervariant zijn geregistreerd; gebruiksimpact toont
  conceptplaylists, immutable releases en toegewezen schermen.

## Resterende operationele risico's

- Supabase ruimt verlopen TUS-resources op; VeyoCast moet in S29 daarnaast een
  periodieke weesobject-/verlopen-intentcontrole en metriek inzetten.
- Browserbeveiliging staat niet toe dat een `File` na reload stilzwijgend opnieuw
  wordt geopend. De gebruiker moet hetzelfde bestand opnieuw selecteren; de
  bevestigde chunks worden daarna hervat.
- Malware-scanning buiten container-/codecvalidatie is geen MVP-claim. Een
  toekomstige scanner moet vóór `ready` in dezelfde fail-closed pipeline komen.
