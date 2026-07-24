# VeyoCast Studio — operations

## Runtime

Studio gebruikt drie bestaande runtimegrenzen:

1. **Control** bewaart en valideert ontwerpen via guarded Supabase-RPC’s.
2. **Media-worker** claimt naast bestaande mediajobs maximaal één zware
   Studio-render per proces.
3. **Private Storage en mediadomein** ontvangen uitsluitend het gevalideerde
   eindresultaat.

Er is geen Studio-runtime in Player. Een voltooide export is voor Publisher en
Player een normaal `ready` image- of videoasset.

## Rendercontract

| Output | Contract |
|---|---|
| PNG | exacte artboardresolutie, 8-bit RGB/RGBA, sRGB/ICC, checksum |
| MP4 | 1920×1080 of 1080×1920, H.264 Main, 30 fps, yuv420p, geen audio, faststart |
| Poster | PNG op exact artboardformaat en dezelfde bevroren revisie |

De worker gebruikt lokaal gebundelde Inter-fontbestanden en laadt geen externe
fonts of assets. Iedere bronasset is een ready tenantasset met een vastgelegde
checksum. Tijdelijke frames en bestanden staan alleen in de begrensde worker
tempdirectory en worden in `finally` opgeruimd.

## Queuegedrag

- Iedere render bevriest eerst een immutable revisie.
- De idempotency key reserveert één renderjob en één media-ID.
- Een lease voorkomt dubbele verwerking.
- Een actieve worker verlengt de lease tijdens langdurige rendering.
- Annuleren wordt tussen veilige fasen en frames gecontroleerd.
- Alleen tijdelijke infrastructuurfouten krijgen begrensde retry/back-off.
- Document-, font-, asset- en outputvalidatiefouten zijn definitief tot een
  nieuwe expliciete gebruikersactie.
- Completion is transactioneel en replay-safe.

## Veilige noodstop

Bij een renderincident:

1. schaal de media-worker naar nul of stop alleen de Studio-jobclaim;
2. trek zo nodig execute op `claim_studio_render_job_v1` in;
3. laat bestaande Publisher- en Playerdiensten doorlopen;
4. behoud reeds voltooide media-assets;
5. herstel de workerimage en retry alleen aantoonbaar veilige jobs.

De Studio-tabellen zijn additief. Terugrollen van Control of worker vereist geen
destructieve databasemigratie.

## Monitoring

Log en meet zonder documentpayloads, signed URL’s of tokens:

- queueleeftijd;
- jobs per status;
- rendertijd per outputtype, formaat en duurklasse;
- retry- en foutcategorie;
- lease-expiratie;
- tijdelijke opslag en outputbytes;
- completion- en mediaregistratiefouten.

Productionlogging bevat job-, tenant- en revision-ID alleen waar dit nodig is
voor operationele correlatie en volgt het bestaande observabilitycanon.

## Capaciteitsgrenzen voor v1

- maximaal 200 lagen;
- maximaal 30 seconden;
- vaste 30 fps;
- één zware Studio-render tegelijk per worker;
- alleen 1920×1080 en 1080×1920;
- geen audio;
- geen willekeurige externe HTML, JavaScript, fonts, SVG of URLs.

Benchmark 5, 10 en 15 seconden in beide oriëntaties op de production workerlimiet
voordat brede tenantuitrol wordt aangezet. Horizontale schaal of aparte
renderworkers is een operationele vervolgkeuze op basis van meetdata.
