# S288 — RSS-feed, nieuwsslide en playlist

Read-only productieonderzoek vond drie gezonde RSS-bronnen met ieder dertig
artikelen, maar geen gekoppelde nieuwsslides of handmatige RSS-ontwerpen. De
feeds waren niet verwijderd: de stap van bron naar ontwerp was onvoldoende
vindbaar. Deze wijziging maakt die stap expliciet zonder namens de gebruiker
productiecontent of publicaties aan te maken.

## Gebruik

Open Bronnen, kies de bestaande RSS-feed en klik op **Nieuwsslide maken**. De
gekoppelde wizard selecteert uitsluitend een actieve eigen feed. Een nieuw
ontwerp start met vijf nieuwste artikelen en tien seconden per artikel; de
gebruiker kan één tot twintig artikelen kiezen. De bestaande maximale
ontwerpduur blijft gelden en een te lange ronde blokkeert aanmaken.

Een nog renderend ontwerp blijft met zijn echte status zichtbaar in Content.
Gereedstaande nieuwsslides verschijnen in de playlistmaker onder **Slides →
Nieuws & RSS** en behouden hun eigen snapshot, versie, volledige duur en
geverifieerde offlinevideo. Een feed toevoegen eindigt voortaan op de bron
met de uitleg dat de vervolgstap een nieuwsslide is.

De server valideert de voorgeselecteerde bron tegen de tenant en rechten. Een
hersteld concept en een mogelijk al verwerkte opdracht behouden hun eerdere
bron, request en nonce; een nieuwe deeplink overschrijft die niet.

## Compatibiliteit en database

De nieuwe forwardmigratie valideert een expliciete
`newsSelection.maximumArticles` van 1–20 uitsluitend voor Sync-nieuws. De
canonieke bestaande lezer blijft alle tenant-, bron-, URL- en mediacontroles
uitvoeren. Alleen daarna wordt de bestaande nieuwste-eerstvolgorde begrensd.
Afwezige selectie behoudt de historische volledige selectie, ook in eerder
opgeslagen opdrachtjournals. Bestaande feeds, artikelen, ontwerpen, releases
en snapshots worden niet herschreven. Dezelfde selectie blijft bewerkbaar in
de gekoppelde editor. Nieuwe private helpers hebben geen Data API-executegrant.

De migratie voegt alleen validatie en een snapshotwrapper toe. Een technische
rollback vereist eerst de nieuwe triggers en wrapper terug te nemen en de
vorige buildernaam te herstellen; verwijder nooit opgeslagen configuraties om
terug te rollen. De oude applicatie kan de optionele selectie blijven lezen.
Normale uitrol is forward-only.

## Werkelijke export

Een complete, geïsoleerde lokale Supabase met alle migraties doorloopt de
echte bron→preview→drie ontwerpen→Worker→Storage→playlistketen. De eerste echte
50-secondenexport bereikte de bestaande vijfminutengrens: voor alle 1500 frames
werd ook na de entree opnieuw hetzelfde Chromiumbeeld opgenomen.

De Worker hergebruikt nu uitsluitend stilstaande v9-RSS-pagina's nadat hun
entree en alle werkelijke CSS-animaties zijn voltooid. Oneindige/ongereedgekomen
animaties, bewegende ranglijsten, onbekende of geanimeerde tenantbeelden
behouden de volledige capture per frame. Pagina-, state-, overgangs- en
terugwaartse tijdsprongen blijven expliciet gecontroleerd. Rendereridentiteit,
uitvoerkwaliteit, fps, tijdslimieten en Player zijn ongewijzigd.

De nieuwe echte export heeft 1500 H.264-frames op 1920×1080, 30 fps, yuv420p
en exact 50 seconden. De daadwerkelijke Storage-download is 26.279.953 bytes
en heeft SHA-256
`84f8b7d5d92ddc598d48ebadd618c8a98df5ed99ed0535a61d5c4d78847d9e0d`.
De normale completionguard registreert het ontwerp als gereed. Vervolgens
voegt de echte guarded playlist-RPC die exacte snapshot en video met 50
seconden toe. Vier assertions bevestigen één item en dezelfde provenance.
De playlistproef draait in een rollbacktransactie; alle fixturedata staat
uitsluitend in de taakgebonden lokale database.

Twaalf echte capturemomenten vóór/na het cacheherstel hebben exact dezelfde
SHA-256 van de ruwe RGBA-pixels, inclusief eerdere entreeframes, terugzoeken
en tweede pagina. Het aantal compositorcaptures daalt van twaalf naar negen.
Een aparte native tegenproef met oneindige animatie bewijst dat bewegende
inhoud niet wordt bevroren. Alle twintig native DOM-capturetests zijn groen.

## Interface en verificatie

Visuele controle ontdekte daarnaast dat een stilstaande v9-RSS-miniatuur de
geneste contentanimatie op nul hield. Alleen deze inactieve RSS-preview toont
nu het bestaande voltooide contentframe. De browser bewijst zichtbare
artikeltekst en opaciteit 1 op 390 en 1440 px. Actieve previews en andere
slidefamilies veranderen niet. Een a11y-bevinding is verholpen door puur
visuele, aria-hidden previews ook inert te maken.

- De volledige lokale bron/wizard/playlistbrowsermatrix: 148 groen. Na de
  miniatuurcorrectie zijn de twee RSS-kiezergevallen opnieuw groen, inclusief
  echte artikelopaciteit, eigen font-/assetchecksums, keyboard en axe.
- Nieuwe SQL-suite: 32 assertions, drie bronnen met elk dertig artikelen,
  canonieke preview, nieuwste-eerst, grenzen, drie echte ontwerpen, replay,
  pending Content-zichtbaarheid, foreign-tenant-/viewerweigering en helpers.
- Workspace lint/typecheck/unit is groen: 68/68 Turbotaken, opnieuw na de
  miniatuurcorrectie. Verse lokale reset en de volledige RLS-suite zijn groen:
  139 SQL-bestanden, 4557 assertions. Database-lint op foutniveau is schoon.
  Browser-ESLint en `git diff --check` zijn groen.
- Normale GitHub-CI, staging en productie moeten vervolgens dezelfde exacte
  immutable revisie bevestigen. Fysieke apparaten en de eerder uitgestelde
  accountconfiguratie vallen niet onder dit herstel.

De bewijsbestanden staan onder
`/home/codex/.local/state/veyocast-s288/`, waaronder `browser-final.log`,
`preview-before.log`, `preview-after.log`, `native-all-final.log`,
`rss-real-worker-cache.log`, `rss-uploaded-binary-proof.json`,
`rss-ffprobe.json`, `rss-real-playlist.log` en `raster-before.json`/
`raster-after.json`. Lokale credentials en tijdelijke runtimebestanden blijven
buiten Git. De geïsoleerde database wordt na het exportbewijs opnieuw gereset
voor de volledige SQL-regressies.
