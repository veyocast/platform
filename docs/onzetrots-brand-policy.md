# OnzeTrots — primaire kleur en koppen

Vanaf de opdracht van 6 november 2026 gebruiken alle OnzeTrots CSS-presentaties
de primaire kleur **#03438A** en **Permanent Marker Regular** voor hun koppen.
Dit geldt ook voor opgeslagen ontwerpen met historische renderer-, stijl-,
accent- of fontinstellingen. De eerdere beperkte S291-keuze voor Barlow-koppen
is voor deze twee merkrollen vervangen.

De gedeelde, tot OnzeTrots beperkte runtimecascade geldt voor klassieke Sync,
approved v1/v9, huidige en historische Sites TV/Studio/LED en Menu-widgets.
Preview, Player en nieuwe captures gebruiken dezelfde compositie. Gewone
lopende tekst, prijzen, scores, logo-artwork, gegevens, paginering en motion
behouden hun eigen rollen. In donkere varianten blijft de tekst leesbaar met
een lichte voorgrond boven de primaire kleur.

Het bestaande lokale font is daadwerkelijk `PermanentMarker-Regular`, 73.276
bytes, SHA-256
`a73712ce4f3b32d3c7a1a657d56c6aaf50c719b7fa7fe0541905fe77f5a9906c`.
Er komt geen extern netwerkfont of gewijzigd bronbestand bij. Source/Sites nemen
het font mee als checksumgebonden rendererasset. Oudere generieke thema's
gebruiken het bestaande vertrouwde appassetmodel: de Player-shellcache bereidt
het font vooraf voor en de renderer controleert de werkelijke fontdecode.
Fontdecode, headerfit en offlinevoorbereiding nemen het verplichte kopfont
samen mee. Een ontbrekend of corrupt font bevestigt geen nieuw frame.

Een bestaand ontwerp openen schrijft geen gewijzigde bodyfontkeuze en maakt
geen conceptwijziging uitsluitend om het nieuwe kopfont te kunnen tonen.
Opgeslagen configuraties, immutable publicaties, protocollen en historische
bron-/assetmanifests worden niet herschreven. De runtimebranding vereist geen
nieuwe contentpublicatie en start geen PNG-/MP4-job voor een CSS-preview.
Een eerder geëxporteerde PNG/MP4 heeft vaste pixels; een nieuwe expliciete
capture gebruikt de nieuwe branding via hetzelfde capturepad. Een bestaande
expliciete exportcache kan bij ongewijzigde inhoud nog dezelfde historische
uitvoer teruggeven; de software-uitrol herschrijft die bestanden niet.
Dit geldt ook voor actieve binary-only Player-profielen: de zelfstandige
LG/native Source-route speelt zijn bestaande MP4 af totdat een nieuw
geverifieerd bestand met een nieuwe publicatie beschikbaar is. Een reeds
geverifieerde oude v9-cache zonder de nu verplichte Markerasset behoudt alleen
zijn complete v1-binaryfallback; nieuwe candidates en DOM-v2 moeten het font
wel volledig voorbereiden voordat zij een nieuw frame mogen bevestigen.

Regressies controleren werkelijke `PermanentMarker-Regular`-glyphs, primaire
kleur ondanks oude opgeslagen accenten, historische en huidige renderpaden,
licht/donker, liggend/staand, lange koppen, QR, Worker/preview-pariteit en
fontvoorbereiding met fouten. Workflowruns en uiteindelijke deployment-SHA's
staan in de bijbehorende PR; browserbewijs is geen fysieke Android-/LG-test.
