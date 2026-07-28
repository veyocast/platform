# VeyoCast Control Mobile — security en privacy

## Vertrouwensgrenzen

- Supabase Auth refresh/access tokens worden via een SecureStore-adapter
  opgeslagen met `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- De app bevat nooit een service-role key, signingsecret of Play-credential.
- De mobiele API valideert `Authorization: Bearer`, leest
  `X-VeyoCast-Tenant-Id` en controleert per request membership, actieve tenant
  en capability.
- RLS blijft de tweede server-side afdwingingslaag.
- Mutaties gebruiken UUID-idempotency keys; remote commands hebben nonce en
  TTL.
- FCM-tokens worden server-side AES-GCM versleuteld opgeslagen; lookup gebruikt
  een SHA-256-hash. De encryptiesleutel komt uit
  `MOBILE_PUSH_TOKEN_ENCRYPTION_KEY`.
- Accountverwijdering maakt een auditable request. Een destructieve purge wordt
  niet stilzwijgend uitgevoerd zolang legal-retentionregels niet operationeel
  zijn afgetekend.

## Lokale data

| Data | Opslag | Verwijdering |
|---|---|---|
| Authsessie | SecureStore | logout |
| Actieve tenant | SecureStore | tenantwissel/logout |
| Biometrische voorkeur | SecureStore | securityinstelling |
| Pushdevice-id | SecureStore | push uitschakelen/logout |
| Cockpit/scherm/contentcache | app-private SQLite | tenantwissel/logout |
| Wachtende afbeelding | app-private bestand + SQLite | voltooiing, tenantwissel of logout |

SQLite bevat geen authtoken of FCM-token. Android backup is uitgeschakeld.

## Android-permissies

| Permissie | Moment | Doel |
|---|---|---|
| `CAMERA` | just-in-time | QR-code scannen of expliciet een foto maken |
| `POST_NOTIFICATIONS` | na expliciete opt-in | operationele pushmeldingen op Android 13+ |

Locatie, contacten, telefoonstatus, microfoon, legacy externe opslag en
advertentie-ID zijn expliciet geblokkeerd. Afbeeldingen gebruiken de Android
Photo Picker waar beschikbaar.

## SDK- en datainventaris

| SDK | Doel | Externe datastroom |
|---|---|---|
| Expo/React Native modules | native runtime en devicefuncties | geen autonome advertentieflow |
| Supabase JS | auth en tokenrefresh | e-mail, authmetadata en sessietokens naar de geconfigureerde VeyoCast Supabase |
| Expo Notifications/FCM | native push | FCM-token en notificatiebezorging |
| TanStack Query | serverstate | lokaal in geheugen |
| SQLite/SecureStore | lokale state | geen externe stroom |

Er is geen advertising SDK, contacts SDK, location SDK of third-party
crashprovider toegevoegd. Crashrapportage vereist een apart privacy- en
providerbesluit.

## Data Safety-concept

Voor de huidige code:

- accountgegevens: e-mailadres en user-id voor appfunctionaliteit en security;
- organisatie-inhoud: scherm-, playlist- en mediadata voor appfunctionaliteit;
- foto's: alleen na gebruikersactie, voor upload/publicatie;
- device/app-info: appversie, locale en tijdzone voor pushregistratie;
- appinteracties/diagnostiek: server-audit, request-id en operationele
  commando-/foutstatus;
- push token: appfunctionaliteit, versleuteld opgeslagen;
- geen advertenties, locatie, contacten, financiële gegevens of
  advertentie-ID;
- transport over HTTPS; server-side secrets gehasht of versleuteld waar van
  toepassing.

De definitieve Play Data Safety-form moet tegen de werkelijk geconfigureerde
Supabase-, Google/FCM- en eventuele toekomstige observabilityproviders worden
afgetekend.

## Privacy-impact

De publieke privacyverklaring moet expliciet de native Control-app, FCM,
app-private offlinecache, afbeelding-uploadqueue, bewaartermijnen en
accountverwijdering noemen. De bestaande publieke verwijderingsroute is
`https://veyocast.nl/account-verwijderen`.
