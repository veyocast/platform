# Player pairing- en herstel-inventaris

## Nulmeting

- Branch bij start: `veyocast/s47-screen-automation`
- Start-SHA: `7176d30fae95029fd9dc794fe9939aa59a667f7a`
- Worktree: schoon
- Node: `v24.18.0`
- pnpm: `11.5.2`
- Player lint, typecheck, 70 Vitest-tests en production build: groen
- Production Player op 26 juli 2026:
  - `/lg`: HTTP 200, revision
    `de82605ab2397381de26e228e8f898be14c3b876`;
  - `/api/health`: gezond;
  - één begrensde publieke pairingcontrole: HTTP 200 met een tijdelijke
    tienminutensessie. De tijdens die controle uitgegeven code en credential
    zijn niet vastgelegd in dit document.

De publieke pairingservice was tijdens de nulmeting dus bereikbaar. Dat sluit
een eerdere tijdelijke storing niet uit, maar bewijst dat de waargenomen LG
ook door achtergebleven lokale state herstelbaar moet zijn.

## Opslagcategorieën

### 1. Installatie-identiteit

| Opslag | Sleutel | Inhoud | Huidig gedrag |
|---|---|---|---|
| `localStorage` | `veyocast.player.instanceId` | Niet-geheime UUID of 32 hextekens | Wordt vóór pairing aangemaakt met `crypto.randomUUID()` of `crypto.getRandomValues()`. Bij storagefout bestaat alleen een vluchtige waarde voor de huidige pagina. |

De instance-ID is nu alleen onderdeel van de gehashte creation-rate-limit-
fingerprint. Er bestaat nog geen duurzame server-side `Installation`-entiteit
of afzonderlijke installatiecredential. De oude merknamespace wordt voor deze
sleutel niet gemigreerd.

### 2. Tijdelijke pairingpoging

| Opslag | Sleutel | Inhoud |
|---|---|---|
| `localStorage` | `veyocast.player.pairingCode` | Zichtbare code met spatie |
| `localStorage` | `veyocast.player.pairingExpiresAt` | ISO-verlooptijd |
| `localStorage` | `veyocast.player.pairingProvisionAfter` | Epoch-millisecond voor een volgende aanvraag |
| `localStorage` | `veyocast.player.deviceToken` | Tijdens pairing ook het ruwe pending token |

De vroegere merknamespace bevat compatibele sleutels voor `pairingCode`,
`pairingExpiresAt` en `deviceToken`. `readAndMigrateStorageValue` migreert ze
lazy naar `veyocast.*`. `pairingProvisionAfter` heeft geen oude tegenhanger.

Dit is de belangrijkste bestaande vermenging: hetzelfde `deviceToken`-veld
vertegenwoordigt zowel een nog niet geclaimde pairingpoging als een gekoppeld
devicecredential. Alleen de aanwezigheid van code- en expirymetadata maakt het
onderscheid lokaal zichtbaar.

### 3. Schermbinding

De browser bewaart geen afzonderlijke screen-ID of tenant-ID. De binding staat
server-side in:

- `player_devices.tenant_id`;
- `player_devices.screen_id`;
- de claimed velden van `pairing_sessions`;
- de unieke partial index voor maximaal één `paired` device per scherm.

### 4. Authenticatiecredential

| Opslag | Sleutel | Inhoud |
|---|---|---|
| `localStorage` | `veyocast.player.deviceToken` | Ruw, revocable bearer token |

Het ruwe token blijft alleen op de Player. De database bewaart uitsluitend
SHA-256 in `player_devices.token_hash`. Manifest en heartbeat sturen het token
in de `Authorization: Bearer`-header. Een oude compatibilityroute accepteert
ook `?deviceToken=`, maar verwijdert die query direct uit de zichtbare URL.

### 5. Gecachte playlist en media

| Opslag | Naam | Inhoud |
|---|---|---|
| IndexedDB | `veyocast-player-cache-v1`, versie 2 | `activeReleases` en `previousReleases`, keyed op het ruwe device-token |
| Cache Storage | `veyocast-player-assets-v1` | Geverifieerde media/posters onder checksum-key |
| Cache Storage | `veyocast-player-shell-v3` | `/`, `/lg`, manifest, locked setup-assets en ontdekte Next-shellchunks |

