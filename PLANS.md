# VeyoCast MVP Plan

## Werkmodus

VeyoCast wordt lokaal gebouwd met Codex in geïsoleerde Git-worktrees. GitHub blijft de bron van waarheid. Elke taak krijgt:

- één branch;
- één primaire writer-agent;
- duidelijke path ownership;
- lokale gates;
- review;
- PR.

## MVP-doel

De MVP is pilot-ready wanneer:

- multi-tenant auth en RLS bewezen zijn;
- platformadmin en tenantadmin de kernflows kunnen uitvoeren;
- media upload en processing werken voor afbeeldingen en MP4/H.264-video;
- playlists als concept bewerkbaar zijn;
- publiceren een immutable release maakt;
- schermen en player-devices via pairing worden gekoppeld;
- player online en offline fullscreen speelt;
- nieuwe releases atomisch worden gedownload, geverifieerd en pas daarna geactiveerd;
- player na netwerkverlies, herstart en corrupt pending asset blijft functioneren;
- designcanon zichtbaar is toegepast;
- launchgates groen zijn.

## Sprintoverzicht

| Sprint | Naam | Resultaat |
|---|---|---|
| S00 | Canon, repo en lokale runtime | Monorepo, docs, gates, lokale scripts |
| S01 | Design system foundation | Tokens, UI-package, Storybook, placeholder assets |
| S02 | Auth, tenancy, roles en RLS | Supabase schema, RLS, memberships, tests |
| S03 | Platform en tenant shell | Control app shell, rollen, dashboards |
| S04 | Media upload en processing | Storage, media assets, uploadqueue, worker shell |
| S05 | Playlists en release model | Drafts, playlist items, immutable releases |
| S06 | Screens, devices en pairing | Schermen, player devices, pairingflow |
| S07 | Online player playback | Manifest fetch, image/video loop |
| S08 | Offline cache en atomic updates | Cache, IndexedDB, verification, fallback |
| S09 | Control dashboard polish | Media/playlist/screen UX volgens canon |
| S10 | Marketing shell en landingpage | VeyoCast homepage en SEO-basics |
| S11 | Security, accessibility en reliability gates | RLS, axe, Playwright, player reliability |
| S11-B | Enterprise Control UX | Operational app shell, resource workflows and responsive Control QA |
| S12 | Pilot-ready local MVP | End-to-end local pilot, docs, release checklist |
| S13 | LG webOS capability hardening | Device Lab, watchdog en fysiek testprotocol |
| S14 | Playback- en mediareadiness | Periodieke sync, veilige cache-GC en uitvoerbare MP4-workerqueue |
| S15 | LG-koppelklaar hosted product | Echte schermvloot/pairing en reproduceerbare Docker/Caddy-deployment |
| S16 | Control authoring MVP | Live media, playlists, instellingen en mixed-media publicatie |
| S17 | VPS staging en production | Gescheiden Compose-stacks, self-hosted runners en Supabase-migratiedeployment |
| S18 | VeyoCast-rebrand | Productnaam, namespaces, assets, bestaande data en canon veilig overzetten |
| S19 | VPS deployment finalization | Immutable main → staging → approval → production met host-Caddy, rootless Docker en veilige rollback |

## Uitgebreid programma na S19

De volledige uitvoeringsscope, werkpakketten, securityvoorwaarden, UX-journeys,
tests en exitcriteria staan in
[`docs/canon-alignment-product-roadmap.md`](docs/canon-alignment-product-roadmap.md).

