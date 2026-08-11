# S98 — data-aware Sportlink-slidewizard

## Resultaat

- Control gebruikt voor wizardpreview en Player één gedeelde Editorial
  Arena-renderer en view model.
- `preview_dynamic_slide_v1` bouwt een vluchtige preview met de canonieke
  snapshotfunctie, vereist `tenant.dynamic_slide.write` en schrijft geen slide,
  snapshot of renderjob.
- Sportlink-opties worden uit alle gepagineerd geladen genormaliseerde teams,
  wedstrijden en standen opgebouwd; de oude impliciete 1.000-rijengrens is
  verwijderd.
- Team, competitie/fase en seizoen tonen aantallen renderbare items. Lege
  opties blijven alleen via een expliciete diagnosedisclosure zichtbaar en
  zijn niet selecteerbaar.
- De wizard toont bronsync, last-known-good foutstatus, inhoud, pagina's,
  gekoppelde assets en een publicatiepreflight. De slidebibliotheek onderscheidt
  renderstatus van inhoudsgezondheid en snapshotleeftijd.

## Veiligheidsgrenzen

- De Player en browser bellen Sportlink nooit rechtstreeks.
- Previewassets zijn tenantgebonden, kort getekend en gevalideerd tegen het
  bestaande Playercontract.
- Published releases blijven immutable en last-known-good PNG/cachefallbacks
  blijven bestaan.
- De RPC heeft expliciete grants voor `authenticated` en `service_role`; anon
  en public zijn ingetrokken.

## Verificatie

- `pnpm db:reset`: groen.
- `pnpm test:rls`: 45 bestanden, 888 assertions groen, inclusief non-persisted
  preview en capabilitygrens.
- Control unit: 32 bestanden, 141 tests groen.
- Control, Player en `@veyocast/content-templates`: lint/typecheck groen.
- Productionbuild Control en Player plus webOS-compatibiliteitsguard: groen.
- Workspace `lint`, `typecheck` en `test`: elk 30/30 taken groen.
- Player browsermatrix: 79/79; offline: 7/7.
- Accessibility: 34/35 in de parallelle run; de enige bestaande
  navigatiebelastingflake is geïsoleerd groen. De gewijzigde dynamische
  workspacescenario's zijn groen.
- Volledige Chromium-matrix: 138 groen, 8 bewuste live/visual skips en vijf
  parallelle belastingflakes; exact die vijf zijn gezamenlijk met één worker
  5/5 groen.
- Hosted staging- en productionresultaten worden na de immutable uitrol aan
  het taakledger toegevoegd.
