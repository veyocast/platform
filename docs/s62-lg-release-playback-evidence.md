# S62 — LG release-activatie en staande mediapreview

> Correctie na fysieke vervolgtest: de object-URL uit S62 bleek geschikt voor
> afbeeldingen, maar niet als primaire MP4-transportlaag op de 43UL3J-EP.
> S63 gebruikt voor video native HTTPS-range-streaming en houdt de
> geverifieerde object-URL uitsluitend als offline/foutfallback. Zie
> `docs/s63-media-playback-hotfix-evidence.md`.

## Aanleiding en fysiek bewijs

Op 30 juli 2026 was de LG 43UL3J-EP succesvol gekoppeld en stond de Player op
**Wachten op content**. Na het toewijzen van een release verscheen kort
**Koppelcode maken**, daarna:

```text
Foutcode: PLAYER_CLIENT_EXCEPTION
Diagnose: PLAYER_RUNTIME_ERROR
```

Vervolgens bleef een wit scherm over. De release-activatie, en niet pairing of
internetbereik, was daarmee de nieuwe foutgrens. De Player-versie op het
fysieke bewijs was `dcd3e094`.

Een afzonderlijk Control-bewijs liet een videobestand met gevalideerde
dimensies `1080 × 1920` in de iteminstellingen binnen een vaste liggende
preview zien.

## Oorzaak en risicoketen

De LG-route speelde geverifieerde cachemedia af via een interne URL die door de
serviceworker werd afgehandeld. De media-engine van webOS kan videorequests,
waaronder byte-rangeverzoeken, buiten de documentgestuurde
serviceworkerketen uitvoeren. De UI promoveerde daarnaast iedere globale
`error`-event — ook een beheerde `<video>`-fout — tot een fatale
clientexception. Die fallback verving de volledige `body`, waardoor ook een
geldige gekoppelde runtime en last-known-goodweergave verdwenen.

De exacte interne LG-mediastack levert zonder apparaatlogs geen stacktrace.
De transportverklaring is daarom een onderbouwde platforminference. Zij sluit
aan op de officiële webenginegrens: webOS TV 6.x gebruikt Chromium 79. De
oplossing is niet afhankelijk van één specifieke codec- of fouttekst.

De Control-preview had een vaste liggende hoogte/breedte en gebruikte de
opgeslagen mediavariant niet als geometriebron. De video zelf werd niet
geroteerd; alleen de beheerpreview vervormde de presentatie.

## Reparatie

- `/lg` en herkenbare LG/webOS-engines maken een tijdelijke object-URL van de
  reeds gedownloade en checksum-gevalideerde cachebytes.
- Generieke browsers met een actieve serviceworker behouden de bestaande
  interne range-URL.
- Object-URL's worden met de bestaande release-cleanup weer ingetrokken.
- Audio-, afbeelding-, source-, track- en video-events blijven in de lokale
  playback-recovery en openen geen fatale clientfallback.
- Imperatieve `pause`, seek en volume-operaties zijn defensief afgeschermd
  tegen uitzonderingen uit oude embedded mediastacks.
- Een echte onverwachte clientexception wordt als overlay getoond. De
  onderliggende React-DOM, koppeling en last-known-goodrelease worden niet
  verwijderd.
- Runtimefase en Playerstate komen in de lokale begrensde diagnosebuffer. Een
  latere netwerkdiagnose mag dit crashrecord niet meer wegfilteren.
- De losse serviceworker bevat geen nullish-coalescing meer. Chromium 79 kon
  de eerdere `sw.js` daardoor niet parsen; de productionbuild controleert nu
  zowel Next-clientchunks als deze standalone browserfile.
- De Playlist Studio gebruikt de gevalideerde breedte en hoogte voor
  `aspect-ratio`, `object-fit: contain`, een staande inspectorhoogte en het
  zichtbare label `1080 × 1920 · Staand`.

## Geautomatiseerde verificatie

De regressies bewijzen specifiek:

- `/lg` kiest bij een serviceworker toch een object-URL;
- een generieke browser met serviceworker behoudt de interne media-URL;
- zonder serviceworker valt playback veilig terug op een object-URL;
- een wachtende gekoppelde Player activeert een nieuwe release zonder reload,
  toont de eerste asset via `blob:` en bereikt `PLAYING`;
- een synthetische videofout vernietigt de Player niet;
- een echte clientexception toont de lokale VeyoCast-overlay, laat de
  gekoppelde UI bestaan en bewaart categorie, fase en Playerstate;
- `1080 × 1920` wordt als `portrait`/`Staand` geclassificeerd;
- ontbrekende dimensies hebben een veilige onbekende fallback.

Daarnaast wordt de productionbuild met de bestaande webOS 6-syntaxguard
gecontroleerd. Chromium 79 is als afzonderlijke legacy-browsergrens gebruikt.

## Fysieke heracceptatie

Na deployment:

1. laat de bestaande koppeling en URL `https://player.veyocast.nl/lg` staan;
2. publiceer of wijs een release met de betreffende MP4 toe;
3. verwacht dat **Wachten op content** zonder pairingstap overgaat in beeld;
4. controleer minimaal één volledige videoloop;
5. controleer dat geen `PLAYER_CLIENT_EXCEPTION`, `PLAYER_RUNTIME_ERROR`,
   nieuw pairingscherm of wit scherm verschijnt;
6. herstart het display en controleer opnieuw dezelfde koppeling en release.

De code- en browsergrenzen zijn geautomatiseerd toetsbaar. De laatste
hardwareacceptatie blijft uitsluitend op de fysieke 43UL3J-EP met firmware
03.24.90 af te tekenen.