| Sprint | Naam | Resultaat |
|---|---|---|
| S20 | Canon en application boundaries | Eén VeyoCast-canon, contracts/domain/auth-packages en toetsbare dependencyrichting |
| S21 | Identity, tenantcontext, capabilities en MFA | Expliciete tenantselectie, centrale capabilities, AAL2 en statusafdwinging |
| S22 | Platform lifecycle en teambeheer | Complete tenantprovisioning, lifecycle, limieten, invitations en rollen |
| S23 | Control UX-fundering | Nieuwe informatiearchitectuur, shared UI, responsive shell en resourcepatronen |
| S24 | Media workspace | Gepagineerde lijst/raster en inspector, veilige TUS-resume, processingherstel en asset→draft→release→scherm-gebruik |
| S25 | Playlist Studio | Gescheiden editor, optimistic concurrency en centrale publicatiegereedheid |
| S26 | Release Center | Releasehistorie, vergelijking, impactanalyse, schermpreflight en guided publish |
| S27 | Schermvloot en onboarding | Transactionele screen lifecycle inclusief veilige deactivatie/verwijdering, pairingjourney, detail en devicebeheer |
| S28 | Operationeel dashboard | Actie-inbox, echte globale search, onboardingchecklist en contextuele help |
| S29 | Production operations | Worker deployment, observability, SLO's, alerts, restore en veilige supportbundle |
| S30 | Pilot RC gate | Live critical journey, 24-uurs soak, fysieke LG-, security-, a11y- en DR-gates |
| S30-K | Control calmness en workspacejourneys | Actie-eerst Control, consistente overlays, thema/dichtheid, veilige playlistduplicatie en rustige mobiele flows |
| S31 | Publisher-backoffice canon | Rustige responsive Publisher-shell, visuele resourceworkspaces, guarded authoring, autosave, persoonlijke views, bulkacties en tenanttemplates |
| S31-B | Configureerbare authoring en toegang | Bewerkbare playlisttemplates, tenant-beheerde custom werkrollen en compacte enterprise-density |
| S32 | Groepen en planning | Schermgroepen, immutable target snapshots, timezone/DST-veilige schedules, conflictanalyse en offline-safe dayparting |
| S33 | Integration framework | Server-only adapters, syncjobs en immutable offline widgetsnapshots |
| S34 | Provider discovery | Official-only Sportlink/Twelve go/no-go en uitsluitend goedgekeurde POC's |
| S35 | Billing | Mollie, reconciliation en scherm-entitlements zonder offline blackout |
| S36 | Advertentienetwerk | Optionele deterministische ads, proof en revenue share na legal/product GO |
| S37 | Researchhorizon | Begrensde go/no-go discovery voor AI, wrappers, LAN relay en latere opties |
| S38 | Pixelperfect marketing en SEO | Volledige Nederlandse routematrix, premium responsive homepage, veilige claims, crawlbare SEO-templates en visuele bewijsvoering |
| S40 | VeyoCast Studio | Tenantveilige visuele authoring, versioned ontwerpen, deterministische PNG/MP4-rendering en integratie met de bestaande mediabibliotheek |
| S41 | Launch platform operations | Android TV-form-factorartifact binnen één Play-app, Excel-productcatalogus, Slack-alerting, retention/deletion-governance, storageback-up en supportdesk |
| S42 | LG webOS Signage IPK | Dunne installeerbare LG-shell rond de bestaande hosted Player, met begrensd herstel, reproduceerbare IPK, CI-inspectie en expliciete fysieke hardwaregates |
| S44 | LG webOS launch recovery | Officiële genormaliseerde 1.0.1-IPK's, zelfstandige smoketest, zichtbare opstartdiagnostiek en exact 43UL3J-EP-testprotocol |
| S45 | LG IPK-installatieforensics | Bevries geweigerde productie 1.0.1, bewijs download- en packageprovenance, herstel de ongewijzigde Signage-envelope en publiceer uitsluitend immutable smoketest 1.0.2 |
| S46 | Device compatibility en playback-hardening | Algemene Android-compatibiliteit binair bewaken, mobiele Play-track herstellen en native video-startoverlays onderdrukken zonder kiosk- of overlaypermissies |
| S47 | Schermautomatisering | Per-scherm bedrijfstijden, capability-aware Control, inexacte lokale Androidstart, schedule-aware keep-awake en eerlijke HDMI-CEC-diagnostiek |
| S50 | Atelier Ivory Control en Studio | Definitieve semantische light/dark-interface, responsive shell, kernworkspaces, beide editors en visuele bewijsvoering |
| S51 | Vaste dynamische slides | Platformtemplates, tenant product/RSS-bronnen, veilige immutable PNG-snapshots en bestaande offline Playerreleaseketen |
| S52 | Control floating overlays | Portaled overflowmenu’s, viewport collision handling en clippingvrije focus/menuweergave |
| S53 | Android- en LG herstelbetrouwbaarheid | Officiële Android-app herkent dezelfde installation na herinstallatie, verifieert boot-/updatestarts en opent Play-updatebeheer; standalone LG-recovery maakt vóór redirect aantoonbaar een nieuwe code |
| S54 | Sportlink Club.Dataservice | Tenantveilige server-only Sportlink-data, lease-based synchronisatie, vaste sportslides en immutable offline Playeroutput |
| S55 | VeyoCast Control Mobile | Native Android-first beheerapp met veilige mobiele API, offlinekern en afzonderlijke Play-publicatieketen |
| S61 | LG herstelcode-handoff | Canonieke timestamps en claim-bevestigde standalone recovery voorkomen dat oude webOS-clients een voorbereide code verliezen en opnieuw rate-limiten |
| S62 | LG release-playback | webOS-veilige playback uit geverifieerde cachebytes, niet-destructieve clientfallback en staande Control-mediapreview |
| S63 | Media-upload en LG native videostreaming | Begrensde individuele afbeeldinguploads en native HTTP-rangevideo op LG met geverifieerde offlinefallback |
| S64 | Uploadtransport en media-accessvernieuwing | Afbeeldingen omzeilen Server Actions via een begrensde same-origin API en actieve Players vernieuwen verlopen signed media-toegang zonder release- of koppelverlies |
| S65 | Portrait-afbeeldingsoriëntatie | Afbeeldingsuploads registreren betrouwbare PNG/JPEG/WebP-afmetingen inclusief EXIF-rotatie en Control/Player behouden portraitgeometrie zonder bestaande uploads te breken |
| S66 | Productie-workerreadiness | De deployment bevestigt media-workerreadiness via de directe probe of een exact aan image, omgeving en revisie gebonden Docker-healthcheck |
| S67 | Releasegebonden workerheartbeat | Een recente echte queuepoll bewijst workerreadiness ook wanneer uitsluitend de lokale TCP-route in de productiecontainer faalt |
| S79 | Veilige mediaverwijdering | Video en afbeelding vanuit Media transactioneel archiveren met expliciete conceptimpact |
| S81 | Begeleide slide- en mediabeheerflow | Dynamische slides in afzonderlijke gevalideerde stappen maken en mediaverwijdering direct vindbaar en herstelbaar maken |
| S82 | Sportlink-lease en Europese tenanttijd | Langdurige Sportlink-syncs met lease-heartbeat en direct herstel uitvoeren; Control en sportslides expliciet in Amsterdam-, Brussel- of Parijstijd tonen |
| S83 | Veilige RSS-compatibiliteit | Gewone nieuwspagina’s begrensd naar hun gedeclareerde feed laten doorverwijzen en legacy RSS-doctypes inert negeren zonder entityresolutie of SSRF-versoepeling |
| S84 | HTML/CSS dynamische slides | Menu, nieuws en Sportlink als locked responsive Player-templates met paging, varianten en een immutable PNG-fallback tonen |
| S85 | Portrait RSS-nieuwsslider | Eén configureerbare staande HTML/CSS-nieuwsslider met lokale leverancier- en artikelmedia |
| S86 | Landscape RSS en Sportlink-herstel | Beide nieuwsoriëntaties animeren met tenantkleur, als dynamische playlistcontent publiceren en Sportlink volledig herstellen |
| S87 | LG Legacy lokale releaseketen | Afbeeldingen en video vooraf downloaden, verifiëren en lokaal afspelen; ongewijzigde releases uitsluitend conditioneel controleren en zonder zwart frame wisselen |
| S89 | Sportlink team- en competitiecontext | Teamsync dedupliceren en wedstrijdslides tenantveilig op team, competitie, beker of fase filteren |
| S90 | Sportlink standseizoenen en clubeditie | Standen op team, competitie en seizoen selecteren, historie behouden, vijfminutensync aanbieden en portrait/landscape als locked HTML/CSS tonen |
| S91 | Editorial Arena | Eén capability-gated HTML/CSS-thema voor alle volledig ondersteunde dynamische databronnen, met vier vaste canvasvarianten, tenantkleur, motion en veilige immutable fallback |
| S92 | LG HTML/CSS-renderdiagnose | Zelfstandige TV-diagnose met de echte legacy stylesheet en compatibele fullscreenpositionering, zonder playerdata te wijzigen |
| S93 | LG pairing bij klokafwijking | Pending pairing server-authoritatief behouden zodat een voorlopende TV-klok geen codecarrousel en rate-limit veroorzaakt |
| S94 | LG dynamische slide-viewportfit | Alle Editorial Arena-slides op hun vaste portrait- of landscapecanvas proportioneel binnen iedere LG-viewport tonen, met 16:9-nieuwsbeeld en passende titels |
| S95 | RSS-nieuws leesbaarheid en beeldfit | Lange nieuwstitels harmoniseren, intro/metadata leesbaar positioneren en RSS-beelden zonder vergroting of dubbele crop binnen het 16:9-vlak tonen |
| S96 | Automatische dynamische livevernieuwing | RSS iedere vijf minuten controleren, ongewijzigde feeds dedupliceren, gewijzigde latest-slides atomisch als nieuwe immutable release uitrollen en Playercode op een veilige grens verversen |
| S119 | Unified Studio en Sportlink bulkslides | Eén Studio-startpunt, transactionele team × blueprint-wizard, volledige pouleprogramma/-uitslagen en configureerbare bezoeker-/scheidsrechteraankomstslides met immutable snapshots |
| S98 | Data-aware Sportlink-slidewizard | Echte Player-preview uit de canonieke snapshotbuilder, alleen renderbare team-/competitie-/seizoenopties, preflight en datakwaliteit zonder providercalls of mutable previews |
| S99 | Inhoudsgestuurde dynamische publicatie | Eén Sportlink-revisie per sync, stabiele inhoudshashes, hergebruikte fallbackassets en alleen een nieuwe immutable release wanneer zichtbare Playerinhoud wijzigt |
| S100 | Leesbare Editorial slides en clientgebonden Sportlink-keuze | Nieuws/standen op afstand leesbaar en schermvullend tonen, RSS-artikelen canoniek dedupliceren, uitsluitend teams van de Sportlink-client aanbieden en het officiële clublogo lokaal in releases opnemen |
| S101 | Editorial logo- en headerafwerking | Sportlink-teamlogo's server-side als offline release-assets tonen, het eigen clublogo als tenantfallback gebruiken en Editorial headers/nieuws-QR vereenvoudigen |
| S104 | Editorial Arena authoring completion | Volledige light/dark-tokenauthoring, focal points, handmatige prijskolommen, gedeelde React-DOM-thumbnails en een vaste 48-cellen-regressiematrix |
| S115 | Sponsor Hub | Tenantveilige sponsoroperatie met vier-ogen-campagnes, semantische posities, immutable offline sponsorplannen en devicegebonden Proof of Play |
| S116 | Menu Studio portrait save hotfix | De gekozen staande of liggende schermstand bepaalt atomisch het opgeslagen template, concept en de volgende immutable snapshot |
| S117 | Menu Studio authoring-UX hotfix | Productgroepbewerking duidelijk afsluitbaar maken, korte portraitmenu's bovenaan verankeren en de menunaam zichtbaar én resourcebreed bewerkbaar maken |
| S118 | LG Menu Studio portrait hotfix | Menu Studio v2 op LG Legacy met dezelfde éénkoloms portraitzones, bovenuitlijning en leesbare maatvoering als de gedeelde renderer tonen |
| S120 | Menu Studio bibliotheek- en portrait-UX | Preview bovenaan verankeren, categorieën en media via modale pickers toevoegen, producten alfabetisch filterbaar maken, vrije groepsinvoer optioneel houden en één of twee portraitkolommen expliciet kiezen |
| S121 | Dynamische slides schermvullend | Gelijk georiënteerde dynamische slides zonder letterboxing over de volledige viewport tonen en de Menu Studio-preview exact in het gekozen canvasformaat weergeven |
| S122 | Dynamic slide versioning, thema en Sportlink-wizard | Eén logische menu-/Sportlink-slide met immutable ontwerpversies, creation-default thema per tenant, gedeelde visuele themakiezer en een overzichtelijke vijfstaps bulkflow |
| S123 | Vector v2 — Living Venue OS | Productfamiliebrede premium upgrade met compatibele design-systemlaag, echte nieuwe feature-domeinen achter flags, billing/entitlements en volledige release-evidence |
| S128 | Dynamische Sportlink-verjaardagen | Dagelijkse 21-dagensnapshot, exacte team-/rolverrijking, private geboortejaarimport, premium wizard/renderer, LKG/offline skipgedrag en tenantveilige uitrol |
| S129 | Thuiswedstrijdgebonden bezoekerswelkomstscherm | Alleen bezoekers van expliciete thuiswedstrijden tonen, een responsief 1–4-raster gebruiken en het gevalideerde uitteamlogo offline-safe in kaart en achtergrond verwerken |
| S132 | LED Scores realtime Goal Alert | Default-off read-only scoreconnector, immutable Studio-alerts, many-to-many targeting en device-geauthenticeerde realtime Playeroverlay zonder de offline releaseketen te wijzigen |
| S133 | Sportlink providerasset-sync hotfix | De foutieve v4-padvalidatie forward-only herstellen, service-role-only completion end-to-end bewijzen en via de bestaande VPS-releaseflow veilig uitrollen |
| S134 | Sportlink verjaardag-teamfilter hotfix | De officiële dubbele teamreferentie inclusief `-1`-sentinel valideren en versturen, zodat de dagelijkse publieke-personensync niet meer op providerfout 4002 stopt |
| S135 | LED Scores service-role-boundary hotfix | Het nieuwe server-only workerbackend expliciet in de fail-closed secretgrens registreren en daarna dezelfde volledige VPS-release opnieuw bewijzen |

### Programmagates

- S20-S22 herstellen eerst trust, context en beheer.
- S23-S28 herontwerpen Control rond echte klantjourneys.
- S29-S30 zijn verplicht vóór een brede pilotclaim.
- S31-S32 zijn lokaal geïmplementeerd en blijven vóór brede uitrol afhankelijk
  van de bestaande staging-, fysieke Player- en soakgates.
- S33-S36 starten alleen na hun expliciete provider/commerciële entry gates.
- S37 levert beslisdocumenten en prototypes, geen stilzwijgende productclaims.

## Parallelle waves

Zie `docs/sub-agent-orchestration.md`.
