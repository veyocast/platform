# Sync V1 · uitvoering S226

De immutable originele overdracht staat in `handoff/`. Controle:

```sh
python3 docs/sync-v1-rebuild/handoff/scripts/verify-package.py
```

De huidige opdracht heeft voor gemapte UI/UX voorrang boven oudere v11/v17-
vormgeving. RLS, serverrechten, immutable publicaties, actieve data-ID's,
Player-LKG en LG-compatibiliteit blijven behouden. Zie `DECISIONS.md` voor de
expliciet uitgestelde hardware- en SendGrid-configuratie en de gemeten
toegankelijkheidscorrecties op de originele bron.

De implementatie en bewijsstatus staan in `../../execution/PLAN.md`, de 148-
scenariomatrix en `../../execution/evidence/`. Geen prototypevinkje, algemene
unitgate of screenshot wordt als volledige scenarioacceptatie behandeld.

## Aangesloten grenzen

| Sync-oppervlak | Werkelijke implementatie |
|---|---|
| Publieke negen routes | `apps/marketing/app/_sync/`, Next SSR/metadata/canonicals |
| Demo-/contactaanvraag | Server action → service-only intake-RPC → duurzame inbox + outbox |
| Beheerinbox | `/platform/requests`, SSR-client, platformcapability, AAL2 + revisionguard voor mutaties |
| SendGrid | Bestaande media-worker, lease, maximaal vijf pogingen, begrensde backoff; geen automatische retry bij onzekere verzending |
| Contentbibliotheek | `/dashboard/content`, `sync_content_library_v1` security-invoker-view over bestaande media/Studio/dynamische slides/reeksen |
| Bewerken/upload/publiceren | Bestaande guarded domeinroutes en command-RPC's blijven de enige schrijvers |
| Playerintro | Originele hero als lokale shellasset; assetcache/pairing/releasestate blijven behouden |
| Androidiconen | Meegeleverde drawable/adaptive resources, gedeeld door general/TV; Control behoudt eigen package/signingcontract |

CSS-projecties zijn reproduceerbaar via `node scripts/build-sync-css.mjs`.
De oorspronkelijke bronnen worden niet aangepast. Publieke bundles importeren
geen prototype-store, tenantfixtures of interne overdracht.

## Nieuwe optionele mailconfiguratie

In bestaande staging-/production-environments: secret `SENDGRID_API_KEY`,
variables `SENDGRID_FROM_EMAIL` (geverifieerd bij SendGrid) en
`VEYOCAST_INQUIRY_EMAIL` (beheerinbox). Alle drie ontbreken bewust totdat de
eigenaar ze toevoegt. De worker doet zonder volledige configuratie geen extra
databasepolls en geen mailverzoeken. Bestaande secrets, variables, flags,
runners, workflowtriggers en promotiongates zijn niet verwijderd of hernoemd.

API-contract: [SendGrid Mail Send](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send).
202 betekent aangeboden aan SendGrid; afleverbevestiging wordt niet geclaimd.

## Migratie en herstel

De additieve S226-migraties verbinden prospectopslag/outbox, bibliotheekreads,
Sync-documentvalidatie, plaatsingsvarianten, bronbinding en begrensde actuele
binarydelivery met de bestaande tenant-/release-/workerautoriteiten. Zij
herschrijven geen bestaande immutable publicaties of device-/provideridentiteiten. Code kan
via de bestaande SHA-rollback worden teruggezet; de toegevoegde tabellen/view
kunnen blijven bestaan en worden niet destructief gedropt. Een sendlease met
onzeker resultaat wordt eerst bij SendGrid gereconcilieerd, daarna pas expliciet
opnieuw aangeboden met platformrechten en AAL2.

Dit is een lopende uitvoering, geen verklaring dat de volledige rebuild of
uitrol is afgerond. De resterende visuele route-/statepariteit, volledige
browserjourneys, Androidartifacts en branchcleanup blijven open tot bewijs.

Het Sync-overzicht haalt oudere actieve/gewenste releasereferenties gericht op
buiten het recente geschiedenisvenster. Zichtbaar-framebewijs blijft gescheiden
van contactstatus en van de nieuwe gewenste publicatie. De playlistbibliotheek
gebruikt dezelfde bestaande revision-/idempotentiecommands; de lokale echte
publisherjourney (upload, metadatareadback, volgorde, tweede-sessieconflict en
immutable publicatie) is geslaagd. Dit is nog geen fysieke Playeracceptatie.

De contentbibliotheek opent de bestaande beveiligde uploadservice in haar eigen
route. Het schermenoverzicht is eveneens geporteerd; onderliggende groep-,
compositie-, onboarding- en bulkcommands zijn behouden. De visuele controle
van deze laatste aansluiting is nog in uitvoering.
