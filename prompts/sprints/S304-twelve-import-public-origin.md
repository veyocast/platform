# S304 — Publieke origin na Twelve-import behouden

Basis main: `a46c56f67195353e90f41320854c0dba30daa72f`. Onderdeel van de bestaande
opdracht/overdracht en INT02 B-acceptatie. De echte HTTP303-ontvangstcontrole van
een al toegepaste stagingimport wees naar `https://0.0.0.0:3000` en verliet de
publieke Control-origin. De writer is daarmee niet opnieuw uitgevoerd.

Lees AGENTS, README, PLANS, TASK_LEDGER en de toepasselijke technische, design-,
Publisher-, security/RLS- en Player-offlinecanons. Ownership: uitsluitend de
bestaande `apps/control/app/api/products/import/[importId]/route.ts`, haar tests,
deze prompt, eigen bewijsdoc en één eigen ledger-entry. Root beheert Git, normale
CI/releasegates en elke hosted actie.

Herstel de interne-URL-afhankelijkheid van go() met een relatieve HTTP303-Location
voor de bestaande vaste interne UUID-paden. Behoud alle Origin/Host/protocol-,
sessie-, tenant-, capability-, formulier-, RPC- en idempotente ontvangstgrenzen.
Vertrouw geen ongetoetste forwarded-host/protocolheaders. Verander geen importdata,
releases, bestaande planningen, Player, Worker, SQL, workflows of dependencies.

Bewijs oude bron rood en nieuwe groen voor toepassen, bestaande ontvangst zonder
writerherhaling, mapping en foutuitkomsten achter de reverse proxy. Houd vreemde
Origin op403 vóór sessie/RPC en verifieer doorgifte van normale revalidatie- en
RPC-argumenten. Voer gerichte tests/lint en Control-typecheck uit; laat normale
workspace- en volledige CI-gates door root sluiten. Leg echte hosted
normale navigatie pas na de nieuwe staginguitrol vast. Geen import- of writerretry
na een onzekere ontvangst; eerst read-only reconciliatie van bestaande identiteit.
