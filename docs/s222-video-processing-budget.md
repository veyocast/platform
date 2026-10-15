# S222 — MP4-verwerking na geslaagde upload

De twee opgeslagen DartsPoint-videopogingen zijn volledig geüpload, maar hebben
`validation_failed / processing_timeout`: de FFmpeg-opdracht is afgebroken nadat
het vaste budget van 40 seconden verstreek. Beide jobs stopten ongeveer
44 seconden na de start. Private Storage accepteert MP4 en de bestandsgrootte
van 40.804.043 bytes valt binnen de bestaande grens van 500 MiB. De bronmetadata
is nog niet met FFprobe geïnspecteerd; specifieke codecs of complexiteit van dit
bestand worden daarom niet als bewezen oorzaak opgevoerd.

Transcodes krijgen nu minimaal 120 seconden, drie keer de veilig geprobed
bronduur plus 30 seconden, tot een maximum van tien minuten. Remux, probes en
posters houden het bestaande korte budget. Decoder-, filter- en encoderthreads
worden op twee begrensd binnen de bestaande workerlimieten van 1,5 CPU en
1536 MiB. Kwaliteitspreset, bitrategrens en Playeroutput veranderen niet.

De gedeployde algemene workerlease is slechts 60 seconden. Daarom claimt alleen
de mediajobrunner voortaan minimaal vijftien minuten; anders kan een tweede
worker de geldige langlopende transcode overnemen. Een expliciet langere lease
blijft geldig. Andere queues houden hun bestaande korte herstelinterval.
De marge boven de maximale transcode dekt de begrensde bronoverdracht, twee
probes, poster, twee uploads en completion. Een harde timeout blijft definitief
falen, zonder automatische herhaalstorm of ongeverifieerde ready-status.

De bibliotheek meldt dat de bron al is opgeslagen en verwijst naar de bestaande
geautoriseerde actie ‘Verwerking opnieuw proberen’. Upload, tenantrechten,
Storage RLS, checksumcontrole, transactionele ready-overgang en publicatie blijven
ongewijzigd. Bestaande releases worden niet gewijzigd of opnieuw gepubliceerd.

Regressies controleren een transcode die pas na 45 seconden klaar is, de
duurafhankelijke bovengrens, korte remux, daadwerkelijke subprocessbeëindiging en
een mediajobclaim met een algemene lease van 60 seconden. De twee hoofdregressies
zijn vóór de fix aantoonbaar rood. De echte FFmpeg-proef genereert uitsluitend
lokale synthetische portraitvideo, leest deze op realtime tempo, normaliseert
voorbij de oude 40 seconden, controleert het volledige outputcontract en maakt
een niet-lege poster. De inputvertraging maakt deze proef reproduceerbaar op
snelle ontwikkelhardware; dit is geen inspectie van de productiebron.

Lokale validatie:

- Workspace lint, typecheck en unit: ieder 30/30 taken groen.
- Worker: 340 PASS en 318 bestaande conditionele SKIP; de aparte bron-/renderer-
  matrices lopen verder in de bestaande CI. Een eerste volledige lokale run
  raakte tijdens de FFmpeg-proef een bestaande millisecondegevoelige optionele
  Sportlink-logo-test; een afzonderlijke volledige workerherhaling en daarna de
  workspacegate zijn zonder bronwijziging groen.
- Gerichte videonormalisatie/runner: 23/23; beide hoofdregressies zijn met de
  oorspronkelijke broncode rood en na herstel groen.
- Echte FFmpeg op begrensde 1,5 CPU/1536 MiB: 46.564 ms normalisatie, budget
  168.000 ms. Output: 1080×1920, 46 s, H.264 Main level4.0, yuv420p, 30 fps,
  zonder audio; 35.094.327 bytes, niet-lege poster van 390.397 bytes.
- Geen layout-, keyboard- of ARIAwijziging. Alleen bestaande timeoutcopy verwijst
  naar de werkelijke herstelknop. De bestaande browser-/a11y-CI blijft vereist.

Exacte CI en staging/production worden op de PR geregistreerd.
Rollback betreft de worker/applicatie en herintroduceert de te korte deadline;
er is geen schemawijziging of data-/Storageconversie nodig.
