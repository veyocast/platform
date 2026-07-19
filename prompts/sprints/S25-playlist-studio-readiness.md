# S25 - Playlist Studio, concurrency en readiness

## Doel

Splits playlistlijst en editor, voorkom lost updates en maak één canonieke
publicatiegereedheidsberekening voor UI en server.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S25
- immutable release- en media/playercanons

## Scope

- playlist list/detail/editorroutes;
- desktop workspace en sequentiële mobile flow;
- keyboard reorder, duration, fit, muted, preview en dirty-statebescherming;
- optimistic revision token en typed conflict recovery;
- pure readiness reason codes en herstelacties;
- concurrency-, previewparity- en golden tests.

## Acceptatie

- twee editors overschrijven elkaar nooit stilzwijgend;
- UI en publishservice gebruiken exact dezelfde readinessregels;
- not-ready/cross-tenant media kan niet publiceren;
- preview blijft compatibel met playercontract;
- database-, E2E-, a11y- en foundationgates zijn groen.

## Non-goals

- release center en schermpreflight uit S26;
- multi-zone editor.
