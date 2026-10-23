# Validatie van deze overdracht

Gecontroleerd op 22 oktober 2026. Deze controle gaat over het overdrachtspakket en het goedgekeurde prototype, niet over een reeds geïmplementeerde wijziging in VeyoCast.

| Controle | Uitkomst |
| --- | --- |
| Vastgelegde prototypeversie | `ae83f2b4312408eacae9f29177d3c743e104185b`; werkboom schoon |
| Exacte bronkopie | 259 bestanden, 9.057.776 bytes; ieder bestand gelijk aan de assetaudit |
| Catalogus | 36 unieke familie-ID’s, overeenkomstig de gelezen VeyoCast-catalogus |
| Basisvoorbeelden | Iedere familie aanwezig in alle vier thema-/formaatcombinaties: 144 beelden |
| Detailvoorbeelden | 75 beelden; welkom 1–4, lege gridposities, scoremomenten, standposities en achtergronden |
| Visuele controle | Vier contactbladen en gerichte welkoms-/gridbeelden bekeken; families en aantallen komen overeen |
| Bron-JavaScript | `node --check broncode/app.js` geslaagd |
| Uitvoerbare gedragsvoorbeelden | `node --test codevoorbeelden/reference-behavior.test.mjs`: vijf tests geslaagd |
| Pakketcontrole | `python3 tools/verify-package.py`: bronhashes, beelden, galerijlinks en volledige checksums gecontroleerd |
| Archief | ZIP-integriteit gecontroleerd; repo-relatieve mapstructuur behouden |

De vijf voorbeeldtests controleren de welkomstselectie, 0–6 stabiele slots, vervolgpaginering zonder dataverlies, de tijdscyclus van de stand en de begrensde eigen rij. Ze vervangen geen VeyoCast-contract-, Worker-, Player- of databasetests.

Voor productie moet Codex de volledige acceptatiematrix uit `05-ACCEPTATIE-EN-TESTEN.md` uitvoeren tegen de daadwerkelijke actieve renderketen en daar bewijs van opnemen. De technische integratienotities zijn gebaseerd op repo main `3bbb51ac006bbaf8381a11d5dcfd7024d13d3876`; Codex moet eventuele latere wijzigingen eerst beoordelen.
