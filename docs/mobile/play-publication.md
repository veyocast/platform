# VeyoCast Control Mobile — Google Play-publicatie

## Artifact en identiteit

- Appnaam: VeyoCast Control
- Package: `nl.veyocast.control`
- Versie: `1.0.0`
- Gereserveerd versionCode-bereik: `300000000`–`399999999`
- Target/compile SDK: 36
- Min SDK: 26
- Release AAB:
  `apps/control-mobile/android/app/build/outputs/bundle/release/app-release.aab`

`android/` wordt reproduceerbaar door Expo prebuild gemaakt en niet als
handmatig beheerde bron ingecheckt.

## Workflows

- `control-mobile-ci.yml`: Expo dependency/config, lint, typecheck, unit,
  Hermes export, secretscan, Android lint/test/AAB, manifest, native
  library-inventaris, 16-KB-validatie en CycloneDX SBOM.
- `control-mobile-play-internal.yml`: alleen `main`, protected environment,
  afzonderlijke Control-uploadkey, signingfingerprintcheck, FCM-config, WIF en
  uitsluitend Play internal.
- `control-mobile-play-production.yml`: protected handmatige approval,
  downloadt exact het eerder bewaarde internal-artifact, verifieert commit,
  versionCode en SHA-256 en promoveert zonder rebuild met 5–10% staged rollout.

Vereiste protected environments:

- `android-control-internal`
- `android-control-production`

Vereiste secrets/variables staan rechtstreeks en fail-closed in de workflows.
Gebruik voor Google Cloud Workload Identity Federation; maak geen
service-account JSON-key.

## Signing en App Links

Maak een afzonderlijke Play-app en Control-uploadkey. Vul
`ANDROID_CONTROL_UPLOAD_CERT_SHA256` met de uploadcertificate fingerprint.
Publiceer voor App Links de Play App Signing-fingerprint in
`https://control.veyocast.nl/.well-known/assetlinks.json`; de uploadfingerprint
is daarvoor niet voldoende.

De signingfingerprint kan lokaal niet eerlijk worden ingevuld voordat de
eigenaar Play App Signing en de Control-uploadkey heeft aangemaakt.

## Store-copy

Korte beschrijving:

> Beheer schermen, publiceer content en los storingen direct op.

Volledige beschrijving voor de huidige implementeerde scope:

> VeyoCast Control is de native mobiele cockpit voor organisaties die hun
> schermcommunicatie beheren met VeyoCast.
>
> Bekijk welke schermen online zijn en waar aandacht nodig is. Koppel een
> Player via QR-code of code, upload onderweg afbeeldingen, pas playlists licht
> aan en publiceer een nieuwe release naar gekozen schermen. Ontvang
> optionele meldingen en voer veilige herstelacties uit wanneer een Player
> problemen heeft.
>
> Belangrijkste functies:
>
> • Overzicht van schermstatus en aandachtspunten  
> • Schermen koppelen via QR-code of koppelcode  
> • Foto’s kiezen of maken en veilig uploaden  
> • Playlists bekijken, licht aanpassen en publiceren  
> • Remote Player-herstel met auditable opdrachten  
> • Optionele pushmeldingen per categorie  
> • Veilige toegang op basis van je VeyoCast-rol  
> • Biometrische appvergrendeling  
>
> Voor gebruik zijn een actieve VeyoCast-organisatie en een geldig
> gebruikersaccount vereist.

## Store-assets

Reeds bruikbaar uit locked brandmasters:

- 512×512 app icon;
- adaptive foreground/background;
- light/dark splash.

Nog extern te produceren en goed te keuren:

- 1024×500 feature graphic;
- monochroom transparant notification icon;
- minimaal zes echte telefoonscreenshots;
- vier 7-inch- en vier 10-inch-tabletscreenshots;
- captions en visuele store-assetreview.

Screenshots mogen pas uit een permanente synthetische reviewtenant worden
gemaakt nadat de echte releasebuild op hardware draait. Geen feature of data
mag voor storebeelden worden gefingeerd.

## Play Console-checklist

1. Maak package `nl.veyocast.control` als afzonderlijke app.
2. Activeer Play App Signing en leg upload- en appsigningfingerprints vast.
3. Maak WIF-serviceaccount met uitsluitend benodigde Android Publisher-rechten.
4. Configureer protected environments, secrets en publieke runtimevariables.
5. Maak FCM-project/app en lever het production `google-services.json` als
   protected base64-secret.
6. Publiceer privacy-, support- en accountverwijderings-URL.
7. Vul Data Safety, advertentieverklaring (geen advertenties), content rating
   en doelgroep in.
8. Maak een permanente privacyveilige reviewtenant zonder OTP/betaling.
9. Draai internal workflow op `main`, installeer exact uit Play internal en voer
   hardwarematrix en pre-launch report uit.
10. Promoveer uitsluitend hetzelfde artifact via protected productionworkflow.

## Stop en rollback

- Stop een production staged rollout in Play Console bij crash/ANR,
  authenticatie-, tenantisolatie- of dataverliesincident.
- Verhoog de rollout nooit zonder observatie van de geteste fractie.
- Android artifacts worden niet teruggebouwd; herstel met een hogere
  versionCode die de laatst bekende goede commit bevat.
- Backend staging volgt de bestaande immutable SHA-deploymentrunbook; rollback
  gebruikt het vorige gezonde image en voert geen destructieve migratiedowngrade
  uit.
