# S297 — Eén Content-ingang

Basis: `da3d1242c92beedee3e8d8d8d2c8d35404ab4ae6`. Werkstroom A2 uit de overdracht van 9 november 2026. Deze wijziging raakt navigatie, de bibliotheekquery en aanmaakkeuzes. Bestaande records, publicatieversies, rendererbytes, bronselecties en planningen worden niet gemigreerd.

## Inventarisatie en behouden toegang

| Bestaand pad | Functie en behoud | Bestaande capability |
|---|---|---|
| `/dashboard/content` | Centrale bibliotheek: zes typen, aparte status, zoeken en serverpaginering | Eén van de bestaande Content-taakrechten; rows/counts alleen voor leesbare typen |
| `/dashboard/studio/new` | Dezelfde kiezer vanaf Content en Overzicht; `family`, `mode`, `group`, `source` blijven ondersteund | `tenant.studio.create` of `tenant.dynamic_slide.write` |
| `/dashboard/studio/{id}` | Origineel ontwerp en revisie, geen redirect | Bestaande Studio-objectrechten |
| `/dashboard/studio?advanced=1` | Ontwerpbeheer, exports/renderqueue, eigenaar, sortering, datumbereik en geavanceerde filters | `tenant.studio.read` |
| `/dashboard/studio` | Gewone lijst naar Content/Ontwerpen; `q` en actief/archief worden gemapt. Niet-equivalente filters blijven in de geavanceerde werkplek | `tenant.studio.read` |
| `/dashboard/media` | Mappen, tags, favorieten, upload/verwerking en gebruik blijven via contextlink beschikbaar | `tenant.media.read`; schrijfacties houden hun eigen guard |
| `/dashboard/content/media/{frameId}` en `/source/{assetId}` | Originele media/frame-identiteit, vastgezette versie en private preview | Bestaande media-objectrechten |
| `/dashboard/slides` en `/{id}`/versies | Contextlink houdt versie- en verwerkingshandelingen bereikbaar; objectroutes blijven exact | `tenant.dynamic_slide.read` en bestaande actie-/objectguards |
| `/dashboard/slides/menu-studio?pagina=N` | Alleen de index redirect naar Content/Menu’s, met originele paginagrootte24 en begrensde pagina | `tenant.dynamic_slide.read` |
| `/dashboard/slides/menu-studio/new` en `/{id}` | Standaard menutaak gebruikt de bestaande specialist. Producten, flags, menuversies en publicatiecontrole blijven daar | Bestaande Menu Studio-rechten en flags |
| `/dashboard/studio/new?family=menu` | Bestaande wizardvariant blijft bereikbaar, ook via Andere menu-opmaak in de kiezer | Bestaande handmatige/gekoppelde taakrechten |
| `/dashboard/slides/new?family=news` | Bestaande oudere RSS-handler blijft intact: OnzeTrots verwijst naar RSS-wizard; andere ondersteunde configuratie houdt eigen formulier | Bestaande slide-/bronrechten |
| `/dashboard/studio/led-scores?edit={id}` en `/goal-overlay` | Bestaande overlay-ID/versie/timing/targets blijven in hun eigen editor. Content leest alleen minimale lijstvelden na effectieve featurecheck | `tenant.dynamic_slide.read`; editor/writes/flags blijven leidend |
| Sponsors, Interactie, Bronnen en Producten | Eigen beheerrechten en objecten blijven behouden; geen tweede campagne-, poll- of bronrecord | Bestaande modulecapabilities |

De vier dubbele lijstingangen Studio, Menu Studio, Media en Slides & formats verdwijnen uit de hoofd-/beheernavigatie en het navigatiepalet. Content blijft actief op de bestaande Content-, Studio-, Media- en Slides-detailroutes. Geavanceerde functies blijven als contextlinks vanuit Content bereikbaar. Er zijn geen toekomstige Wedstrijddag- of seizoensroutes toegevoegd.

## Query, rechten en objectidentiteit

