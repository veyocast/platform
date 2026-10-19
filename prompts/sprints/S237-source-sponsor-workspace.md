# S237 — Sponsoren als samenhangende Source-werkruimte

## Opdracht en voorrang

De gebruiker ziet grote aaneengeplakte sponsorcontainers met technische copy
en vraagt expliciet om een mooie, grondig gecontroleerde UI. Dit is onderdeel
van de al geautoriseerde volledige prototype1/Sync-rebuild en staging- plus
productie-uitrol. De huidige screenshots blijven rood uitgangsbewijs. De
gekozen immutable Source is leidend voor compositie, tabs, lijsten en modals;
security, echte domeinfuncties, goedgekeurde assets en toegankelijkheid blijven
behouden. De latere expliciete afwijzing van oude oranje knoppen gaat voor de
historische generieke Electric-Orange-regel: gebruik de bestaande Source
semantische tokens, geen nieuwe merkwaarden of globale tokenflip.

Worktree `/home/codex/repos/castivo-s237`, branch
`veyocast/s237-source-sponsor-workspace`, basis S234 `0b7619e1`.
Het schone, reeds gemergede S229-worktree is hergebruikt; oude branch en
geschiedenis zijn behouden. Geen dependency-install, nieuwe Source-assets,
reset, migratie, productiecredential, workflow of serverwriter nodig.

## Ownership en schrijf-GO

`release_audit` bezit uitsluitend onderstaande paden:

- `apps/control/app/(shell)/dashboard/sponsors/page.tsx`
- `apps/control/app/(shell)/dashboard/sponsors/sites-sponsors-primary.tsx`
- `apps/control/app/(shell)/dashboard/sponsors/sites-sponsors.module.css`
- `apps/control/app/(shell)/dashboard/sponsors/sponsor-hub.module.css`
- nieuw `sync-sponsor-workspace.tsx` en `sync-sponsor-workspace.module.css`
  in dezelfde sponsormap
- nieuw `tests/control/sync-sponsor-workspace.spec.ts`

Lees eerst de gebruikelijke canons, dit prompt, de echte Source Sponsors in
`docs/sync-v1-rebuild/handoff/reference/sites-sync/src/modules/Admin.tsx` en
de bestaande CRM-/sponsorcomponenten. Rapporteer vóór extra paden noodzakelijk
ownership; bestaande CRM-data/actions/CSS blijven voorlopig bytegelijk.
Root bezit docs, ledger, bewijsindex, daadwerkelijke AAL2-Sourcevergelijking,
integratie, PR en release. Geen eigen commit/push/merge/deploy.

## Resultaat

Eén rustige Source-werkruimte in plaats van defaultpagina plus een volledig
tweede oud beheerportaal in een details-element. Gebruik de echte Source-tabs
Campagnes / Partners / Pipeline & taken / Afspeelregistratie en passende vervolgtaak
voor goedkeuring, materiaal, plaatsingen en instellingen. Deze namen zijn door
de agent in de echte Source geverifieerd en vervangen de eerdere onbewezen
voorgestelde tabnamen. Behoud alle bestaande
mogelijkheden: sponsor en campagne maken, materiaal toelaten, creative koppelen,
indienen, echte vier-ogen-goedkeuring, posities initialiseren, plaatsen en
immutable plan publiceren. Geen onbewezen edit/pauze/drag/drop of fakecijfers.
De huidige read-only CRM-filters, kansen en taken en hun echte detailvensters
blijven bereikbaar; laat geen functies verdwijnen door alleen panels te sluiten.

Laat de server dezelfde verse capabilities/status en loaders bepalen.
Doorgegeven server-rendered forms/ReactNodes mogen in gerichte clientvensters
staan; verander geen actionbody, autorisatie, binding of nonce. Houd relevante
invoer gemount bij tabwissels waar dat herstel beschermt. Links met crm=1,
CRM-filters en bestaande #sponsor-campaign-ID-verwijzingen blijven werken of
krijgen een expliciete equivalente selectie. Echte laadfout/lege/rechtenstates
zijn zichtbaar. Technical architecture copy hoort niet in de primaire klantflow;
vertel concreet wat een handeling doet en wanneer publicatie nodig is.

