# Castivo MVP Plan

## Werkmodus

Castivo wordt lokaal gebouwd met Codex in geïsoleerde Git-worktrees. GitHub blijft de bron van waarheid. Elke taak krijgt:

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
| S10 | Marketing shell en landingpage | Castivo homepage en SEO-basics |
| S11 | Security, accessibility en reliability gates | RLS, axe, Playwright, player reliability |
| S11-B | Enterprise Control UX | Canon v1.0.0, operational app shell, resource workflows and responsive Control QA |
| S12 | Pilot-ready local MVP | End-to-end local pilot, docs, release checklist |
| S13 | LG webOS capability hardening | Device Lab, watchdog en fysiek testprotocol |
| S14 | Playback- en mediareadiness | Periodieke sync, veilige cache-GC en uitvoerbare MP4-workerqueue |

## Parallelle waves

Zie `docs/sub-agent-orchestration.md`.
