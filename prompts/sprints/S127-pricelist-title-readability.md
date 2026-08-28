# S127 — Prijslijsttitels leesbaar op afstand

## Doel

Maak producttitels in alle actuele prijslijstweergaven duidelijk groter,
zonder lange productnamen af te breken, bestaande releases te muteren of
browser en LG Legacy visueel uit elkaar te laten lopen.

## Scope

- Vergroot korte producttitels in Menu Studio v2 en Editorial Arena.
- Gebruik één deterministische `default`/`compact`/`dense`-indeling op basis
  van de genormaliseerde titellengte.
- Pas dezelfde drempels en visuele maten toe in de browserrenderer en de
  statische LG Legacy-renderer.
- Geef portrait meer verticale ruimte per product en pagineer eerder wanneer
  dat nodig is.
- Leg de wijziging vast in unit-, browser-, LG- en visuele regressietests voor
  alle tien thema's, beide modi en beide oriëntaties.

## Buiten scope

- Vrije fontuploads of een onbegrensde tenanttypografie-editor.
- Database-, RLS-, snapshot- of publicatiecontractwijzigingen.
- Mutatie van bestaande immutable playlistreleases.
- Een claim over fysieke LG-hardware zonder een Device Lab-run.

## Acceptatie

- Korte Menu Studio-titels zijn 34 px op landscape en 32 px op portrait.
- Middellange en lange namen schalen begrensd naar respectievelijk compact en
  dense, zonder scène-overflow.
- De bestaande gecureerde themalettertypes blijven beschikbaar en intact.
- Portrait verdeelt twintig producten over twee pagina's in plaats van de
  content te verkleinen.
- Browser- en LG-regressies bewijzen dezelfde drempels en maten.
- Alle verplichte workspace-, UI-, Player- en offlinegates zijn groen voordat
  de taak naar review gaat.
