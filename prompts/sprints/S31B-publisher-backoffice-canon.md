# S31-B — Publisher en tenant-backofficecanon

## Doel

Voer `docs/design-canon/v1/VEYOCAST_PUBLISHER_BACKOFFICE_CANON_v1.0.md`
end-to-end uit zonder bestaande tenantisolatie, immutable releases,
playercompatibiliteit of last-known-good playback te verzwakken.

## Verplicht lezen

- standaard AGENTS-leesvolgorde;
- `docs/adr/0008-control-resource-routes-and-journeys.md`;
- S23-S30 Control- en Playerevidence;
- S31- en S32-roadmapsecties.

## Uitvoeringsfasen

1. canonintegratie, nulmeting en route-/contractmatrix;
2. donkere tenant-shell, lichte/donkere werkruimte en mobiele navigatie;
3. Publisher-overzicht, media, playlists, schermen en activiteit;
4. desktop/mobile Playlist Studio, iteminstellingen, autosave en preview;
5. additieve authoringvelden, templates, groepen en planning;
6. immutable restore-as-new-version, targetprovenance en syncstatus;
7. beheer-PWA, offline conceptherstel en veilige reconnect;
8. consistentie, screenshots, accessibility, performance en releasebewijs.

## Niet onderhandelbaar

- oude manifest-v1-releases en gekoppelde Players blijven werken;
- nieuwe databasecontracten zijn additief en versioned;
- publiceren blijft online en serverbevestigd;
- geen zichtbare functie zonder echte data- en permissiongrens;
- PDF, arbitrary webcontent en integratiecontent blijven verborgen totdat een
  playercompatibel contract bestaat;
- mobiel is een sequentiële flow, geen verkleinde desktopeditor;
- alle primaire Orange-knoppen gebruiken Ink Black tekst.

## Gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:reset
pnpm test:rls
pnpm test:a11y
pnpm test:e2e -- --project=chromium
pnpm test:player
pnpm test:player:offline
```
