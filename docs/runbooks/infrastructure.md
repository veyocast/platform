# Runbook — infrastructuur

## Disk

Bij meer dan 85% gedurende tien minuten: bepaal welke expliciete deploydirectory, imagecache of logretentie groeit. Verwijder niets breed of recursief zonder resolved target en herstelbewijs.

## TLS

Bij minder dan veertien dagen geldigheid: controleer Caddy renewal en DNS, vernieuw gecontroleerd en verifieer alle publieke healthroutes.

## Deployment

Bij één mislukte healthmatrix gedurende twee minuten: stop promotie en activeer de vorige immutable image digest. Voer geen database-downmigration uit.

Eigenaar: Platform operations. Zie ook `docs/deployment/rollback.md`.
