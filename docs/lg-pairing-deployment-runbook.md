# LG-koppelklaar deploymentrunbook

De oorspronkelijke single-environment Docker/Caddy-kit is ingetrokken. Gebruik
voor VPS-deployment uitsluitend `docs/deployment/vps-deployment.md`; Caddy draait
op de host en production herbouwt geen images.

Na een groene stagingdeployment:

1. controleer Control-login, upload, playlistpublicatie en pairing op staging;
2. open `https://staging-player.veyocast.nl` op het doelmodel;
3. koppel het scherm via de normale Schermenroute;
4. publiceer een kleine mixed-media release en bewijs last-known-good playback;
5. voer `docs/player/lg-physical-test-protocol.md` volledig uit;
6. keur production pas daarna goed via het GitHub Environment.

Een geslaagde webdeployment is geen bewijs voor alle LG-modellen of firmwares.
Fysieke validatie en de 24-uurs mixed-media soak blijven launchgates.