Gebruik Source-tabellen/rijen, duidelijke witruimte en compacte taakheaders.
Geen grote lege container per kop, gestapelde geneste kaders of decoratieve
KPI-muur. Formulieren openen gericht, met echte labels, passende Source-modal-
breedte en één body-scroller. Behoud 44px, focus/Escape, Nederlandse copy,
minimaal14px primaire body, eerlijke previewstatus en responsive mobiele flow.
Scoping uitsluitend lokale CSS; immutable SourceCSS blijft bytegelijk.

## Bewijs

Leg vóór schrijven concrete Source→huidige functie/tabmapping aan root voor.
Daarna scoped implementatie, relevante TSC/lint/units en meaningful browser-
cases met echte productCSS op390 en1440, aXe, overflow, tab/deeplink/keyboard,
lege/gevulde/fout/viewer-states en alle echte bestaande form boundaries.
Behoud eerdere CRM-asserties en fixtures. Geen testskip, ruimere tolerantie
of mockup ter vervanging van product. Bewaar eerste rode uitkomsten.
Browser pas expliciet rootGO, één worker. Echte database/publicatie/Player-
acceptatie en vijf volledige auditronden worden niet door componenttests bewezen.

## Rootreview na writerfreeze

Root neemt uitsluitend de zeven frozenproduct/specpaden terug over na het
manifest e73f877e92c3c9ab5a2a20b7593444074554fca88362185150c196da52165a1d.
Native1440dialog is bekeken: oude inline20pxbovenmarge op creationForm telt
nog bovenop Sourcebodypadding26 en wordt verwijderd. Geen writersemantiek.
Rootreview vindt ook een concreet ongedekt contextdefect: de hashselectie-effect
loopt op iedere nieuwe campaigns-array opnieuw en heropent Beheren tijdens
materiaalinvoer. Verwerk dezelfde reeds toegepaste hash slechts eenmaal; een
werkelijke nieuwe hash en eerder niet gevonden campagne moeten wel selecteren.
Behoud verseprops/statusfence en stable callback-ref. Nieuwe zevende echte
componentregressie bewijst deeplink→materiaal→invoer→serverrefreshzonderverlies,
geen writes; alle zes eerdere gevallen blijven. Capture de hele werkruimte
vóór de dialoog in bestaande390/1440cases voor verdere nativeSourcevergelijking.
Root doet volledige huidige cohort plus passende foundationgates; het eerdere
mixed-versionbewijs blijft afzonderlijk bestaan. Geen V1/five-roundsclaim.

De onafhankelijke peer vindt twee aanvullende echte P2-grenzen binnen dezelfde
frozenpaden: activiteiten gebruiken werkelijke auditcodes sponsor.create /
campaign.create / submit / approve / reject / plan.publish (plus huidige
positions.ensure, media.register, creative.add, placement.upsert), geen
verzonnen verleden-tijdcodes. Root corrigeert alleen labels en de echte-code-
fixture/assertie. Tevens mist de cliëntcampagne-DTO zijn bestaande sponsor_id;
bij materiaaltoelating binnen een campagne van partnerB mag niet standaard
partnerA worden voorgeselecteerd. Geef uitsluitend die tenant-eigen sponsorId
mee in dezelfde DTO, seed bestaande eigen optie bij echte materialformmount,
behoud expliciete invoer op gewone refresh. Een achtste case toetst die
werkelijke body; serverwriter/SQL/rechten blijven bytegelijk.

De eerste volledige huidige8cohort eindigt7PASS/1fixtureFAIL: bij de nieuwe
directe campagnehash opent de echte dialoog onmiddellijk en Radix verbergt
terecht de achtergrondheading. Alleen de readinessvoorwaarde van die mount
wordt expliciet verdeeld: directehash vereist dezelfde h1tekst en zichtbare
echte campagnedialoog; alle overige mounts blijven dezelfde zichtbareheading
eisen. De eigen regressie-asserties blijven exact gelijk. Eerste rode JSON
blijft behouden; geen accessibility- of productguardversoepeling.

