# ADR 0013 — Manifestgedreven theme-engine v2

- Status: accepted
- Datum: 2026-08-20
- Scope: dynamische slides, Control, Publisher-preview, browser/LG Player en thumbnails

## Besluit

`packages/content-templates/src/THEME-MANIFEST.v1.json` is de enige catalogusbron
voor de tien selecteerbare v2-thema’s. `@veyocast/contracts` valideert ID’s,
semver, fontreferenties, motion, canvassen en visuele toleranties. De registry
wordt tijdens module-initialisatie uit dit manifest opgebouwd en faalt gesloten
bij divergentie.

Control slaat een `PersistedThemeRef` plus `ThemeModePolicy` op. De server
resolveert fixed, schedule of auto bij het maken van een immutable snapshot en
bevriest het resultaat als `ResolvedModeSnapshot`. Playercode leest geen
mutable tenantinstellingen en gebruikt geen klok om een bestaande release te
herinterpreteren.

De gedeelde `EditorialArenaRenderer`, `createDynamicTemplateView` en
`themeToEditorialTokens` vormen de rendergrens voor Control-preview, gewone
Player, Publisher-preview en de primaire Chromium-thumbnail. De worker-PNG
blijft een technische fallback. Vaste canvassen zijn 1920×1080 en 1080×1920;
alle schaling blijft container- en contain-gedreven.

## Legacy en conversie

Oude `editorial-arena`-slides blijven `catalog: legacy` in nieuw gebouwde
snapshots. Gewone inhoudsupdates converteren ze niet. Alleen
`convert_dynamic_slide_theme_v2` mag met capabilitycheck, expected revision en
audit-event een mutable slide expliciet omzetten. Gepubliceerde releases worden
niet bijgewerkt.

## Beveiligingsgrens

Tenantstandaarden en broncategorie-overrides zijn tenantgebonden. De tabel voor
overrides forceert RLS; alleen read wordt aan `authenticated` gegrant. Alle
mutaties lopen via SECURITY DEFINER-RPC’s met lege `search_path`, capability,
actieve-tenantcheck, inputvalidatie, optimistic concurrency en audit.

## Consequenties

- Fontbytes en OFL-licentie zijn lokaal en SHA-256-gelocked.
- Goldenwijzigingen vereisen benoemde designgoedkeuring én manifest-semver.
- Poll/CTA heeft geen goedgekeurd providercontract en blijft uitsluitend de
  expliciete `poll_cta_fixture`-matrixcel; de UI claimt geen live koppeling.
- Fysieke LG-acceptatie blijft een externe gate en mag niet door Chromiumbewijs
  worden vervangen.
