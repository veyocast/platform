# S30-K Control calmness en workspacejourneys — evidence

## Geleverd

- Dashboard zet maximaal vijf concrete acties vóór de compacte samenvatting;
  oorzaak, effect en herstel openen in een detailsheet.
- Headers tonen standaard titel, korte uitleg en één primaire actie. Routineuze
  successtatussen zijn verwijderd.
- Media is bibliotheek-eerst, met één uploaddialoog, inspector en een
  tenantgescopeerde globale uploadtray die tijdens verwerking blijft verversen.
- Playlists worden via één dialoog leeg, als veilige conceptkopie of vanuit een
  eenvoudig basisconcept aangemaakt.
- Playlist Studio heeft één sticky werkbalk voor opslagstatus, preview en
  publiceren; iteminstellingen openen alleen voor het geselecteerde item.
- Schermen staan standaard op actieprioriteit. Instellingen hebben
  categorienavigatie en een savebar die alleen bij gewijzigde waarden verschijnt.
- Platform- en tenantcontext tonen ieder uitsluitend hun eigen navigatie.
- Light, dark en system theme, normale/compacte dichtheid en persoonlijke
  tabelkolommen worden zonder themaflits lokaal bewaard.
- Dialog, Sheet, FilterBar, SummaryStrip, TablePreferences en DataTable zijn
  gedeelde `@veyocast/ui`-patronen; lokale Control-forks zijn verwijderd.
- Motion gebruikt korte overgangen en valt volledig terug bij
  `prefers-reduced-motion`.

## Security en datacontract

`public.duplicate_playlist_draft_v1` vereist een ingelogde actor en
`private.can_write_playlist` op de brondraft. De functie maakt een nieuwe
revision-0-draft, kopieert alleen conceptmetadata en items, schrijft een
audit-event en neemt geen releases of schermtoewijzingen over. De functie heeft
een vaste lege `search_path`; alleen `authenticated` heeft execute-recht.

De globale uploadtray leest uitsluitend actieve media van de huidige
`tenant_id` via de bestaande RLS-browserclient. Er is geen service-rolegrens
naar de client verplaatst.

## Lokale verificatie

- `pnpm db:reset` — geslaagd.
- `pnpm test:rls` — 19 bestanden, 325 tests, geslaagd.
- `pnpm lint` — 20/20 taken geslaagd.
- `pnpm typecheck` — 20/20 taken geslaagd.
- `pnpm test` — 20/20 taken geslaagd; onder andere 13 UI- en 45 Control-tests.
- `pnpm build` — 13/13 workspacebuilds geslaagd.
- `pnpm test:a11y` — 21/21 Chromium-tests geslaagd.
- `pnpm test:e2e -- --project=chromium` — 67 geslaagd, 2 live-tests bewust
  overgeslagen zonder opt-in.
- `VEYOCAST_LIVE_PILOT=1 ... playlist-studio-live.spec.ts` — echte lokale
  tenantjourney voor upload, concurrency, publicatie en veilige duplicatie
  geslaagd.
- Aanvullende responsive Control-matrix — 24/24 tests geslaagd.

## Bewuste grenzen

- Thema, dichtheid en tabelkolommen zijn persoonlijke browservoorkeuren. Sync
  tussen apparaten vraagt een afzonderlijke privacy- en datamodelkeuze.
- `Template` biedt nu veilige, lege basisconcepten. Door tenants beheerde,
  herbruikbare templates blijven onderdeel van de bredere S31-productscope.
- De tray volgt maximaal tien actieve uploads en verdwijnt wanneer verwerking
  klaar is; historische verwerking blijft in Media zichtbaar.
- Player- en offlinecode zijn niet gewijzigd.