De vroegere merknamespace heeft een gelijknamige database, assetcache en
shellcacheprefix. De runtime migreert release/mediarecords lazy en verwijdert
de oude cache daarna. Deze data is last-known-good en mag niet door een gewone
tijdelijke netwerkfout worden verwijderd.

### 6. UI- en diagnosegegevens

| Opslag | Sleutel/database | Doel |
|---|---|---|
| `localStorage` | `veyocast.player.reloadTimestamps` | Begrensde playbackreloads |
| `localStorage` | `veyocast.player.automation.v1` | Laatste server-side automationstate |
| `localStorage` | `veyocast.player.automation.report.v1` | Nog te bevestigen lokaal automationrapport |
| `localStorage` | `veyocast.player.automation.capabilities.v1` | Native shellcapabilities |
| `sessionStorage` | `veyocast.player.installPromptDismissed` | PWA-installatieprompt gesloten |
| `sessionStorage` | `veyocast.player.lgSignageCapabilities` | Door de IPK-wrapper geleverde LG-capabilities |
| IndexedDB | `veyocast-device-lab-v1`, store `runs` | Expliciete Device Lab-rapporten |

Deze gegevens zijn geen pairingbinding. Een soft pairingrecovery hoort ze
niet generiek te wissen. Device Lab-data wordt evenmin als playercache
behandeld.

## Cookies

Normale pairing gebruikt geen cookie.

De Player-origin kent twee niet-pairingcookies:

- `veyocast_player_demo_session`: HttpOnly staging-reviewdemo;
- `veyocast_device_lab_session`: HttpOnly afgeschermde Device Lab-sessie.

Beide zijn `SameSite=Strict`, `Secure` in production en hebben path `/`.
Omdat ze HttpOnly zijn kan een recoverypagina ze niet en niet selectief via
JavaScript verwijderen. Ze mogen ook niet als pairingstate worden gewist.

## Service worker

`/sw.js` registreert met scope `/`. De worker:

- precachet `/` en `/lg` plus hun lokale Next-/brandassets;
- gebruikt network-first voor navigaties;
- gebruikt cache-first voor lokale shellassets;
- bedient checksum-media met Range-ondersteuning;
- negeert Player-API's;
- migreert de oude merkcache;
- verwijdert oude shellcacheversies bij activatie.

Een defecte of verouderde worker kan daardoor ook een oude `/lg`-shell blijven
aanbieden wanneer het netwerk faalt. Herstel moet worker, shellcache en
playerassetcache feature-detected behandelen, zonder ongerelateerde origin-
caches te verwijderen.

## Pairingaanvraag en claim

1. De Player maakt lokaal de instance-ID.
2. `POST /api/player/pairing` genereert server-side:
   - een random bearer token van 32 bytes;
   - een niet-ambigue code van zes tekens;
   - SHA-256 van token, code en requestfingerprint.
3. `create_pairing_session_v3`:
   - neemt een advisory transaction lock op de fingerprint;
   - begrenst vijf aangemaakte sessies per tien minuten per fingerprint;
   - begrenst 300 aangemaakte sessies per minuut globaal;
   - annuleert de vorige pending sessie voor dezelfde fingerprint;
   - schrijft een nieuwe pending sessie met tien minuten TTL.
4. De Player bewaart pending token, code en verloop lokaal.
5. Control hasht de overgenomen code en roept
   `claim_pairing_session_v3` aan.
6. De claim:
   - valideert actor, capability, actieve tenant en actief scherm;
   - rate-limit tien claims per actor per vijf minuten;
   - vergrendelt de pairingsessie;
   - retourneert machinecodes voor rate limit, replay, expiry en onbeschikbaar
     scherm;
   - trekt een bestaand paired device voor hetzelfde scherm in;
   - maakt transactioneel een nieuw `player_devices`-record;
   - wist `pending_token_hash` uit de pairingsessie;
   - markeert de sessie claimed en audit `player_device.paired`.
7. De Player pollt iedere twee seconden een `READY`-heartbeat. Na een geldige
   claim slaagt die, waarna alleen code/expiry lokaal worden verwijderd en de
   bearercredential behouden blijft.

Verlopen, geannuleerde en pending sessies ouder dan vijftien minuten worden bij
een volgende creation-attempt verwijderd. Claimed sessies blijven audit- en
devicereferentie.

