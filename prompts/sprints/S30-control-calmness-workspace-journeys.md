# S30-K — Control calmness en workspacejourneys

## Doel

Maak Control rustiger, consistenter en taakgerichter zonder tenantbeveiliging,
immutable releases of bestaande authoringflows te verzwakken.

## Verplicht lezen

- standaard AGENTS-leesvolgorde;
- `docs/design-implementation-canon.md`;
- `docs/design-canon/v1/VEYOCAST_DESIGN_CANON_v2.0.md`;
- `docs/adr/0008-control-resource-routes-and-journeys.md`;
- S23-S29 Control-evidence.

## Scope

- actie-eerst dashboard en compacte actie-inbox met detailsheet;
- rustige headers, samenvattingen en statusgebruik;
- één gedeeld filter-, toolbar-, button-, dialog- en sheetpatroon;
- volledig light/dark/system-thema en persoonlijke tabeldichtheid/kolommen;
- exclusieve platform- of tenantnavigatie per routecontext;
- bibliotheekgerichte Media met één uploaddialoog, inspector en globale tray;
- playlistcreatie via Leeg, Dupliceren of een veilig basisconcept;
- Playlist Studio met één sticky editorbalk en geselecteerde iteminstellingen;
- actiegerichte schermvloot en gecategoriseerde instellingen met dirty savebar;
- mobiele taakvolgorde zonder clipping of KPI-stapeling;
- subtiele motion van 140–220 ms met reduced-motionfallback;
- playlistduplicatie als nieuwe revision-0-draft zonder releasehistorie of
  schermtoewijzingen.

## Acceptatie

- iedere pagina heeft maximaal één primaire headeractie;
- normale successtatussen nemen geen blijvende prominente ruimte in;
- dashboardacties staan vóór samenvattende cijfers;
- platform- en tenantnavigatie zijn nooit tegelijk zichtbaar;
- dialogs en sheets komen uit `@veyocast/ui`;
- actieve uploads blijven bij navigatie tenantgescopeerd zichtbaar;
- tabelvoorkeuren en thema overleven een reload;
- instellingen tonen de savebar pas na een wijziging;
- 320, 390, 768, 1024, 1100, 1280 en 1440 px hebben geen paginabrede
  horizontale overflow;
- RLS bewijst dat dupliceren alleen binnen de toegestane tenantcontext kan;
- lint, typecheck, unit, build, RLS, accessibility en Chromium-gates zijn groen.

## Non-goals

- releasehistorie of schermtoewijzingen kopiëren;
- een nieuw mutable releasemodel;
- tenanttemplates of persoonlijke voorkeuren stilzwijgend server-side
  synchroniseren zonder apart product- en privacymodel;
- player- of offlinegedrag wijzigen.
