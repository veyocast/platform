# S30 Player playbackcorrectheid

## Scope

Deze correctie maakt de immutable itemduur leidend voor normale playback en
verwijdert publieke playbackmetadata. De door merkeigenaar Danny Goldenbelt
expliciet goedgekeurde vaste system mark gebruikt de byte-ongewijzigde inverse
VeyoCast-lock-up linksonder op exact 60% opacity.

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

## Regressiebewijs

- Browsertest: drie video-items blijven in gepubliceerde volgorde en een vroeg
  `ended` verkort het eerste of tweede slot niet.
- Watchdogtest: een werkelijk stalled of niet-decodeerbaar item behoudt de
  bestaande retry/skip-herstelroute.
- UI-test: de metadata-overlay bestaat niet en de locked system mark is zichtbaar
  met computed opacity `0.6`.

Fysieke LG-validatie en de 24-uurs mixed-media-soak blijven onderdeel van de
S30 release-candidategate.
