# Start hier

## Actuele uitvoeringsroadmap

De canon alignment, Control-herontwerp, productiongates en post-pilot
productontwikkeling zijn per sprint uitgewerkt in
`docs/canon-alignment-product-roadmap.md`. De paste-ready startprompts voor
S20-S37 staan in `prompts/sprints/`.

Begin niet met bouwen van features. Start met:

1. lokale runtime valideren;
2. monorepo neerzetten;
3. design tokens + UI foundation;
4. database/RLS fundament;
5. daarna verticale MVP-flows.

## Eerste Codex-prompt

Gebruik `prompts/master-orchestrator.md`.

## Eerst alle UI/UX bouwen?

Nee. Bouw eerst het designsysteemfundament en daarna verticale flows. De belangrijkste UX van VeyoCast ontstaat uit echte domeinstatus: actieve release, gewenste release, syncstatus, storage, pairing, media processing, RLS-permissions en offline-playergedrag.
