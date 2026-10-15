# S223 — Betrouwbaar synchroniseren en passend LED-voorbeeld

Onderzoek scherm 2f00f03e-d1cc-484c-bfca-66c92c7dd823 dat de vorige
prijslijst blijft tonen ondanks een voorbereide nieuwe videopublicatie.
Maak ‘Nu synchroniseren’ bereikbaar en laat de Player het verzoek daadwerkelijk
uitvoeren en bevestigen. Een gewone heartbeat mag het verzoek niet verwijderen.
Herstel de onbeperkte LG-videostart wanneer het playing-event uitblijft en
rapporteer afspeelfouten zonder de laatste zichtbare inhoud weg te halen.
Schaal ook het LED Scores-voorbeeld binnen de beschikbare viewport (9:16/16:9).

Ownership: Control schermacties/detail/bulk; LED scene-editor/wizard/CSS;
Player manifest/heartbeat-runtime, LG-runtime, heartbeat-API; één forwardmigratie
voor heartbeat-ontvangstbevestiging; bijbehorende unit/browser/RLS-regressies;
prompt, docs, PLANS en TASK_LEDGER. Geen dependencies, lockfile of merkassets.

Behoud serverpermissions, devicecredentials, tenantisolatie, immutable releases,
assetverificatie, wisselen op grenzen en offline last-known-good. Synchroniseren
betekent geen cache wissen. Maak onderscheid tussen ontvangen sync-verzoek en
de bevestigde eerste zichtbare frame. Volledige foundation-, DB/RLS-, UI-,
player- en offlinegates vóór merge en bestaande geautoriseerde uitrol.
