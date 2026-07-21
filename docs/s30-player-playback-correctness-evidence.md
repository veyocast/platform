# S30 Player playbackcorrectheid

## Scope

Deze correctie maakt de immutable itemduur leidend voor normale playback en
verwijdert publieke playbackmetadata. De door merkeigenaar Danny Goldenbelt
expliciet goedgekeurde vaste system mark gebruikt de byte-ongewijzigde inverse
VeyoCast-lock-up linksonder op exact 40% opacity.

## Oorzaak en herstel

- De zichtbare schermnaam, mediatitel en playlistnaam kwamen uit de lokale
  `.playback-now`-overlay. Die overlay en de bijbehorende scrim zijn verwijderd;
  operationele waarden blijven uitsluitend in het verborgen diagnostieklandmark.
- Een native video-`ended` activeerde direct het volgende item en kon daarmee de
  gepubliceerde itemduur verkorten. Een vroeg `ended` houdt nu het laatste frame
  vast; de release-timer wisselt pas op de immutable slotgrens.
- De release-timer was afhankelijk van het volledige runtimeobject. Heartbeat-
  en manifestsyncstate kunnen hem niet meer opnieuw starten; alleen release,
  item, duur of een begrensde herstelpoging plannen hem opnieuw.
- `durationMs` is voortaan development-only en kan staging- of
  productionplayback niet versnellen.
- Een afwezige `watchdogMs` werd eerder door `Number(null)` als nul gelezen en
  daarna naar 250 ms begrensd. De parser onderscheidt afwezig, leeg en ongeldig
  nu expliciet, gebruikt standaard 12 seconden en negeert alle timingknoppen in
  production.
- Een tijdelijke watchdogfout bleef na geslaagde retry/skip en hervatte media
  voor altijd in `lastPlaybackError` staan. Iedere heartbeat vernieuwde daardoor
  dezelfde kritieke Control-melding, ook wanneer playback al gezond was. Media-
  readiness markeert de fout nu als hersteld; de eerstvolgende geaccepteerde
  heartbeat wist de actuele foutstatus, bewaart begrensd herstelbewijs in het
  syncevent en stuurt één seconde later een expliciete foutloze bevestiging.
- Een geweigerde heartbeat geldt niet langer als succesvolle verbinding en wist
  geen lokaal foutbewijs; alleen een HTTP-succes mag de herstelstatus afronden.

## Regressiebewijs

- Browsertest: drie video-items blijven in gepubliceerde volgorde en een vroeg
  `ended` verkort het eerste of tweede slot niet.
- Watchdogtest: een werkelijk stalled of niet-decodeerbaar item behoudt de
  bestaande retry/skip-herstelroute.
- Watchdogtest: een gezonde video blijft zonder testoverride minimaal 1,5 seconde
  hetzelfde DOM-mediaelement en krijgt geen foutstatus.
- Watchdog-/contracttest: een werkelijk actieve `VIDEO_START_TIMEOUT` blijft
  zichtbaar, een hervatte fallback rapporteert `recoveredAt`, en een volgende
  heartbeat stuurt `lastPlaybackError: null` terwijl het geredigeerde herstel in
  de synctijdlijn behouden blijft.
- UI-test: de metadata-overlay bestaat niet en de locked system mark is zichtbaar
  met computed opacity `0.4`.

Fysieke LG-validatie en de 24-uurs mixed-media-soak blijven onderdeel van de
S30 release-candidategate.