## Device-authenticatie na pairing

- `GET /api/player/manifest` hasht de bearercredential en gebruikt
  `get_player_device_bootstrap`.
- Alleen `paired` devices op een `active` scherm worden teruggegeven.
- Zonder gewenste release volgt een succesvolle `READY`-envelope.
- Met release volgt een tenantgebonden, immutable manifestenvelope.
- Heartbeat gebruikt dezelfde tokenhash en schrijft runtime, release,
  storage, platform, capabilities, veilige foutcode en syncevents.
- Een ingetrokken of onbekende token geeft nu dezelfde `UNPAIRED`-uitkomst.

## Databasevelden

### `pairing_sessions`

`id`, `code_hash`, `pending_token_hash`, `device_fingerprint_hash`, `status`,
`expires_at`, `claimed_by`, `claimed_tenant_id`, `claimed_screen_id`,
`paired_device_id`, `claimed_at`, `created_at`, `updated_at`.

### `player_devices`

`id`, `tenant_id`, `screen_id`, `device_name`, `token_hash`, `status`,
`app_version`, `platform`, `user_agent_summary`, `capabilities`,
`storage_quota_bytes`, `storage_used_bytes`, `active_release_id`,
`desired_release_id`, `last_seen_at`, `paired_at`, `revoked_at`,
`last_error_code`, `last_error_at`, `sync_retry_requested_at`, timestamps en
latere automationvelden.

### `screens`

Bevat de tenantgebonden beheerde screenconfiguratie en de huidige toegewezen
playlist/release. Pairing verwijdert het schermobject of de assignment niet.

## Huidige timers en retries

- Pairingcode-TTL: 10 minuten.
- Claimpoll: iedere 2 seconden.
- Lokale creationcooldown: 5 seconden.
- Transient creationretry: 5, 10, 20, 40 en daarna maximaal 60 seconden.
- HTTP 429: respecteert `Retry-After`/body, begrensd op 1 seconde tot
  10 minuten.
- Persisted `pairingProvisionAfter`: alleen geaccepteerd tot maximaal
  10 minuten in de toekomst; een onrealistische klokwaarde wordt verworpen.
- Manifestpoll zonder content: 5 seconden.
- Normale manifestpoll: 60 seconden met exponential back-off tot 5 minuten.
- Heartbeat: eerste poging na 1 seconde, daarna iedere 30 seconden.
- Pairing- en manifest-`fetch` hebben geen eigen aborttimeout.
- Creationretry heeft geen maximaal aantal pogingen of escalatie naar lokale
  herstelbediening.

## Waarom “Nieuwe koppelcode voorbereiden” kan blijven staan

De UI-state is geen server-side blokkering, maar kan voor de gebruiker wel
permanent zijn:

1. Iedere niet-429 pairingfout wordt als transient behandeld, ook wanneer de
   fout structureel of lokaal definitief is.
2. Retry gaat onbegrensd door en eindigt steeds in `PAIRING_RETRY`; er is geen
   maximale hersteltijd, fysieke actie of recoverylink.
3. `fetch` heeft geen timeout. Een request dat op deze browserengine nooit
   resolve/reject, houdt de Player zonder gecontroleerd herstel vast.
4. Pending en actieve credentials delen één sleutel. Partiële writes of
   corrupte companionmetadata maken lokale classificatie ambigu.
5. De Player bewaart wel een instance-ID, maar de server heeft geen
   afzonderlijke Installation en installatiecredential. Daardoor kan Control
   een browser met een kapotte devicebinding nog niet onafhankelijk bereiken.
6. De normale React/Next-client is de enige hersteluitvoerder. Een
   chunk-, hydration-, IndexedDB- of serviceworkerfout heeft geen eenvoudige
   route buiten die bundle.
7. De huidige foutcopy toont geen stabiele machinecode en escaleert na twee
   minuten niet naar een lokaal menu.

Een verlopen volledig opgeslagen pairingcode roteert al automatisch. Een
ingetrokken online device gaat al terug naar pairing en een tijdelijke
manifeststoring verwijdert een geldige last-known-good koppeling niet. De open
gaten zitten vooral in partiële/corrupte lokale state, timeoutclassificatie,
zelfbediening en remote herstel.
