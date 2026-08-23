# S122 — Dynamic slide versioning, theme default en Sportlink-wizard

## Doel

Maak Menu Studio- en alle getypeerde Sportlink-slides veilig wijzigbaar via een
nieuwe immutable ontwerpversie, zonder het logische slide-id, playlistplaatsingen
of historische releases te vervangen. Maak tegelijk tenant-default thema's
zichtbaar en herontwerp de Sportlink bulkflow rond team × type, context, thema,
preview en review.

## Invarianten

- `dynamic_slides` blijft het stabiele logische library- en playlistobject.
- Ontwerp/configuratie verandert uitsluitend in een version draft; providerdata
  blijft dezelfde gepubliceerde versie via nieuwe immutable snapshots verversen.
- De current-pointer wisselt pas nadat de nieuwe snapshot volledig ready is.
- Oude playlistreleases blijven naar hun concrete historische snapshot wijzen.
- Maximaal één open draft per logische slide; herhaald klikken hervat die draft.
- Thema is expliciete versionconfiguratie. Tenantdefault is alleen een
  creation-default en wijzigt bestaande versies nooit.
- Bestaande output zonder V2-theme blijft als legacypresentatie pixelvast.
- Provider/generated assets verschijnen niet als gewone gebruikersmedia.
- Player last-known-good, offline en veilige grenswissel blijven intact.

## UX

De Sportlink-flow heeft vijf stappen: Wat wil je tonen, Teams & slides,
Competitie & poule, Thema & weergave, Controleren & aanmaken. Desktop gebruikt
een matrix; mobiel equivalente cards. Het aantal slides en de preview blijven
zichtbaar. Teamcontext kan op alle team-slides worden toegepast en per slide
worden overschreven. Eén visuele `ThemePicker` wordt gedeeld door Settings,
Menu Studio en Sportlink.

## Gates

Verse database-reset, volledige RLS-suite, workspace lint/typecheck/unit/build,
relevante a11y/E2E/visual-tests, Player- en offline-tests, daarna exact dezelfde
geteste SHA via de officiële staging- en productionreleaseketen promoveren en
beide omgevingen inclusief observability verifiëren.
