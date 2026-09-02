# Sprint S144 — FieldFlow productplatform en slide-output

## Doel

Voer de twee door de opdrachtgever aangeleverde FieldFlow-handoffs als één
complementair programma uit. Werkstroom A herontwerpt de complete zichtbare
VeyoCast-productervaring. Werkstroom B vult het daarin gereserveerde
slide-/Player-outputdomein volledig in. De expliciete opdracht van 2 september
2026 autoriseert implementatie, push, PR, merge en deployment; beveiligde
omgevingsgoedkeuringen en fysieke hardware-acceptatie blijven echte externe
gates.

## Normatieve bronnen

1. Repo-governance en canons uit `AGENTS.md`, in de verplichte leesvolgorde.
2. `VEYOCAST-FIELDFLOW-COMPLETE-PLATFORM-REDESIGN-HANDOFF.md`, inclusief het
   ingebedde autonome masterprompt in sectie 28.
3. `CODEX_AUTONOMOUS_PROMPT.md` plus het complete
   `veyocast-fieldflow-handoff.zip` voor slidecoverage en acceptatie.
4. `VEYOCAST-FIELDFLOW-COMPLETE-TRANSFER-PACKAGE.zip` voor goedgekeurde
   FieldFlow-beeldassets, provenance en derivatives.
5. De opdracht van de gebruiker gaat vóór deploybeperkingen in de handoffs,
   maar verruimt geen security-, privacy-, merk-, immutable-release- of
   offline-invarianten.

## Werkstroom A — volledige productervaring

- Maak vóór brede migratie de governance-ledgers in `docs/redesign/` en houd
  iedere route, feature, toestand, component, redirect en capabilitygap bij.
- Introduceer FieldFlow v3 als semantische token-/componentlaag voor web,
  native mobile en beheerchrome op TV. Respecteer de hogere locked-brandcanon:
  de primaire productactie blijft Electric Orange met Ink-tekst en locked
  logo-assets worden nooit gereconstrueerd of gewijzigd.
- Herbouw marketing, authenticatie, onboarding, tenant-Control, Publisher,
  alle formulieren/wizards/pickers, Studio, Sources, Sponsor, Engage,
  platformbeheer, Control Mobile en Player/Android/LG-beheerstatussen.
- Voer de voorgeschreven informatiearchitectuur in voor tenant, platform,
  marketing en mobiel. Behoud bestaande publieke deep links via één-hop
  redirects die query en hash bewaren.
- Herstel de ontbrekende account- en securityroutes, waaronder MFA, zonder
  client-side permissie-afdwinging.
- Gebruik uitsluitend echte repo-/runtimegegevens en de geleverde generieke
  FieldFlow-fotografie. Geen fictieve klanten, testimonials, integraties,
  prijzen of gesimuleerde UI in fotografie.
- Bewijs responsive gedrag, WCAG 2.2 AA, volledige keyboardbediening,
  zichtbare focus, status als tekst plus kleur/icoon, en oorzaak/gevolg/herstel
  in foutmeldingen.

## Werkstroom B — slide-, Player- en outputketen

- Maak `fieldflow` het enige zichtbare thema voor nieuwe en muteerbare
  content. Houd alle tien legacy theme-id's verborgen maar renderbaar voor
  historische immutable releases. Nooit backfillen of herschrijven.
- Draag elk veld aantoonbaar door contract, editor, schema, database/RPC,
  snapshot, assets, viewmodel, moderne renderer, statische LG-renderer,
  preview, thumbnail, poster, fallback en tests.
- Ondersteun alle bestaande en dormant dynamische typen, nieuwsvarianten,
  Menu Studio v2-blokken, aankomst-/verjaardagsopties, dubbele clublogo's,
  LED Scores match center en acht momenten, Engage-resultaten, YouTube-status
  en alle zes sponsorposities.
- Lever 22 Studio-templates: elf categorieën in landscape en portrait.
- Gebruik één bevroren resolved snapshot als bron voor moderne Player,
  Chrome-79-veilige statische LG-output, preview, poster en fallback.
- Bouw de FieldFlow-primitives, vaste 1920×1080-/1080×1920-safe grids,
  begrensde paginering en de motion-state-machine
  `IDLE → ENTERING → ACTIVE → EXITING`.
- Behoud raw media pixels, LKG-startup, non-blocking online sync, volledige
  download/verificatie en switch op item- of loopgrens. Een onvolledige of
  corrupte pending release wordt nooit actief; tijdelijk offline geeft nooit
  zwart zolang een geldige lokale release bestaat.

## Databank en security

- Alleen forward-only Supabase-migraties via `supabase migration new`.
- Nieuwe tenantdata heeft `tenant_id NOT NULL`, indexen, tenant-aware
  referenties en RLS default deny met `USING`/`WITH CHECK` waar relevant.
- Capabilities blijven server-side afgedwongen; service-role-materiaal komt
  nooit in browserbundels. Devices blijven installation-/device-identiteiten,
  geen Supabase Auth-users.
- Theme-schemawijzigingen zijn additief: `fieldflow` wordt toegestaan en
  default voor nieuw werk; legacy identifiers blijven geldig.
- Voeg pgTAP-regressies toe die tenant-A/tenant-B-isolatie en de volledige
  theme-/snapshotcompatibiliteit bewijzen.

## Verificatie en oplevering

- Minimaal groen: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
  `pnpm db:reset`, `pnpm test:rls`, lokale Supabase security-advisors,
  `pnpm test:a11y`, `pnpm test:e2e -- --project=chromium`,
  `pnpm test:player` en `pnpm test:player:offline`.
- Valideer alle routefamilies, formstates, slidefamilies, beide oriëntaties,
  moderne en statische LG-renderers, preview/poster/fallback en offline/LKG.
- Houd de aangeleverde acceptance checklist bewijsbaar bij; markeer alleen
  werkelijk niet-toepasbare of externe checks met reden. Een browseremulator
  is geen fysieke LG-acceptatie.
- Commit toetsbare eenheden, push de taakbranch, open en review één PR, merge
  exact de groene SHA en promoveer via de bestaande immutable
  main → staging → production-keten. Lees health, workers, pairing, release-
  en rollbackbewijs terug. Stop bij rode gates, credentials, beschermde
  approval, fysieke hardware of andere governance-stopcondities en rapporteer
  het concrete externe vervolg.

## Path ownership

De primaire agent is de enige writer voor deze taak en bezit de noodzakelijke
bestanden onder `apps/**`, `packages/**`, `supabase/**`, `tests/**`, `docs/**`,
`prompts/**`, `assets/**`, `scripts/**` en `.github/workflows/**`. Subagents
zijn uitsluitend read-only inventarisatie-/reviewagents. Onverwachte wijzigingen
buiten deze scope of wijzigingen door een andere writer zijn stop-and-report.
