# S14-B mediaworkerbewijs

Uitgevoerd op 2026-07-18 vanuit `castivo/s14-media-worker-daemon`.

## Bewezen

- authenticated tenanteditor maakt een signed, tenantgebonden MP4-upload;
- de browser uploadt rechtstreeks naar private Storage, niet via Next-geheugen;
- databasefinalisatie controleert exact pad, MIME-type en bytegrootte;
- herhaalde finalisatie maakt geen dubbele job;
- anon en authenticated gebruikers kunnen worker-RPC's niet uitvoeren;
- de service role claimt de oudste job met lock en pogingnummer;
- bron en variant worden streamend verwerkt en met SHA-256 gecontroleerd;
- alleen een volledig geregistreerde original- en playervariant maakt het asset ready;
- transient en definitieve fouten volgen begrensde queue-/failuretransities;
- de echte lokale worker claimde en downloadde de browserjob en registreerde bij
  ontbrekende ffprobe veilig `retry_scheduled`;
- de live Chromium-keten bleef na videoqueueing groen voor afbeeldingupload,
  immutable publicatie, pairing, signed download en playback;
- de Player-CSP staat in development uitsluitend de gevalideerde lokale
  Supabase-origin toe, waardoor signed assetdownloads niet meer worden geblokkeerd.

## Gates tijdens implementatie

- database-reset plus 32 gerichte worker/upload-pgTAP-tests: groen;
- volledige RLS-suite: 118 tests groen;
- mediaworker: 20 unit tests, lint, typecheck en build: groen;
- Control lint en typecheck: groen;
- gerichte Media-a11y-test: groen;
- Player online/CSP: 3 Chromium-tests groen;
- opt-in live pilot met signed MP4-upload tot queue: groen.
- volledige a11y-suite: 8 Chromium-tests groen;
- volledige player-suite: 19 Chromium-tests groen;
- afzonderlijke offline-suite: 7 Chromium-tests groen;
- volledige e2e-suite: 32 groen en 1 opt-in live test regulier overgeslagen.

De finale repo-brede gate-uitkomsten staan in de taskhandoff en commitstatus.

## Bewuste grens

FFmpeg en ffprobe waren niet geïnstalleerd. Er is daarom nog geen echte
gegenereerde `player_1080p`-variant bewezen. Ook daemonhosting, metrics/alerts,
fysieke LG-playback en de 24-uurs mixed-media soak vallen buiten dit bewijs.
Zonder die gates is MP4 nog geen productie- of LG-supportclaim.
