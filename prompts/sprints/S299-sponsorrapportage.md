# S299 — Volledige sponsorrapportage

Basis `da3d1242c92beedee3e8d8d8d2c8d35404ab4ae6`, branch
`veyocast/s299-sponsorrapportage`, eigen geïsoleerde worktree. Opdracht B2/D en
INT-08/SPN-01..04 uit de gebruikersoverdracht van 9 november 2026.

Behoud geaccepteerde UUID-idempotente afspeelregistraties, campagnes, rotatie,
plannen en Player. Bereken aantallen en gevalideerde speeltijd over alle
geautoriseerde events, onafhankelijk van de laatste 50 detailregels. Dashboard
en CSV gebruiken dezelfde campagne, scherm, halfopen lokale periode en
ontvangstpeildatum. Laat binnengekomen offline events volgens gebeurtenistijd
meetellen wanneer de gebruiker een nieuwe peildatum kiest.

Vereis tenant.sponsor.read én tenant.sponsor.report voor lezen/export, en
tenant.sponsor.write voor een
optioneel expliciet campagne/periodegebonden doel. Geen fictieve doelen,
QR-scans, publieksbereik of historische schermgroepen. Maak onbekende
registratievolledigheid en bekende registratie-/retentiegaten zichtbaar.

Ownership: sponsorroute/actions/lib, sponsor-API, gerichte domein-/transport-
contracten en tests, één additieve forwardmigratie en SQL-regressie, deze prompt
en eigen documentatie/bewijs. Root bezit PLANS/TASK_LEDGER en releases. Geen
dependencies, shellnavigatie, tokens, workflows of service worker wijzigen.
Migratie/typesnamespace is exclusief tot expliciete vrijgave aan root.

Verifieer minimaal twee tenants, >5.501 geaccepteerde events, exacte filters,
detailpaginering, dubbele aflevering, late/ongeldige events, lokale dag/DST,
rechten, expliciet doel/geen doel, CSV-escaping/formuleneutralisatie en
responsive/a11y. Database uitsluitend geïsoleerd op 127.0.0.1:64432; geen
hosted mutaties. Root coördineert zware builds/browsers en review/uitrol.
