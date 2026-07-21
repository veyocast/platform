# Runbook — schermsynchronisatie

## Signaal

Meer dan 20% van de vloot is tien minuten offline of een online Player activeert de gewenste release niet binnen twee minuten.

## Herstel

1. Open de meegeleverde Control-filter en bepaal tenant- en schermimpact.
2. Controleer heartbeat, gewenste en actieve immutable release en laatste bounded errorcode.
3. Laat de last-known-good release spelen; wis geen geldige lokale cache.
4. Vraag pas na diagnose een idempotente retry aan.
5. Bevestig herstel met een nieuwe heartbeat en gelijkheid van desired/active release.

Eigenaar: Product support; escalatie naar Platform operations bij meerdere tenants.
