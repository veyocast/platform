# Functional audit and UI expansion

Source: `veyocast/platform`, revision `6fcc26f02c8050b7244e3660a93b85f02491e121`. Audited 10 October 2026. The source repository was not modified. This implementation updates the existing Sites prototype and preserves its visual design.

| Area | Gap in first prototype | Added interaction | Source evidence |
| --- | --- | --- | --- |
| LED Scores source | Single generic settings card | Multiple demo connections, three-step club/scoreboard/team setup, pause/test, example events | `apps/control/app/(shell)/dashboard/data-sources/led-scores/page.tsx` |
| LED Scores Studio | Absent | Five-step live-score, goal and match-moment design flow, own/opponent styles, timing, preview, backgrounds, destination selection | `studio/led-scores/alert-editor.tsx`, `live-match-slide-editor.tsx`, `goal-overlay/editor.tsx`, `canvas-experience-editor.tsx` under the control dashboard |
| Sportlink source | Generic settings form | Guided demo setup, team selection, per-dataset sync policy, example refresh, birthdays opt-in | `data-sources/sportlink/page.tsx`, `birthday-integration-panel.tsx` under the control dashboard |
| Sportlink Studio | Absent | Multi-team/type wizard, programme/results/standings/welcome/birthdays, configurable fields, row pagination, bulk save | `studio/sportlink/new/sportlink-bulk-wizard.tsx`, `studio/sportlink/birthdays/new/birthday-wizard.tsx`, `slides/_components/sportlink-arrival-fields.tsx` |
| General Studio | Limited templates and fixed photographs | Eleven categories in both orientations, four layouts, uploaded backgrounds, house style, logo, exact playlist snapshots | Source Studio template catalog, `studio/brand-kit-dialog.tsx`, `studio/[designId]/studio-editor-workspace.tsx` |
| Screens | One creation form, no zone composer | Creation/review wizard; fullscreen, sidebar, bottom bar and three-zone layouts; per-zone playlist/design selection; group application | Source screen setup, group and screen detail routes; zone composer is a prototype UX extension |
| Planning | Monolithic form and no target conflict checks | Three-step wizard, shared-target and repeating-time conflict checks, actual screen schedules | Source planning route and scheduling contracts |
| Media/playlists | Simplified library and disconnected Studio | Folders/tags/collections/favourites, usage, archiving, bulk actions, accurate saved Studio previews, direct insertion and real demo screen assignments | Source MediaLibraryWorkspace, PlaylistLibraryWorkspace, PublisherStudioWorkspace |
| Twelve/Menu | Generic source card, no products or menu wizard | Product editing, availability/categories/prices, CSV validation/review, ordered menu design wizard and playlist insertion | `integrations/twelve-products`, `slides/menu-studio` under the control dashboard |
| YouTube | Generic settings card | Validated video/playlist URLs, required fallback image, source editing and pause/resume | Source YouTube setup route |

## Boundaries

This remains an interactive UI prototype with local state. Provider tests/sync/events, screen publications and pairing are explicit simulations. No production credentials, webhooks, websocket worker, Sportlink/Twelve/YouTube API connection, Supabase integration or physical player delivery were added.

This is not full production parity. The original platform additionally has server-side role/access controls, audit/operations, player caching, immutable rendering/delivery, background jobs, billing and native apps. Detailed free-layer Konva tools, LED intro video/audio/player photographs, multi-page freeform menu documents and Twelve XLSX import remain outside this guided variant. Source-supported themes, sponsor delivery proof and advanced Engage/player features are not represented completely.

## Verification

- TypeScript project check.
- Focused checks for recurring schedule/target conflicts, Sportlink generated rows/filters and CSV/YouTube validation.
- Shared CSS-module references and build validation.
- Integration review of saved design snapshots, pagination, actual screen targets and screen layout assignment consistency.

No browser or device playback verification was available in this task environment. The deployment is a Sites web prototype, not a production-player release.

## Mobile playlist workflow

The playlist workflow now uses one full-height editor on phones, with a compact library, direct media insertion and a first-level mobile navigation entry. The editor contains content, preview, details and screen publication steps rather than stacked dialogs. Touch ordering, multi-item duration changes, duplication, removal with undo, guarded closing and the existing publication snapshots are retained.

The media picker supports ordered selection across the image library, complete Studio projects and saved dynamic designs; search, folders, favourites, upload progress and per-file failures; and one explicit batch insertion. Uploads remain image-only and browser-local. The standalone media library also has larger touch targets and a compact phone layout.

Verification includes TypeScript, source integration review, and injected storage failures at all three publication writes, including rollback, newly created key cleanup and blocked storage. Live browser/device layout and interaction checks remain unavailable in the managed environment.
