# S302 — Bovenuitlijning Vandaag op het veld

Bron: expliciete gebruikersopdracht van 9 november 2026. Start vanaf main
`bd5f1fb59254a4fd7d56e3a2974d82f39e0ef611`; het afzonderlijke, normale
orchestratieherstel PR333 is als afhankelijkheid geïntegreerd.

Herstel de gedeelde liggende OnzeTrots-layout voor **Vandaag op het veld**.
Een laatste pagina met drie wedstrijden moet dezelfde eerste-rijhoogte en
bovenmarge onder de titel houden als een volle eerste pagina. Behoud drie
kolommen, datum, clublogo’s, teamnamen en aftraptijden. De vrije ruimte komt
onder de wedstrijden. Controleer laatste pagina’s met één en twee wedstrijden.

Gebruik dezelfde productie-layout voor preview en Player. Geen wijziging aan
wedstrijdselectie, paginacapaciteit, afspeeltiming, ontwerpen of publicaties.
Respecteer het Player-offlinecontract en bestaande immutable releases.

Ownership: sportlink_worker uitsluitend gedeelde layoutbestanden in
content-templates; available_receipt uitsluitend eigen S302-browserspec en
fixturehelper; root prompt, ledger, documentatie, integratie, review en PR.
Geen migraties of afhankelijkheidswijzigingen voor deze layouttaak. De tijdens
de volledige CI aangetoonde Control-jobafbreking wordt afzonderlijk hersteld
met voldoende joblooptijd; alle cases en individuele limieten blijven gelijk.

Acceptatie op 1920 × 1080: speel een volle pagina met zes wedstrijden en
daarna respectievelijk drie, één en twee wedstrijden. Meet bij de echte
paginawissel de bovenkant van de eerste rij in preview en liggende Player;
controleer de drie kolommen en inhoud. Bewaar zichtbare frames en benoem het
geteste uitvoerpad. Doorloop de toepasselijke normale gates.
