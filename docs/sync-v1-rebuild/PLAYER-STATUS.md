# Sync Player-statusschermen — S230

De echte Player gebruikt voor starten, koppelen, eerste download, verificatie,
wachten op content, herstel en offline zonder cache de gekozen Sync Source.
De ongewijzigde referentie is commit `8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a`,
`Players.tsx`/`players.css`. De locked hero, woordmerk, Manrope/Inter en de
Lucidepadgeometrie worden rechtstreeks hergebruikt. Er is geen nieuwe dependency.

## Aansluiting op de echte runtime

`SyncPlayerStatus` is uitsluitend de presentatie van bestaande runtimefeiten.
De eerste cachecallbacks `DOWNLOADING` en `VERIFYING` worden zichtbaar terwijl
nog geen afspeelbare release bestaat. Bij een geldige actieve release blijft
`PlaybackView` leidend, ook tijdens een volgende download/verificatie. De
mediaopslag, hashcontrole, switchgrens, eerste-frame-ACK, immutable releases,
device-identiteit en bestaande cacheherstelpaden zijn niet veranderd.
`player-cache.ts` blijft ongewijzigd.

Landscape behoudt de Source-hero op 55% breedte, inhoud op left 57%/right 5% en
H1 op 3.15cqw. Portrait behoudt herohoogte 51%, inhoud left/right 10%/top 51% en
H1 op 6.3cqw. De bestaande fysieke viewportoriëntatie vervangt uitsluitend de
Source-demoknop die een portraitklasse schakelde. De bestaande codekaart,
voortgangsruimte, footer en secundaire herstelgegevens blijven binnen het canvas.

## Feitelijke vervanging van demobediening

- De code komt uitsluitend uit de bestaande pairingresponse of opgeslagen,
  nog geldige pairingsessie. Er is geen hardcoded code in de presenter.
- De Source-autokoppelknop is de echte, toetsenbordbedienbare `QR-code tonen`-
  knop. Het QR-venster gebruikt het bestaande tijdelijke QR-endpoint; Escape
  sluit het en herstelt de focus. De bestaande runtime bepaalt expiry/rotatie; de presentatie voegt geen tweede
  lokale klokbeslissing toe. PostgreSQL-timestamps gebruiken de bestaande
  normalisatie, ook op Chrome79.
- De cache rapporteert geen betrouwbare bytes/totaalbestanden. Download en
  verificatie gebruiken daarom de Source-voortgangsruimte met onbepaalde status,
  zonder getal, `aria-valuenow` of verzonnen voltooide stappen.
- Eerste verificatie belooft geen vorige publicatie die nog niet bestaat.
  Hersteltekst komt uit de bestaande oorzaak/gevolg/herstelgegevens; de details
  zijn expliciet te openen. READY biedt geen demoactie die een binding maakt.
- Gezonde playback krijgt geen nieuw statusoverlay, hoofdmenu of softwaremerk.
  De bestaande toegestane lock-up en diagnostiek blijven behouden.

## Afwijkende feiten per Source-toestand

| Toestand | Overname en precieze feitelijke vervanging |
| --- | --- |
| Boot | Source-kop en body letterlijk; footer geeft het echte opstarten aan. |
| Pairing | Source-kop/body/codekaart; uitsluitend echte code/expiry. Autopairdemoknop wordt QR-venster; footer gebruikt apparaat/verbinding/geldigheidsduur. |
| Download | Source-kop/body en voortgangsruimte; verzonnen percent/bestandenteller en voltooide checkmarks worden onbepaalde werkelijke voorbereiding. |
| Verify | Source-kop letterlijk. Body belooft veilige voorbereiding in plaats van een vorige publicatie die bij deze eerste activatie ontbreekt. |
| No-content | Source-kop/body letterlijk. Geen knop die alleen een Source-demopaneel sluit; het gekoppelde device wacht werkelijk op een toewijzing. |
| Offline-empty | Source-kop/body letterlijk; herstelknop gebruikt bestaande retry, geen gesimuleerde netwerkverbinding. |
| Error | Source-eyebrow/hiërarchie. Credentialfout: `Player opnieuw koppelen`; APIfout: `VeyoCast API tijdelijk niet bereikbaar`; pairingdienst: `Koppelservice tijdelijk niet beschikbaar`; overige fouten: `Playback wacht`. Dit zijn geen bewezen bestandsfouten, dus geen onjuiste Source-kop `Dit bestand kon niet starten.` of belofte van een vorige publicatie/stilstaand alternatief. Bestaande oorzaak/gevolg/herstel blijven beschikbaar. |
| Recovery | Source-kop letterlijk, maar body is de echte retry-oorzaak; zonder LKG wordt geen beschikbare vorige inhoud beloofd. Geen extra publiek transportdiagnostiekpaneel. |
| Pairing-expired | Source-kop letterlijk; `democode` wordt `koppelcode`. De bestaande runtime bepaalt het verval, niet een extra presentatietimer. |
| Disabled | Echte `DISABLED` wordt `PLAYER GEPAUZEERD`/`Even rust op het scherm.` met bestaande foutfeiten. Het is geen Source-businesshoursdemo en biedt geen demo-activatie. |

Deze feitelijke afwijkingen zijn vóór afronding expliciet door root geaccepteerd.
Een geldige actieve release blijft altijd in de bestaande playbackvertakking;
deze fout-/herstelschermen bedekken geen gezonde LKG.

## Bewijsgrens

De gerichte browserproef houdt een echte assetresponse en SHA-verificatie vast,
controleert de zichtbare eerste fasen vóór activatie en controleert vervolgens
gezonde LKG tijdens een nieuwe download. Bestaande pairing-, videohandoff-,
credential-, READY-, offline- en landmarkproeven blijven van toepassing.
De afzonderlijke Chrome79-veilige LG-presentatie en bijbehorende gerichte
proeven zijn door de toegewezen LG-writer aangepast.

Dit is lokale software-/browseracceptatie. Fysieke LG-/Android-/TV-upgrades en
24-uurs playback blijven door de gebruiker uitgesteld. De bestaande publieke
healthcheck wordt niet vervangen door deze fixture-runtime. De finale exacte
CI- en uitrolresultaten worden door root vastgelegd; deze pagina claimt geen
uitrol of algemene pixelgelijkheid vóór de afzonderlijke Sourcevergelijking.
