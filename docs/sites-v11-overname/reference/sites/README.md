# VeyoCast — Sites UI/UX prototype

Interactive Dutch reconstruction of the VeyoCast FieldFlow control experience.

## Source and visual references

- Source repository: https://github.com/veyocast/platform
- Read-only source revision: `6fcc26f02c8050b7244e3660a93b85f02491e121`
- Visual basis: accepted FieldFlow S145 screenshots for overview, screens, planning and Studio; source marketing page.
- Original approved SVG brand assets, Inter/Manrope fonts, semantic tokens and FieldFlow photographs are reused. Overview and principal screen/planning CSS are derived from the source interface.
- The source GitHub repository was not modified.

## Included

Overview, Studio library and editor, screen management and groups, planning, media library, playlists and demo publications, data sources, sponsors, Engage polls, team, settings, account, activity, support, platform overview and public marketing view. The primary navigation, mobile menu, command search and dialogs are interactive.

Open the Site to start at the control dashboard. Navigation is hash based (`/#/dashboard/studio`) so the entire preview is self-contained.

## Prototype behavior

Local edits persist in browser localStorage with the `veyocast-demo-` prefix. Image uploads remain local. Publishing, device connection, provider configuration, invitations and tickets are simulations; they do not call Supabase, Sportlink, e-mail, payment providers, production devices or the production platform. Demonstration metrics and seeded events are example data. The UI is not an implementation of production authentication, authorization, player offline caching, background rendering or native apps.

## Functional expansion — October 2026

The refreshed design is retained while bringing more source-platform workflows into the prototype:

- LED Scores: multiple demo connections, club/team mapping, test events, live score and goal/match-moment Studio wizards, own/opponent variants and saved destination preferences.
- Sportlink: guided configuration, teams, dataset policies, birthdays opt-in and bulk design creation for programme, results, standings, visitor/referee welcome and birthdays.
- Shared design controls: uploaded or existing backgrounds, full/split/sidebar layouts, portrait/landscape, text scale, contrast, safe margins, colours, duration and paginated previews.
- Screens: guided creation, configurable main/sidebar/footer zones, group application, actual playlist/design previews and synchronized assignments.
- Planning: guided setup and overlapping target/recurrence checks.
- Studio: all 11 general template categories in both orientations, house style/logo, layout controls and exact design snapshots into playlists.
- Content: folders, tags, collections, favourites, archive/restore, bulk actions, playlist import, real demo screen inventory and version snapshots.
- Twelve/Menu: product management, reviewed CSV import and a menu design wizard. YouTube: validated URL configuration with a chosen fallback image.

Uploaded images are resized and stored as blobs in IndexedDB (`veyocast-assets`). Designs reference those assets without duplicating image data in each saved snapshot. Clearing site data removes these local edits and images. Existing localStorage data is retained.

See [the feature audit](docs/feature-audit.md) for source evidence and scope boundaries.

## OnzeTrots brush backgrounds

LED Scores uses five art-directed blue-and-white OnzeTrots compositions in `public/onzetrots/premium/`. The club building, harbour light, church, aerial view and historic gate are woven into layered brushwork, distressed ink and painted paper. The original photographs guide the identity, proportions, perspective and distinguishing details of each landmark; the finished backgrounds are expressive painted collages.

The visual direction follows the user's clarified preference: immediately recognizable places, with the full OnzeTrots brush/grunge character and a composed backdrop for scores and headings. Each raster artwork was generated from its landmark reference and the site's visual style. `public/onzetrots/premium/sources.json` records the source references, prompts and output files. See [the background process](docs/onzetrots-background-process.md) for the composition brief.

The untouched reference files remain in `public/onzetrots/originals/`; `sources.json` records their dimensions and SHA-256 values. The church upload contained JPEG data despite its `.webp` filename and is retained as `.jpg` without conversion.

The LED background picker prioritizes these compositions. Brush headings, distressed score type and CSS paint edges remain separate from the artwork. All five original built-in paths, the five earlier brush SVG paths and the two earlier painted paths resolve to the corresponding premium composition, preserving the selected landmark in saved designs and playlist previews. Custom images and uploads pass through unchanged. Earlier SVG assets remain available for version history but are no longer the active presets.

## Development

Uses the Sites Vinext starter, TypeScript, React, lucide-react and CSS modules.

- Typecheck: `node node_modules/typescript/bin/tsc --noEmit`
- Build: `node /root/.codex/plugins/cache/openai-curated-remote/sites/1.0.0/scripts/build-site.mjs`

Publishing follows the Sites source synchronization and private deployment workflow.