`sync_content_library_v1` is de bestaande `security_invoker`-view. Alle vier bibliotheekrequests bevatten de geselecteerde `tenant_id` én de met bestaande leescapabilities toegestane `kind`-waarden. Die beperking geldt ook voor totalen, gereed en verwerking. Het web gebruikt de bestaande sessiegebonden Supabase-client. Er is geen service-roleclient, nieuwe grant, tabel, view of migration toegevoegd.

De selectie gebeurt vóór `.range`: Media=`media`; Ontwerpen=`studio`; Automatische slides=`dynamic` behalve `menu`/`price_list`; Menu’s=`dynamic` met die twee families; Reeksen=`series`. Een handmatig sportontwerp is `studio/free` en blijft dus een ontwerp. De bestaande view voorkomt dubbele reeksleden en dubbele media/frameprojecties in Alles. Sortering is `updated_at DESC, content_key ASC`. Nieuwe pagina’s hebben48 items; een oude Menu Studio-lijstlink behoudt24. Zoekterm/type/status/pagina staan in de URL. Gewone zoektermen houden de bestaande ontsnapte `ilike`-query. Omdat PostgREST elk `*` binnen LIKE naar `%` vertaalt, gebruiken alleen termen met een ster een volledig ontsnapte letterlijke `imatch`-query. Dit is getoetst tegen de primaire PostgREST-implementatie; de eerste fake evaluator bootste die LIKE-alias onjuist na en is gecorrigeerd. De oude `filter=slides` houdt zijn historische betekenis van alle niet-media; `filter=archive` en `filter=attention` blijven ondersteund.

Content vereist geen `tenant.overview.read`. De bestaande tenant/capabilityguard controleert één van de taakrechten. Een actor die alleen mag creëren kan de kiezer gebruiken maar krijgt zonder leesrecht geen bibliotheekrijen of totalen. De wizard-, playlist-, archief-, render- en publicatiewriters blijven hun oorspronkelijke actor-, tenant-, versie- en noncecontrole gebruiken. Een keuze in de kiezer navigeert alleen en maakt niets aan.

Bestaande IDs/deeplinks, `placement`, media-frameversies, snapshots en reeksrevisies komen uit de bestaande mapper. Uploadherstel, verloren antwoorden, idempotency keys, gekoppeld/handmatig en toevoegen versus publiceren blijven afzonderlijke bestaande transacties. De playlistpicker hergebruikt alleen de Content-typelabels en dezelfde guarded navigatie naar de kiezer; zijn selectie- en schrijflogica is niet gewijzigd.

De minimale LED-lijst faalt bij een technische bron-/flagfout zelfstandig dicht; de gewone bibliotheek blijft bruikbaar.

## Kiezer en huisstijl

De gebruiker kiest eerst Programma of Uitslagen, daarna hele club, één team of één poule. Elke keuze gebruikt zijn oorspronkelijke `club-*`, `team-*` of `pool-*`-familie-ID. Handmatig invullen gebruikt de oorspronkelijke `fixtures`/`results`-wizard. De standaard menuactie gaat naar Menu Studio; Andere menu-opmaak houdt de oudere wizard bereikbaar. Live scorebord en Doelpunt openen uitsluitend de bestaande LED-werkplek wanneer de effectieve tenantfeature en taakrechten dat toelaten. Een alleen-handmatige actor krijgt geen gekoppelde scopekeuzes; een alleen-gekoppelde actor kan geen onondersteund vrij ontwerp kiezen.

OnzeTrots en FieldFlow zijn bestaande huisstijlen, geen nieuwe opslagtypen. Hun profielen, tenantdefaults, liggende/staande compositie en exacte renderers blijven intact. De previews zijn uitdrukkelijk opmaakvoorbeelden; echte bronselectie en previewcontrole volgen in de bestaande wizard.

