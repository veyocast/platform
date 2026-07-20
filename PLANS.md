# VeyoCast MVP Plan

## Werkmodus

VeyoCast wordt lokaal gebouwd met Codex in geïsoleerde Git-worktrees. GitHub blijft de bron van waarheid. Elke taak krijgt:

- één branch;
- één primaire writer-agent;
- duidelijke path ownership;
- lokale gates;
- review;
- PR.

## MVP-doel

De MVP is pilot-ready wanneer:

- multi-tenant auth en RLS bewezen zijn;
- platformadmin en tenantadmin de kernflows kunnen uitvoeren;
- media upload en processing werken voor afbeeldingen en MP4/H.264-video;
- playlists als concept bewerkbaar zijn;
- publiceren een immutable release maakt;
- schermen en player-devices via pairing worden gekoppeld;
- player online en offline fullscreen speelt;
- nieuwe releases atomisch worden gedownload, geverifieerd en pas daarna geactiveerd;
- player na netwerkverlies, herstart en corrupt pending asset blijft functioneren;
- designcanon zichtbaar is toegepast;
- launchgates groen zijn.

## Sprintoverzicht

| Sprint | Naam | Resultaat |
|---|---|---|
| S00 | Canon, repo en lokale runtime | Monorepo, docs, gates, lokale scripts |
| S01 | Design system foundation | Tokens, UI-package, Storybook, placeholder assets |
| S02 | Auth, tenancy, roles en RLS | Supabase schema, RLS, memberships, tests |
| S03 | Platform en tenant shell | Control app shell, rollen, dashboards |
| S04 | Media upload en processing | Storage, media assets, uploadqueue, worker shell |
| S05 | Playlists en release model | Drafts, playlist items, immutable releases |
| S06 | Screens, devices en pairing | Schermen, player devices, pairingflow |
| S07 | Online player playback | Manifest fetch, image/video loop |
| S08 | Offline cache en atomic updates | Cache, IndexedDB, verification, fallback |
| S09 | Control dashboard polish | Media/playlist/screen UX volgens canon |
| S10 | Marketing shell en landingpage | VeyoCast homepage en SEO-basics |
| S11 | Security, accessibility en reliability gates | RLS, axe, Playwright, player reliability |
| S11-B | Enterprise Control UX | Operational app shell, resource workflows and responsive Control QA |
| S12 | Pilot-ready local MVP | End-to-end local pilot, docs, release checklist |
| S13 | LG webOS capability hardening | Device Lab, watchdog en fysiek testprotocol |
| S14 | Playback- en mediareadiness | Periodieke sync, veilige cache-GC en uitvoerbare MP4-workerqueue |
| S15 | LG-koppelklaar hosted product | Echte schermvloot/pairing en reproduceerbare Docker/Caddy-deployment |
| S16 | Control authoring MVP | Live media, playlists, instellingen en mixed-media publicatie |
| S17 | VPS staging en production | Gescheiden Compose-stacks, self-hosted runners en Supabase-migratiedeployment |
| S18 | VeyoCast-rebrand | Productnaam, namespaces, assets, bestaande data en canon veilig overzetten |
| S19 | VPS deployment finalization | Immutable main → staging → approval → production met host-Caddy, rootless Docker en veilige rollback |

## Uitgebreid programma na S19

De volledige uitvoeringsscope, werkpakketten, securityvoorwaarden, UX-journeys,
tests en exitcriteria staan in
[`docs/canon-alignment-product-roadmap.md`](docs/canon-alignment-product-roadmap.md).

| Sprint | Naam | Resultaat |
|---|---|---|
| S20 | Canon en application boundaries | Eén VeyoCast-canon, contracts/domain/auth-packages en toetsbare dependencyrichting |
| S21 | Identity, tenantcontext, capabilities en MFA | Expliciete tenantselectie, centrale capabilities, AAL2 en statusafdwinging |
| S22 | Platform lifecycle en teambeheer | Complete tenantprovisioning, lifecycle, limieten, invitations en rollen |
| S23 | Control UX-fundering | Nieuwe informatiearchitectuur, shared UI, responsive shell en resourcepatronen |
| S24 | Media workspace | Gepagineerde lijst/raster en inspector, veilige TUS-resume, processingherstel en asset→draft→release→scherm-gebruik |
| S25 | Playlist Studio | Gescheiden editor, optimistic concurrency en centrale publicatiegereedheid |
| S26 | Release Center | Releasehistorie, vergelijking, impactanalyse, schermpreflight en guided publish |
| S27 | Schermvloot en onboarding | Transactionele screen lifecycle, pairingjourney, detail en devicebeheer |
| S28 | Operationeel dashboard | Actie-inbox, echte globale search, onboardingchecklist en contextuele help |
| S29 | Production operations | Worker deployment, observability, SLO's, alerts, restore en veilige supportbundle |
| S30 | Pilot RC gate | Live critical journey, 24-uurs soak, fysieke LG-, security-, a11y- en DR-gates |
| S31 | Productiviteitsfeatures | Bulkacties, templates, playlistduplicatie en opgeslagen views |
| S32 | Groepen en planning | Schermgroepen, schedules en eenvoudige offline-safe dayparting |
| S33 | Integration framework | Server-only adapters, syncjobs en immutable offline widgetsnapshots |
| S34 | Provider discovery | Official-only Sportlink/Twelve go/no-go en uitsluitend goedgekeurde POC's |
| S35 | Billing | Mollie, reconciliation en scherm-entitlements zonder offline blackout |
| S36 | Advertentienetwerk | Optionele deterministische ads, proof en revenue share na legal/product GO |
| S37 | Researchhorizon | Begrensde go/no-go discovery voor AI, wrappers, LAN relay en latere opties |

### Programmagates

- S20-S22 herstellen eerst trust, context en beheer.
- S23-S28 herontwerpen Control rond echte klantjourneys.
- S29-S30 zijn verplicht vóór een brede pilotclaim.
- S31-S32 zijn post-pilot productiviteitswerk.
- S33-S36 starten alleen na hun expliciete provider/commerciële entry gates.
- S37 levert beslisdocumenten en prototypes, geen stilzwijgende productclaims.

## Parallelle waves

Zie `docs/sub-agent-orchestration.md`.
