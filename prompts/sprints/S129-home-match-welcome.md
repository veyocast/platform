# S129 — Thuiswedstrijdgebonden bezoekerswelkomstscherm

## Doel

Toon op `sport_visitor_arrivals` uitsluitend bezoekende ploegen voor wedstrijden
waar de gekoppelde vereniging thuis speelt. Laat één tot vier wedstrijden het
volledige landscape- of portraitcanvas benutten en toon, indien rechtmatig en
eenduidig beschikbaar, het uitteamlogo in kaart en achtergrond.

## Ownership

- Sportlink Programma-mapper en bestaande worker;
- immutable sportmatch- en dynamische snapshotgrens;
- gedeelde Editorial Arena-renderer, thumbnailworker en LG Legacy-adapter;
- S129-migratie/RLS-test, Playertests, goldens en documentatie.

## Gates

Verse database-reset en volledige RLS, workspace lint/typecheck/test/build,
Control a11y/E2E, Player/offline, LG Legacy en de vaste 1–4 landscape- plus
portraitgeometriematrix.

## Productgrenzen

`teamvolgorde` is de enige providerwaarheid voor thuis/uit. `eigenteam` is geen
thuisindicator. Geen scraping, Voetbal.nl-automatisering of nieuwe logo-endpoint-
aanname. Provider-URL's en credentials bereiken browser of Player nooit;
offline output gebruikt uitsluitend immutable, geverifieerde assets.
