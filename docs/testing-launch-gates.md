# Testing and Launch Gates

## PR gates

- lint
- typecheck
- unit tests
- build affected apps
- database reset if migrations touched
- RLS tests if DB touched
- Playwright smoke if UI touched
- axe/accessibility checks if UI touched

## RLS gates

- anonymous denied;
- cross-tenant denied;
- role capabilities enforced;
- storage path spoofing denied;
- player access scoped.

## Player reliability gates

- boot with cached release while offline;
- network loss during image playback;
- network loss during video playback;
- corrupt pending asset;
- insufficient storage;
- restart recovery;
- power-loss simulation where possible;
- 24-hour mixed-media soak before pilot.

## Design gates

- tokens used;
- uitsluitend officiële logo- en iconvarianten uit de centrale assetmap;
- no hardcoded brand colors;
- no white text on orange primary button;
- mobile is not mini-desktop;
- player normal playback has no browser chrome and only the approved locked
  VeyoCast lock-up at 40% opacity in the lower-left corner.