Root native-volledig1440/390 toont nog dubbel-status en een afzonderlijke
volledige actierij plus Beherenrij, plus kaartpadding om de18:10-artillustratie
en daaronder opnieuw inhoudpadding. De laatste expliciete gebruikersvraag
vereist minder massaal: zet alleen de campagnebuitenpadding op0, behoud
Sourcebinnenruimte20/18 en180/175pxillustratie. Combineer bestaande echte
formacties en Beheren op één wraprij; toon campagne-status eenmaal bovenaan
en in het beheervenster via bestaande detailwaarde. Verplaats geen action
naar een andere form en wijzig geen writerbody/guard. Geen-beeld wordt
compacte feitelijke tekst in plaats van volledige badgebalk. Metrics behouden
echte waarden en Source3-kolomsgeometry; mobile zet ze op één compacte
samenvattingsrij per metric (geen drie142pxlegekaarten). Nieuwe assertions
meten eigen geometrie/één status naast bestaande44/aXe/formcases; geen
prototypecounterfactual of algemene parityclaim. Deze lokale dichtheidsdelta
is expliciet gevolg van de nieuwere gebruikersinstructie, SourceCSS bytegelijk.

Nativebeelden na8/8PASS bevestigen de compactereactie-/metricrijen, maar de
decoratieveSourcecirkel uit de campagne-art loopt nog achter de feitelijke
details door. Alleen art krijgt overflowhidden/isolationisolate, zodat de
illustratie haar eigen kader houdt; inhoud/bronassets/afmetingen blijven.
Bestaande390/1440cases meten diecontainment naast hun eerdereasserties;
nieuwe volledige8casecohort vóórfinaleproof.

## Root vervolg peer05: CRM-inspector
Onafhankelijke readonlyreview toont bestaande CRM SheetContent rechtstreeks op
body, buiten DialogPortalProvider; daardoorvallenworkspace-ffaliassen en
Sourcefontweg. Root krijgt uitsluitend aanvullend sponsor-crm-overview.tsx
en sponsor-crm.module.css (onder dezelfde sponsorroute) vrij voor lokale
Sheetrootclass/Source-rolaliassen/typografie/header/close44px. Geen publieke
Sheetimplementatie/CRMmodel/filter/loader/gegevens/actie wijzigen. Bestaande
390/1440cases openen nu ook de echte CRM-inspector en toetsenSourcefont/
witoppervlak/aXe/focus/Escape/0writes; bestaande8cases blijven verdergelijk.
De vroegere 'zesCRMbestandenbytegelijk' geldt voor de writerfreeze, niet de
nieuwe rootpresentatiedelta; overigeviermodel/loader/testfiles blijven gelijk.

## Root tweede visuele dichtheidscontrole
Werkelijk1440capture na eerdere containmentfix toont nog160px metrics en
575px campagnekaarten. De gebruiker vraagt expliciet minder massale vakken.
Root gebruikt uitsluitend eigen lokale workspace-/campaignCSS: compacte
metriekrijen ook desktop,130px art en onomkaderde metadata met14px tekst,
44px acties en duidelijke14–20px tussenruimte. ImmutableSourceCSS en
allecampagne-/approval-/weging-/vormcommands blijven behouden. Bestaande
8cases toetsen aanvullende desktopmetric/art-/metadatageometrie, zonder
oudeasserties/axe/permissions/replay te verwijderen; nieuwe captures reviewen.

Root screenshotreview compact-v2 toont afgesneden zoekplaceholder ondanks
vollezoekbalk. Uitsluitend owned inputflex1/min-width0/width100 toegevoegd;
bestaande tweeviewportcases controlerenwerkelijke zoekinputbreedte naast
behoudquery/filter/actiontests. Geen dataselectie- of commandwijziging.