LED-overlays staan buiten de bestaande bibliotheekview. Een afzonderlijke, duidelijk gelabelde sectie toont maximaal12 actieve oorspronkelijke overlays, zonder configuratie- of providerpayload. Alle overlays blijven via de oorspronkelijke werkplek bereikbaar. Een archiefeditor voor LED wordt niet verzonnen: de bestaande werkplek biedt die niet aan. Deze sectie telt niet stilzwijgend mee als gewone bibliotheekrijen.

## Verificatie en bewijsgrenzen

De bijbehorende `verification.json` bevat de uiteindelijk uitgevoerde lokale gates. Screenshots tonen de echte lokale Control-shell en componenten; deze demoomgeving heeft geen tenantdata en laat daarom expliciet een niet-geladen bibliotheek zien. Gecontroleerde browserfixtures tonen de echte wizard, kiezer, Radix-dialog en renderer/CSS met gecontroleerd navigatie-/actie-transport. Ze bewijzen geen hosted publicatie of providerobservatie.

| Acceptatie | Lokaal bewijs / resterende grens |
|---|---|
| STU-01 | Eén navigatie-ingang, actieve Content-routefamilie, originele Overzicht-link rechtstreeks naar gedeelde kiezer; daadwerkelijke Next-shell en componenttests |
| STU-02/03 | Query vóór pagina, menu24/pagina2, typepartitionering, zoek/archief, stabiele ties; oorspronkelijke mapper-ID’s/versies en gecontroleerde indexmapping. Bestaande echte tenantobjecten volgen in staging |
| STU-04 | Drie oorspronkelijke uitslagscopes, programma en oudere familie-URLs; bestaande Sportlink/RSS-wizardtests met bronselectie, preview en ontvangstherstel |
| STU-05/06 | Menu-/LED-ingang, capability-/featureguard en originele editorlinks. Bestaand menu/overlay bewerken op hosted staging is nog apart nodig |
| STU-07/10 | Werkelijke previews, bestaande OnzeTrots/FieldFlow-wizardcases, mobiel320/390/768 en desktop1280/1440, toetsenbord,44pxdoelen en axe. Geen fysieke afwijkende LED-hardwareacceptatie geclaimd |
| STU-08/09 | Bestaande guarded Content-/media-frame-/wizardactietests, verloren antwoord en actorwissel; tenant/typequeryfilters. Bestaande DB-RLS-gate is `s226_content_library.sql`; geen SQL gewijzigd |
| STU-11/12 | Geen publicatie- of campagnebindings gewijzigd. Bestaande gepubliceerde stagingplaylist en gekoppelde sponsor/poll moeten via de releaseworkflow worden nagegaan |
| INT-01/02 | Open voor hosted staging: nieuw liggend ontwerp tot gepubliceerde Player en bestaand Twelve-portretmenu op hetzelfde ID/prijs-/playlistbinding. Lokale component- of navtests gelden hiervoor niet als vervanging |

Geen productiegegevens, bronrequests of Duindorp-planningen zijn door deze werkstroom veranderd. Browser/Android/LG-hardwarebewijs wordt alleen vermeld wanneer het werkelijk op de kandidaat is verzameld. Root beheert de onafhankelijke review, gezamenlijke gates en staging/productierelease.

## Lokale gate-uitkomst

Workspace lint, typecheck en test zijn elk30/30 groen op de uiteindelijke bron. Control heeft185 geslaagde testbestanden,2100 geslaagde tests en34 bestaande expliciete skips. De echte Control-productiebuild is groen, inclusief auth-boundary en client-secretguard. BUILD_ID, manifest-/loghash en bronbestanden staan in de bewijs-JSON; alleen de eigen genegeerde buildoutput is daarna verwijderd om het gedeelde buildslot vrij te geven.

Er zijn55 unieke relevante browsergevallen gesloten:21 kiezer,22 bestaande wizard en12 echte Next-routes/shellgevallen. De routegroep is een expliciete unie:10 groen en2 harnessfouten in de eerste run, daarna exact die2 groen op dezelfde relevante productbron. De screenshots tonen de ontwikkeldemo; ze bevatten geen bestaande tenantrecords. De eerste vijf kiezerfouten zijn in de definitieve21-case run opgelost met bereikbare mobielgeometrie en ondubbelzinnige selectors, zonder taakcontroles te verwijderen.

