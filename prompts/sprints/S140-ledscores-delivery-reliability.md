# S140 — LED Scores Playerbetrouwbaarheid en afleverbewijs

## Doel

Zorg dat een gepubliceerde Goal Alert op iedere ondersteunde, actieve Player-
runtime kan aankomen en dat Control per doelscherm eerlijk laat zien wat er is
gebeurd. Herstel zowel moderne Android/browser-Players die de tenantflag eerst
uit zagen als de statische LG/webOS Legacy-runtime.

## Ownership

- `apps/player/app/_components/ledscores-goal-overlay*`;
- `apps/player/app/_lib/lg-legacy-page.ts` en de Legacy-routeregressie;
- LED Scores-databron- en Studio-routes in tenant-Control;
- S140-documentatie en testbewijs.

## Implementatiegrenzen

- HTTP 204 betekent tijdelijk niet vrijgegeven en start een begrensde retry;
- 401/403 blijven een veilige credentialgrens zonder retrylus;
- Legacy gebruikt same-origin XHR/SSE met de revocable devicecredential en
  blijft compatibel met Chromium 79;
- iedere geldige delivery krijgt `received` en daarna precies een aantoonbare
  `rendered`, `skipped` of `failed`-uitkomst;
- de overlay staat boven de bestaande last-known-good release en veroorzaakt
  geen zwart frame, mutable release of providertoegang vanuit de Player;
- Control gebruikt batchqueries, geen N+1, en onderscheidt heartbeat van
  Goal Alert-ontvangst;
- een synthetische database-dispatch heet `klaargezet`, nooit al `getoond`;
- navigatie toont onmiddellijk een pending state en voorkomt herhaalde klikken;
- geen nieuwe realtime- of databasearchitectuur zonder apart besluit.

## Gates

Player- en Control-unit, lint, typecheck en build; webOS-compatibiliteitsguard;
Player- en offlinebrowsergates; Control a11y/E2E; volledige workspacegates;
immutable VPS-build vanaf actuele `main`, staging vóór exact dezelfde productie-
images; publieke health, workers, pairing/LG-recovery en een schermgebonden
synthetische productie-readback.
