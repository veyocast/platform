# Benodigdheden na technische pilotoplevering

De Vector-pilot werkt zonder fictieve tenantinhoud. Onderstaande input maakt de
lege, veilige toestanden inhoudelijk compleet; ze blokkeert de technische rollout
niet tenzij expliciet genoemd.

## Door de vereniging aan te leveren

- definitieve venuenaam en een korte locatie-aanduiding;
- een actuele plattegrond als PNG/JPEG/WebP, plus de gewenste zones;
- bevestiging welk bestaand scherm in welke zone staat;
- ontbrekende club-, team-, sponsor- en campagnebeelden in bruikbare resolutie;
- voor Engage: campagnenaam, vraag, antwoordopties, looptijd en publicatiemoment;
- voor iedere online-only YouTube-slide een lokale fallback uit de Media Library.

## Externe configuratie of besluitvorming

- een goedgekeurd Google Cloud-project en server-side YouTube Data API-key
  voordat `youtube_integration` apart wordt geactiveerd;
- live Mollie-credentials, juridische/fiscale goedkeuring en cohortbesluit voor
  inning of Player-enforcement; billing blijft terecht in shadow/default-off;
- productie-e-mailprovider en afzendergoedkeuring voor echte billing- en
  operationele notificaties;
- toestemming en bronvastlegging vóór klantlogo's, testimonials of
  marketingbewijs worden gepubliceerd.

## Fysieke acceptatie

- één LG webOS-scherm en één Android/Google TV-apparaat voor pairing, koude
  start, D-pad, portrait/landscape en last-known-good-test;
- een aaneengesloten 24-uurs pilotsoak met monitoring van Control-, worker-,
  snapshot-, release- en Playerfouten;
- eigenaar die de pilot na de soak expliciet accepteert of de tenant-kill-switch
  laat uitvoeren.
