# Google Play internal-testkanaal

## Status

De productionvariant gebruikt package `nl.veyocast.player`, target API 37 en
een Android App Bundle. De handmatige workflow
`.github/workflows/android-tv-play-internal.yml` bouwt een uniek genummerde,
releasegesigneerde AAB, controleert lint en tests, verifieert de JAR-signature,
weigert onverwachte native libraries en publiceert uitsluitend naar track
`internal`.

De workflow werkt bewust alleen vanaf `main`, gebruikt GitHub Environment
`android-tv-internal` en kan nooit stilzwijgend naar production publiceren.

## Eenmalige Play Console-bootstrap

1. Maak in Play Console de app `VeyoCast Player` met standaardtaal Nederlands
   en package `nl.veyocast.player`.
2. Activeer Play App Signing. Laat Google de app-signing key beheren en bewaar
   zelf uitsluitend een afzonderlijke upload key.
3. Upload de eerste gesigneerde production-AAB eenmaal handmatig. De Google Play
   Developer API accepteert een package pas nadat deze in Play Console bestaat.
   Je kunt daarvoor de workflow al uitvoeren: de signed-AAB wordt vóór de
   verwachte eerste API-fout als GitHub-artifact bewaard. Upload dat artifact
   handmatig, voer daarna de workflow opnieuw uit en die nieuwe poging krijgt
   automatisch een hogere version code.
4. Schakel de Google Play Android Developer API in voor het gekozen
   Google Cloud-project.
5. Maak een Workload Identity-pool/provider die uitsluitend OIDC-tokens van
   repository `veyocast/platform`, branch `main` en Environment
   `android-tv-internal` vertrouwt.
6. Maak een serviceaccount zonder algemene projectrollen, laat alleen die
   Workload Identity-provider het account impersoneren en geef het account in
   Play Console uitsluitend apprechten voor VeyoCast Player en internal
   releases. Er is geen downloadbare JSON-key nodig.
7. Maak een interne testlijst van maximaal 100 Google-/Workspace-accounts en
   koppel deze aan het internal-testkanaal.
8. Voeg een feedbackadres toe en deel daarna de opt-inlink met testers.

## GitHub Environment en secrets

Maak GitHub Environment `android-tv-internal` met vereiste reviewers en deze
secrets:

| Secret | Inhoud |
|---|---|
| `ANDROID_TV_UPLOAD_KEYSTORE_BASE64` | base64 zonder regeleinden van de upload-`.jks` |
| `ANDROID_TV_UPLOAD_KEYSTORE_PASSWORD` | wachtwoord van de uploadkeystore |
| `ANDROID_TV_UPLOAD_KEY_ALIAS` | alias van de upload key |
| `ANDROID_TV_UPLOAD_KEY_PASSWORD` | wachtwoord van de upload key |

Voeg daarnaast deze Environment-variabelen toe:

| Variabele | Inhoud |
|---|---|
| `GOOGLE_WORKLOAD_IDENTITY_PROVIDER` | volledige providerresource `projects/.../locations/global/workloadIdentityPools/.../providers/...` |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | e-mailadres van het least-privilege serviceaccount |

Voor Linux kan de keystorewaarde lokaal worden gemaakt met:

```bash
base64 -w 0 veyocast-upload.jks
```

Plak de uitvoer uitsluitend als secret. Log of commit de uitvoer niet. De
Google-authenticatie gebruikt kortlevende OIDC-credentials; maak geen JSON-key
voor het serviceaccount aan.

## Workflow uitvoeren

1. Merge de gereviewde Android TV-wijziging naar `main`.
2. Open GitHub Actions en kies `Android TV Play internal`.
3. Kies `Run workflow` op `main`.
4. Laat de beschermde Environment goedkeuren.
5. Controleer na upload in Play Console de nieuwe versie onder Internal testing.
6. Installeer uitsluitend via de opt-inlink en Google Play op een echt TV-device.

De version code wordt monotonic afgeleid van UTC-uur, workflow-run en poging.
De version name krijgt de vorm `1.0.0-internal.<run>.<attempt>`.

## Store- en reviewmateriaal

- Nederlandstalige listingcopy staat onder `play/listing/nl-NL/`.
- Interne release notes staan onder `play/release-notes/`.
- De reviewerprocedure staat in `play/review-instructions.md`.
- Minimaal één onbewerkte, scherpe screenshot van de echte TV-app moet na de
  fysieke hardwaretest in Play Console worden geplaatst.
- Vul voor closed/production de Data Safety-sectie en een publiek bereikbaar
  privacybeleid in. Een app die uitsluitend op internal testing actief is, is
  volgens Play Console nog vrijgesteld van Data Safety.

## Acceptatie op echte hardware

Controleer vóór uitbreiding naar closed testing:

1. launchericon en 320 x 180-banner op Google TV;
2. volledig landscape zonder afgesneden overscan-content;
3. pairing met alleen D-pad en OK;
4. OK/play-pause en links/rechts tijdens video;
5. eerste BACK opent beheer en tweede BACK gaat naar Android TV Home;
6. video pauzeert op Home en hervat bij terugkeer;
7. apprestart behoudt pairing en lokale release;
8. netwerkverlies blijft last-known-good afspelen en herstelt zonder reload-loop;
9. productiecertificaatfouten worden geweigerd;
10. minimaal één volledige mixed-media-loop en power cycle.

Internal testing ondersteunt maximaal 100 testers en kan al starten voordat de
volledige publieke store listing is afgerond. Closed of production blijft een
afzonderlijke releasebeslissing en is niet door deze workflow geautoriseerd.

## Officiële referenties

- [Android TV app quality](https://developer.android.com/docs/quality-guidelines/tv-app-quality)
- [Google Play internal testing](https://support.google.com/googleplay/android-developer/answer/9845334)
- [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
- [Google Workload Identity voor GitHub Actions](https://github.com/google-github-actions/auth#workload-identity-federation)
- [Google Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469)