De brede lokale toegankelijkheidsproef is onvolledig:8 van27 afgerond voordat de ontwikkelserver door de hostgeheugengrens herstartte. De normale Turbopack-harness kon daarna geen watcher aanmaken:125 zichtbare inotify-instanties bij de hostgrens128. Alleen een hogere FD-limiet van het eigen childproces geprobeerd; geen globale sysctl of vreemde processen gewijzigd. De productie-routeproef zonder Supabase toont terecht de gesloten login. Een korte lokale proef met gebouwde assets en de expliciete development-demosessie is op verzoek van de integrator gestopt; deze geldt evenmin als een volledige45-case suite of productie-authenticatiebewijs. De normale CI Control-/a11ygates blijven vereist vóór integratie. Er is geen productguard of testgate versoepeld.

## Bewuste Content-regiowijziging in de responsive vergelijking

De eerste CI-run op `f91e6f007e565a48c5d2097a6b9ced002cbd70f5` sloot54 van66 oorspronkelijke responsivegevallen en faalde op de12 Media-/Studio-indexgevallen (`RESP-0013`–`RESP-0024`). Hun oude fixture verwachtte vier filters en geen afzonderlijke status- of contextnavigatie. De gevraagde centrale Content-ingang heeft zes typen, drie statussen en de oorspronkelijke beheerroutes. Daardoor verandert deze regio bewust van functie en hoogte. De Studio-aliasfixture gebruikt nu ook de werkelijke `filter=designs`-bestemming.

Na expliciete integratorreview gebruikt uitsluitend die twaalfgevallen de additieve acceptatie `S297_CONTENT_A2`. Alle66 oorspronkelijke IDs, ruwe geometrie-/headingverschillen, screenshots en ongewijzigde shell-/fontcriteria blijven behouden. `pixelParity` is expliciet `false`: dit is geen claim van pixelpariteit voor de gewijzigde regio. Alleen de concrete regio-eigenschappen voor de sectiehoogte, de horizontale filterbalk en de daaronder verschoven bediening/lege titel mogen afwijken. Onverwante navigatie-/font-/geometrieverschillen blijven fouten.

De vervangende regio moet alle zes typen, drie statussen, de exacte oorspronkelijke contextlink, interne relatieve Content-URLs met dezelfde origin, verborgen zoekintentie en pagina1 bevatten. Alle labels moeten leesbaar, minimaal14px en zonder afkapping zijn; elk doel minimaal44×44px. Axe en afwezigheid van horizontale overflow zijn verplicht in alle twaalfgevallen. De proef vond echte te smalle links Actief (40×44px) en Media (41×44px); hun bestaande CSS heeft nu alleen een minimale breedte44px.

De definitieve gerichte vergelijking is12/12 groen op360,390,412,768,1024 en1440px (49,8s); dertien validator-/negatieve tests en gerichte ESLint zijn groen. De test bewaart de ruwe verschillen en weigert ontbrekende controls, foutieve/externe URLs, kleinere doelen, afkapping, veranderde fonts en ongerelateerde geometrie. De gewone CI voert opnieuw de volledige66-case vergelijking uit; het gerichte lokale bewijs wordt niet als een volledige66-case PASS gepresenteerd. De twee toegevoegde daadwerkelijke Next-regressies bewaken de oorspronkelijke geavanceerde Studio-index en detail/editor-identiteit op320/1440px.

De twee nieuwe Next-regressies konden op deze gedeelde host niet lokaal starten: Watchpack gaf opnieuw `EMFILE` voordat hun assertions liepen. De proef is direct gestopt en eigen poort3217 gesloten. Dit zijn geen twee lokale PASS-resultaten; de normale CI moet deze toegevoegde gevallen uitvoeren.
