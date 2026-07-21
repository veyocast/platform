# AGENTS.md — VeyoCast Codex Operating Rules

## 1. Leesvolgorde voor iedere agent

Voor elke taak moet de agent eerst lezen:

1. `README.md`
2. `PLANS.md`
3. `TASK_LEDGER.md`
4. `docs/technical-canon.md`
5. `docs/design-implementation-canon.md`
6. `docs/design-canon/v1/VEYOCAST_DESIGN_CANON_v2.0.md` wanneer aanwezig
7. `docs/security-rls-canon.md`
8. `docs/player-offline-canon.md`
9. het relevante sprintpromptbestand in `prompts/sprints/`

Wanneer het echte designcanonbestand in de repo staat, is dat leidend boven samenvattingen in dit pakket.

## 2. Niet onderhandelbaar

- Gebruik Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion waar functioneel, Supabase en PWA.
- Gebruik pnpm workspaces.
- Bouw multi-tenant vanaf sprint S02.
- RLS is vanaf de eerste databasefeature verplicht.
- Permissions worden server-side afgedwongen; frontend verbergt hooguit aanvullend.
- De Supabase service-role key mag nooit in browsercode terechtkomen.
- De player is een device, geen Supabase Auth-user.
- Playlists worden gepubliceerd als immutable releases.
- De player activeert nooit een incomplete release.
- De player toont geen zwart scherm bij tijdelijk offline zolang er een geldige lokale release bestaat.
- Normale playback toont uitsluitend de goedgekeurde locked VeyoCast-lock-up
  linksonder op 40% opacity; andere permanente softwarewatermarks zijn verboden.
- Goedgekeurde logo-assets zijn locked. Placeholder-assets mogen tijdelijk, maar mogen niet als definitief worden behandeld.
- Hardcoded brandkleuren zijn verboden waar tokens beschikbaar zijn.
- Mobile UI is herontwerp, geen mini-desktop.
- Geen fake klanten, testimonials, integratieclaims of prijzen.

## 3. Path ownership

Een agent werkt alleen aan de bestanden die in de taak staan. Wijzigingen buiten ownership zijn alleen toegestaan na expliciete stop-and-report.

### High-conflict paths

Deze paths mogen niet door meerdere agents tegelijk gewijzigd worden:

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `supabase/migrations/**`
- `supabase/seed.sql`
- `packages/database/**`
- `packages/tokens/**`
- `packages/ui/src/index.ts`
- `.github/workflows/**`
- service-worker files
- generated Supabase types

## 4. Branchregels

- Eén taak = één branch = één worktree = één PR.
- Branchnaam: `veyocast/sXX-korte-taaknaam`.
- Geen force-push behalve na expliciete toestemming.
- Geen amend/rebase op gedeelde branches zonder toestemming.
- Elke commit moet een toetsbare eenheid zijn.

## 5. Stop-and-report situaties

Stop vóór commit/push wanneer:

- migraties conflicteren;
- RLS-test faalt;
- een taak productiecredentials nodig lijkt te hebben;
- Codex een logo moet reconstrueren;
- player offlinegedrag wordt versimpeld;
- een release mutable gemaakt dreigt te worden;
- files buiten ownership wijzigen;
- lockfile wijzigt zonder dependency-taak;
- testgates rood blijven;
- requirements ambigu zijn.

## 6. UI-regels

- Gebruik semantische componentprops: `<Button variant="primary" size="md">Publiceren</Button>`.
- Primary button: Electric Orange background met Ink Black tekst.
- Statussen tonen tekst én kleur/icoon.
- Foutmeldingen: oorzaak, gevolg, herstelactie.
- Gebruik Nederlandse zinskapitalisatie.
- Geen 12 px primaire bodytekst.
- Geen raw stack traces in UI.
- Geen drie-panel playlisteditor op mobiel; gebruik sequentiële flow.

## 7. Database- en securityregels

- Elke tenanttabel heeft `tenant_id NOT NULL` en index.
- RLS default deny.
- Policies gebruiken `USING` én `WITH CHECK` waar relevant.
- Tenant-aware composite foreign keys waar cross-tenant referenties mogelijk zijn.
- Helperfuncties in private schema, niet publiek exposed.
- `SECURITY DEFINER` alleen waar nodig, met expliciete `search_path`.
- Tests bewijzen tenant A kan tenant B niet lezen/schrijven.
- Storage paden: `tenants/{tenant_id}/assets/{asset_id}/...`.

## 8. Playerregels

- Startup controleert last-known-good release.
- Online sync mag playback niet blokkeren wanneer lokale release geldig is.
- Nieuwe release wordt volledig gedownload en geverifieerd.
- Switch gebeurt op item- of loopgrens.
- Corrupt pending asset activeert geen nieuwe release.
- Video autoplay standaard muted.
- Browserchrome, cursor en media controls zijn niet zichtbaar tijdens playback.
- Diagnostics zijn secundair en niet automatisch over publieke content.

## 9. Testgates per PR

Minimaal:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Wanneer database geraakt wordt:

```bash
pnpm db:reset
pnpm test:rls
```

Wanneer UI geraakt wordt:

```bash
pnpm test:a11y
pnpm test:e2e -- --project=chromium
```

Wanneer player geraakt wordt:

```bash
pnpm test:player
pnpm test:player:offline
```

## 10. Definition of done

Een taak is pas klaar wanneer:

- relevante tests groen zijn;
- documentatie of task ledger is bijgewerkt;
- geen unrelated diffs bestaan;
- UI voldoet aan designcanon;
- server-side permissions bestaan;
- migrations rollback/forward zijn begrepen;
- known limitations expliciet gerapporteerd zijn.
