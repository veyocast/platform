# S112 — Menu Studio v2

## Opdracht

Implementeer de door de gebruiker aangeleverde
`VeyoCast-Menu-Studio-Codex-Handoff-v2.0` end-to-end. De volledige
`VEYOCAST-MENU-STUDIO-CODEX-MASTERPROMPT-v2.0.md`, het v2-datamodel, de
portrait-, media/logo-, productgroep-, rollout- en themecanons, de
acceptatiematrix, het referentieprototype en de tien showcasereferenties zijn
bindend binnen de hogere repositorygrenzen.

De repository bepaalt architectuur, tenantautorisatie/RLS, private opslag,
immutable snapshot/publicatie, releasebundles, Player/offline en locked
merkassets. Het prototype bepaalt gedrag en art direction, maar niet auth,
dataopslag, ID-generatie, canvasgeometrie of uploads.

## Verplicht resultaat

- één strict, versioned `MenuDocument.v2` en één pure commandlaag;
- één gedeelde `MenuScene` voor preview, browser-Player en primaire thumbnail,
  met contractgelijke LG Legacy-adapter;
- exact tien manifestthema's, light/dark en exact 1920×1080 + 1080×1920;
- bindende portraitzones en deterministic gemeten paginering zonder crop;
- linked/free mixed subregels met correcte shared/from/separate-prijssemantiek;
- tenantveilige image/video/logo-assets via private, geverifieerde varianten;
- revision-checked, idempotente draftsave en expliciete immutable publish;
- dual-read v1/v2 zonder backfill of mutatie van bestaande releases;
- featureflags standaard uit en een rollback die last-known-good behoudt;
- desktop triptych, mobiele sequentiële sheets, click/tap/toetsenbordpariteit,
  44 px targets en volledige Nederlandse feedback;
- de volledige relevante unit-, RLS-, a11y-, E2E-, Player/offline-, LG- en
  goldenmatrix groen.

## Architectuurbesluit en ownership

ADR `docs/adr/0014-menu-studio-v2.md` is leidend voor discovery, integratie,
compatibiliteit, migratie, rollout, rollback en toegestane paths. Geen
productiecredential, destructieve backfill, mutable release, gereconstrueerd
logo, service-rolebrowsercode of versimpeling van offline playback is
toegestaan.

## Deployment

Na groene gates wordt één geteste SHA gepusht. Diezelfde SHA wordt eerst naar
staging en daarna via de beveiligde handmatige productionflow gepromoveerd en
met de bestaande health-/pairing-/Player-smokes geverifieerd. Tenantflags en
inhoudsactivatie zijn afzonderlijk van de binaire deployment.
