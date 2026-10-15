# S220 — Menu Studio bewerken en kolomvolgorde

Analyseer de bestaande editor, contracten, servervalidatie en renderprojectie.
Zet de clubslogan terug binnen het witte productenpaneel, vast linksonder met
de bestaande binnenruimte. Maak widgets en producten inklapbaar met per niveau
één geopende sectie. Voeg per product een potloodactie toe voor schermnaam en
schermprijs. Laat automatische producten eerst kolom 1 vullen en daarna kolom 2;
expliciete kolomkeuzes blijven geldig. Verwijder de tekenlimiet van vrije
productsubregels in invoer, opslag en widgetprojectie.

Ownership: Menu Studio widgeteditor/CSS/documenthelpers en tests, de bestaande
Menu Studio-editor voor het vrije invoerveld; contracts menu-studio en
sites-presentation plus gerichte tests; content-templates menu-widgetmarkup,
styles, projectie, menu-scene model/markup en dynamische menuprojectie;
tests/control/sites-source-wizard-matrix.spec.ts en
sites-menu-studio-parity.spec.ts, gerichte nieuwe browserproeven; één nieuwe
forwardmigratie, bijbehorende pgTAP en de bestaande gewijzigde labelverwachting;
PLANS, TASK_LEDGER en dit sprint-/bewijsdocument.

Schermprijzen zijn expliciete bedragen in gehele centen op de plaatsing; de
catalogus en zijn bron blijven intact. Behoud tenantrechten, bestaande
commandreceipts, immutable publicaties, database-eerst brondata en offline-LKG.
Geen dependencies, locked assets of workflowwijzigingen. De gebruiker vraagt
commit, push, PR, merge en uitrol naar staging en productie. Wacht alle CI af
vóór merge; GitHub auto-merge wacht in deze repository niet op lopende checks.
