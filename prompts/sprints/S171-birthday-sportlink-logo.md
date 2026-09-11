# S171 — Verjaardagen premium en dagelijkse Sportlink-logo-controle

## Doel

Maak de bestaande Sportlink-verjaardagsslide productiewaardig voor Royal
Current/Navy Glass in landscape en portrait. Toon alleen de bestaande
verjaardagskaartfamilie met een consistente premium kaartcompositie, een
optionele team/functieregel en de vaste kaartkeuzes 1, 2, 4 of 6. Meer records
worden over pagina's verdeeld; gegevens mogen niet stil verdwijnen.

De Sportlink `club_profile`-groep controleert eenmaal per dag ook het officiële
tenantlogo. Provider-assets blijven content-addressed en immutable: dezelfde
bytes hergebruiken de bestaande versie, gewijzigde bytes krijgen een nieuwe
versie en het tenant-clubrecord wordt bijgewerkt.

## Grenzen

- Geen nieuwe slidefamilie, avatars of monogrammen.
- Geen wijziging aan immutable releases of player-offline/LKG-invarianten.
- Gebruik de gedeelde token- en themacontracten voor light/dark en beide
  oriëntaties.
- De dagelijkse controle mag geen nieuwe snapshot/release veroorzaken als de
  logo-inhoud gelijk is.

## Gates

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm db:reset`
- `pnpm test:rls`
- UI-a11y/E2E en Player-regressietests voor de gewijzigde renderpaden
