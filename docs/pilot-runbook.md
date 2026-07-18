# Lokale pilotrunbook

## Doel en grens

Dit runbook valideert één echte lokale Castivo-keten:

1. een tenantbeheerder meldt zich aan via Supabase Auth;
2. Control verifieert afbeeldingen synchroon en uploadt MP4 via signed private storage;
3. Control maakt een conceptplaylist en een immutable release;
4. de Player maakt zelf een tijdelijk device-token en koppelcode;
5. Control claimt alleen de code en wijst de Player aan een scherm toe;
6. de Player haalt een signed manifest op, downloadt en verifieert alle assets;
7. activering gebeurt atomair en de Player rapporteert heartbeatstatus.

De playbackpilot blijft afbeeldinggebaseerd. Signed MP4-upload en queueing zijn
wel aangesloten; een echte FFmpeg-outputrun, productieprovisioning en de
24-uurs mixed-media soak zijn niet afgedekt. Gebruik geen klantmedia,
persoonsgegevens of productiecredentials.

## Doelomgeving

- Chrome of Edge op een Windows- of Linux mini-pc.
- Node 24, pnpm 11, Docker en Supabase CLI.
- Een eigen browserprofiel voor de Player.
- Lokale poorten: Control 3000, Player 3001, Marketing 3002 en Supabase 54321.

FFmpeg is niet nodig voor de afbeelding-playbackroute of een upload/queue-smoke.
FFmpeg en ffprobe 6 of nieuwer zijn verplicht voordat MP4 als operationele
workflow wordt getest. Zie `docs/media-worker-runbook.md`.

## Voorbereiden

Voer vanuit de repository-root uit:

    pnpm install --frozen-lockfile
    pnpm db:start
    pnpm db:reset
    pnpm test:rls
    pnpm exec supabase status

Neem de lokale API URL, anon-key en service-role key uit de status over als
procesvariabelen in ieder venster waarin Control of Player wordt gestart.
Commit deze nooit. De service-role key mag nooit een NEXT_PUBLIC_-prefix hebben.

    $env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
    $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "<lokale anon-key>"
    $env:SUPABASE_SERVICE_ROLE_KEY = "<lokale service-role key>"

Start daarna de applicaties in aparte vensters:

    pnpm --filter @castivo/control exec next dev --port 3000 --hostname 127.0.0.1
    pnpm --filter @castivo/player exec next dev --port 3001 --hostname 127.0.0.1
    pnpm --filter @castivo/marketing exec next dev --port 3002 --hostname 127.0.0.1

Wanneer Auth direct na een lokale reset tijdelijk via Kong een 502 geeft, wacht
eerst op gezonde containers. Herstart zo nodig alleen de lokale gateway; pas
geen policies of credentials als workaround aan.

## Live pilotroute

1. Open http://127.0.0.1:3000/login.
2. Meld lokaal aan met pilot-admin@castivo.test en wachtwoord castivo-local.
3. Open Pilotflow. De status moet Live Supabase tonen.
4. Upload een PNG, JPEG of WebP van maximaal 20 MB. Control controleert magic
   bytes, MIME-type, tenantpad en SHA-256 voordat de media Gereed wordt.
   Optioneel kan een MP4 van maximaal 500 MB via signed upload worden gequeued;
   gebruik die pas in een playlist nadat een echte worker de status Gereed heeft gemaakt.
5. Maak met de gereedstaande afbeelding een conceptplaylist.
6. Publiceer het concept naar Pilot hoofdscherm. De release is immutable en
   wordt atomair als gewenste release toegewezen.
7. Open http://127.0.0.1:3001 in een schoon Player-profiel. Wacht tijdens
   Koppelcode maken op de tijdelijke code.
8. Neem de zes tekens over in Control en koppel aan Pilot hoofdscherm. Het
   geheime token blijft alleen in Player-localStorage.
9. De Player haalt signed private-storage-URLs op en controleert bytes en
   checksum. Pas daarna verschijnt PLAYING.
10. Herlaad Pilotflow. De Player toont Gekoppeld, gewenste en actieve release
    en een bijgewerkte laatst-gezienwaarde.
11. Schakel netwerk tijdelijk uit en vernieuw de Player. Een geldige lokale
    release blijft als OFFLINE_PLAYING zichtbaar.

De bestaande demopaden blijven beschikbaar zonder Supabasevariabelen.
demo-online en CTV 482 zijn dan uitsluitend testfixtures.

## Geautomatiseerde bewijslast

Reguliere gates:

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build
    pnpm test:rls
    pnpm test:a11y
    pnpm test:player
    pnpm test:e2e -- --project=chromium

De echte browserketen is opt-in en gebruikt de lokale procesvariabelen:

    $env:CASTIVO_LIVE_PILOT = "1"
    pnpm exec playwright test tests/e2e/live-pilot.spec.ts --project=chromium
    Remove-Item Env:CASTIVO_LIVE_PILOT

Deze test doorloopt login, upload, concept, publicatie, pairing, signed manifest,
verified playback en zichtbare device-status.

## Stopcriteria

- Stop wanneer database-reset of RLS-tests falen.
- Stop wanneer een pending release vóór volledige verificatie activeert.
- Stop wanneer offline playback een geldige last-known-good release verliest.
- Stop wanneer een service-role key in browsercode, logging of bewijs belandt.
- Gebruik MP4 niet in een pilotrelease voordat de echte FFmpeg-run en de
  mixed-media matrix groen zijn.

## Bewijs vastleggen

Noteer datum, commit, browserversie, Player-target, gate-uitkomsten en
afwijkingen. Leg nooit device-tokens, credentials, signed URLs of klantmedia vast.
