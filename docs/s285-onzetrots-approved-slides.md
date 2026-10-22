# S285 — goedgekeurde OnzeTrots-collectie

De 36 goedgekeurde families gebruiken één gedeelde React-compositie in de
actieve Control-preview, Worker en Player. Nieuw profiel: `sync-onzetrots-v1`,
bron `ae83f2b4312408eacae9f29177d3c743e104185b`. Branchbaseline en actuele main:
`3bbb51ac006bbaf8381a11d5dcfd7024d13d3876`; main is niet teruggezet.
Ownership staat in het [sprintprompt](../prompts/sprints/S285-onzetrots-approved-slides.md).

## Implementatie en compatibiliteit

- Het oorspronkelijke pakket blijft ongewijzigd onder `docs/design/onzetrots-slides/`.
  De generator kopieert 254 originele assets byte-identiek en maakt scoped CSS.
  Zes lokale fontfaces behouden de oorspronkelijke rollen; OnzeTrots blijft artwork.
- Het nieuwe rich contract bewaart nullable statistieken/vorm, stabiele team- en
  clubidentiteiten, kickoff/status/kleedkamers, leeftijden en verified afbeeldingen.
  Geen providercalls in rendercode of gereconstrueerde feiten uit punten/strings.
- Bezoekers vereisen zowel gecontroleerde eigen thuisclub als eigen team.
  Filtering gebeurt vóór sortering en limiet. Alleen de nieuwe versie koppelt
  `welcome` expliciet aan Sportlink-bezoekers.
- Matchday combineert drie snapshots met dezelfde tenant/team/poule/seizoencontext
  en afzonderlijke revisies. De compositie toont drie recente uitslagen, de
  volledige stand en drie komende wedstrijden. Losse programma-/uitslagfamilies
  behouden vervolgpaginering.
- Eén fysieke blauwe eigen rij blijft in de volledige doorlopende stand zichtbaar.
  Preview, Player en ieder exportframe delen pure elapsed-/layoutprojectie,
  inclusief pauze, verborgen tabblad en reduced motion. Veertien rijen vragen
  standaard liggend 38 seconden. Picker, publicatie en fallback bewaken deze
  werkelijke minimumduur. Binnenkomst uitzetten knipt de interne cyclus niet af.
- Verjaardagen, activiteiten en agenda behouden zes vaste plekken in beide
  formaten en vervolgpaginering. Handmatige kaartvelden bewaren expliciete
  leeftijden en optionele verified afbeeldingen. Nieuwe documenten krijgen geen
  voorbeeldpersonen, wedstrijden of prijzen. De 36 displayfixtures staan apart.
- De Worker behoudt CSP, checksum-/decodegrenzen en native uitvoer. Bewegende
  scènes gebruiken lossless snelle Chromium-PNG-compressie per frame; de
  decodevergelijking met normale PNG is pixel-identiek. De sessie blijft binnen
  hetzelfde encodermaximum van 300 seconden.
- Nieuwe fonts/artwork en geneste afbeeldingen vallen onder manifest- en
  offlinechecks. Capabilityonderhandeling geeft oudere WebViews de volledige
  MP4. Een corrupt pending asset vervangt de actieve release niet.
- Oude Sync-v1, FieldFlow en Sites-v11/v17 behouden oorspronkelijke identiteiten,
  decoders en fixtures. Eén forwardmigratie voegt nieuwe validatie/projectie toe;
  historische migraties worden niet herschreven. Schema-/CSS-/assetgeneratie
  reproduceert exact de huidige bytes. Applicatierollback vereist geen
  dataverwijdering; bestaande nieuwe releases houden hun complete binary fallback.

## Beeld- en motionbewijs

De [bewijsmap](implementation/s285-onzetrots/README.md) bevat acht contactbladen
voor 144 echte Worker-renders naast 144 bronbeelden, zes native vergelijkingsparen,
SHA-256 per beeld en exportmetadata. Native maten zijn 1920×1080 of 1080×1920;
logische schaal 1,2, elapsed 1200 ms. Beide gebruiken dezelfde volledige Chromium
met alle zes oorspronkelijke fontfaces. Headless Shell gaf andere teksthinting
én regelafbreking en is daarom geen gemengde vergelijkingsbasis. Geen maskers of
verruimde visuele passdrempels; ruwe pixeldifferenties blijven diagnostiek naast
geometrie en gedrag.

De echte canonieke export bevat 1.140 frames, 38.000 ms en 1920×1080, SHA-256
`50cfd379c136df3d36d3ae87f8487905e4fe495018035974e568132a4c4c80e8`.
Op de gekoppelde Player-route komen gedecodeerde frames op 1,2/9/20/37 seconden
op hun werkelijk gepresenteerde mediaTime overeen met de blauwe DOM-rij.
De native H.264-randcontrole blijft twee pixels. Dezelfde test bewijst koude
serviceworker-/offline-start, last-known-good na een corrupte achtergrond en
volledige lokale video met EOF-herstart voor het oudere capabilityprofiel.

## Gates en release

- Volledige lint/typecheck/unitcohort: groen, 30/30 taken. Player: 521 unittests;
  Control: 1.839. Bestaande opt-in-browserfixtures blijven aparte browsergates.
- Nieuwe Player-acceptatie: 27/27 groen, waaronder vaste slots 0–6, zevende record,
  eigen rij eerste/midden/laatste, welkom 0–4 en fasen boven score.
- Wizard en bestaande editor: 19 plus 27 cases groen. Extra echte kaartinvoer-,
  pagina- en pauzetests: 5/5 groen. Gekoppelde export/offline/fallback: 1/1 groen.
- Geïsoleerde database: de laatste volledige rerun is groen, 137 bestanden en
  4.485 assertions, inclusief 31 nieuwe versie-/selectie-/scopecontroles.
  Database-lint meldt alleen bestaande waarschuwingen in oudere functies,
  geen nieuwe functieproblemen. Alleen de eigen teststack is gestart/gestopt;
  bestaande staging-/productie-/andere lokale databases zijn niet gereset.
- Player-build groen; laatste Control-build, complete browser-/a11y-/offlinecohort
  en herbevestiging na de laatste voetregelcorrectie lopen nog. Ledger blijft
  `in_progress` totdat deze gates en de concrete PR zijn afgehandeld.

Staging volgt de bestaande immutable main-pipeline. Deze taak dispatcht geen
zelfstandige productiepromotie. Fysieke apparaat-/24-uursproeven en eerder
uitgestelde accountconfiguraties worden niet als uitgevoerd gerapporteerd.
