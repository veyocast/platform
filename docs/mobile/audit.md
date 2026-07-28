# VeyoCast Control Mobile — repositoryaudit

Datum: 28 juli 2026  
Scope: native Android-beheerapp `nl.veyocast.control`

## Bestaande fundamenten

| Onderdeel | Bestaande bron | Mobiele toepassing |
|---|---|---|
| Merk en tokens | `docs/design-canon/v1`, `packages/tokens` | Atelier Ivory Native; Electric Orange is canoniek `#FF5C20`; locked logo-assets worden ongewijzigd hergebruikt |
| Authenticatie | Supabase Auth, profielen en memberships | wachtwoordlogin, sessieherstel/-refresh en resetlink via native Supabase-client |
| Autorisatie | tenantrollen, custom rollen en centrale capabilities | bearer-token plus expliciete tenantheader; elke endpoint controleert membership, tenantstatus en capability |
| Schermen/Players | `screens`, `player_devices`, pairing en `player_commands` | lijst/detail, veilige pairing, schermcreate en idempotente remote commands |
| Media | private tenantstorage, servervalidatie en processingstatus | native picker/camera; afbeelding gaat via dezelfde server-side uploadservice |
| Playlists | revisioned drafts en immutable releases | compacte create/add/move/fit/remove-flow; publicatie gebruikt `publish_playlist_to_targets_v3` |
| Offline | web-Player LKG-canon en Control server state | alleen leescache en uploadqueue; offline state mag geen risicovolle mutatie als voltooid voorstellen |
| Audit | `audit_events` en guarded publisher commands | pairing, remote commands, playlistmutaties/publicatie en deletion intake blijven server-side auditable |
| Accountverwijdering | retention/deletion-governance | native intake en status plus publieke `/account-verwijderen`; uitvoering blijft juridische operationele gate |
| Deployment | main naar staging; afzonderlijke Android-workflows | native CI, protected internal Play-release en exacte artifactpromotie zijn toegevoegd |

## Geverifieerde grenzen

- `apps/control-mobile` importeert geen Next.js-, DOM-, Radix-, shadcn- of
  WebView-componenten.
- De Player blijft een device en wordt geen Supabase Auth-user.
- Service-role secrets komen niet in de app. De anon key is publieke
  runtimeconfig; het access token staat uitsluitend in Expo SecureStore.
- Tenantdata in SQLite bevat geen authenticatie- of pushsecret.
- Wisselen van tenant annuleert tenantqueries en wist tenantgebonden cache en
  uploadqueue voordat de nieuwe context wordt geladen.
- Publiceren maakt geen mutable release en vervangt geen Playercache
  voortijdig.

## Geconstateerde gaten vóór implementatie

- Control had alleen cookie-/Server Action-georiënteerde webinteractie; een
  native bearer-API ontbrak.
- Er was geen afzonderlijk package, versionCode-bereik, signingpad of Play-app
  voor Control.
- Pushdevice-registratie en voorkeuren ontbraken.
- Native offlinecache, veilige tokenopslag, biometrische app-lock, QR-camera en
  durable uploadqueue ontbraken.
- Directe berichten, approvals en een generiek mobiel
  automation-authoringmodel bestaan niet als veilig afgebakend backenddomein.
  Die domeinen zijn niet met mockdata of browserwrappers nagebootst.

## Uitkomst

De repository bevat nu een echte native app en een versioned
`/api/mobile/v1`-grens. De geïmplementeerde kern is lokaal toetsbaar. Play
Console-publicatie, echte signingfingerprints, storebeelden en
hardwareacceptatie zijn externe releasegates en geen lokaal bewijsbare
software-uitkomst.
