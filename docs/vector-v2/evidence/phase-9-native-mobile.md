# Fase 9 — native mobiele cockpit

Datum: 24 augustus 2026  
Branch: `veyocast/s123-vector-v2-living-venue-os`

## Repositorywaarheid

Control Mobile was al een zelfstandige Expo Router/React Native-app zonder
WebView-shell. Authtokens staan in SecureStore; tenantgebonden leescache en de
uploadqueue staan in SQLite. Pairing, schermherstel, camera-upload, lichte
playlistauthoring, immutable publicatie, pushvoorkeuren en biometrische app-lock
gebruiken de bestaande versioned bearer-API.

## Toegevoegd

- `/more/engage` toont echte campagnes, stemtotalen en status;
- alleen voorbereide campagnes kunnen mobiel live worden gezet of gesloten;
- de publieke stemomgeving opent als expliciete externe route;
- featureflag en `tenant.dynamic_slide.read/write` worden server-side
  afgedwongen;
- `transition_engage_campaign_v2` gebruikt een duurzame receipt per actor en
  idempotency key, payloadconflict faalt gesloten en replay schrijft geen
  tweede audit event;
- `get_engage_campaign_metrics_v1` exposeert uitsluitend tenantgebonden
  totalen, zodat menselijke clients geen directe toegang tot pseudonieme
  stemrecords nodig hebben;
- de Control-webworkspace gebruikt dezelfde metricsprojectie.

## Bewijs

| Gate | Resultaat |
|---|---|
| verse `pnpm db:reset` | groen, beide S123-migraties toegepast |
| `pnpm test:rls` | 58 bestanden, 1.188 assertions, PASS |
| Control Mobile lint/typecheck/unit | groen, 9/9 tests |
| Mobile design system lint/typecheck/unit | groen, 3/3 tests |
| Control lint/typecheck/unit | groen, 185/185 tests |
| `config:validate` | `nl.veyocast.control`, versionCode `300000001` |
| Android Hermes-export | groen, 3.899 modules |
| client-bundle secret scan | groen |
| frozen lockfile install | groen en ongewijzigd |

## Release-agegate

Expo adviseert een patchset die op 24 augustus 2026 is gepubliceerd. De
repository supply-chainpolicy weigert die artifacts binnen de minimum release
age. De voorgestelde update is daarom niet gecommit of geallowlist. Herhaal na
het verstrijken van de policywindow:

```bash
pnpm --filter @veyocast/control-mobile exec expo install --check
```

Android signed AAB/Play internal, TalkBack en de fysieke telefoon/tabletmatrix
blijven de reeds gedocumenteerde externe releasegates.
