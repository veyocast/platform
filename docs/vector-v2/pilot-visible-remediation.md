# S124 — Vector v2 pilot zichtbaar maken

Auditdatum: 2026-08-25
Baseline: `7104f41b308f681d7ea3aae263390444f91a56f1` (`origin/main`)
Werkbranch: `veyocast/s124-vector-pilot-visible`

## Root cause

- De S123-binaries en migraties stonden correct live, maar nieuwe tenantflags
  kregen bewust `false` als default en de pilottenant is na deployment niet
  geactiveerd.
- `vector_v2_design_system` en `vector_v2_control_shell` bestonden in het
  databaseschema, maar werden niet door de Control-layout gelezen. Daardoor
  veranderde de globale tenant-shell niet wanneer een flag werd gezet.
- Alleen `venue_twin` en `screen_health_view` waren via platformbeheer
  bedienbaar. Er bestond geen release-SHA-gebonden operationele workflow voor
  de volledige Vector-pilotcohort.
- De bestaande Control-shell voldeed grotendeels aan Atelier Ivory/Publisher,
  maar maakte Living Venue OS, System Pulse en de nieuwe vlootweergaven niet
  voldoende zichtbaar.

## Niet te breken contracten

- Featureflags geven nooit rechten; capabilities, tenantstatus en RLS blijven
  leidend.
- Activatie gebeurt los van binary deployment, alleen tegen een exact gezonde
  reeds gedeployde `main`-SHA en een exact unieke actieve tenant.
- Geen tenantdata, releases, playlists of Playercache wordt bij rollout
  gemuteerd.
- Ontbrekende venue-, provider- of media-inhoud toont een expliciete lege
  toestand. Er komt geen fictieve productie-inhoud.
- De Player en immutable releaseketen blijven ongewijzigd.

## Implementatie- en bewijsplan

| Werk | Implementatie | Bewijs |
|---|---|---|
| Feature-resolutie | tenantflags server-side in shell-layout laden | DONE · 192 Control-unitchecks + 1.282 RLS-assertions |
| Vector-shell | echte conditionele rail, commandbar en statuscontext | DONE · a11y 36 groen / 1 bewuste live-skip + screenshots |
| System Pulse | operationele data, acties en eerlijke lege toestand | DONE · desktop-E2E zonder consolefouten |
| Vloot | zichtbare Lijst/Kaarten/Venue/Health-keuze | DONE · desktop/mobile E2E 2/2 |
| Platformbediening | allowlist van niet-financiële Vector-pilotflags | DONE · AAL2-RPC behouden + RLS-regressie groen |
| Pilotrollout | private ownerfunctie + protected GitHub workflow + readback | DONE · pgTAP 18/18 + actionlint/securityvalidatie |
| Release | immutable staging → production → afzonderlijke pilotactivatie | OPEN · na merge health-SHA en tenantreadback vastleggen |

## Lokale gates

- `pnpm lint`: 30/30 groen;
- `pnpm typecheck`: 30/30 groen;
- `pnpm test`: 30/30 groen;
- `pnpm build`: 18/18 groen, inclusief Control, Player en native export;
- `pnpm db:reset`: migratieketen vanaf nul groen;
- `pnpm test:rls`: 60 bestanden, 1.282 assertions groen;
- `pnpm test:a11y -- --project=chromium`: 36 groen, 1 bestaande
  environment-gated live Menu Studio-test bewust overgeslagen;
- `tests/e2e/vector-pilot-visible.spec.ts`: 2/2 groen;
- `scripts/validate-github-actions.sh`: groen.

Visueel bewijs:

- `docs/screenshots/vector-v2/control/system-pulse-1440x900.png`;
- `docs/screenshots/vector-v2/control/venue-setup-1440x900.png`;
- `docs/screenshots/vector-v2/control/venue-setup-390x844.png`.

## Placeholderbeleid en benodigdheden

Toegestaan zijn uitsluitend functionele lege toestanden: een niet-ingestelde
plattegrond, ontbrekende zones, nog niet gekoppelde databron en nog niet
geconfigureerde externe provider. Geen fake scherm, wedstrijd, sponsor,
testimonial, factuur of klantlogo komt in een productiepad.

Na live verificatie wordt een concrete lijst opgeleverd van echte assets,
providercredentials, juridische goedkeuringen en fysieke hardwarechecks die nog
door de productowner moeten worden aangeleverd.
