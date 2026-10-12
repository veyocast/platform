# Acceptatie en QA — exacte Sites-overname

Versie 1.0 · 11 oktober 2026

Dit is het uitvoerbare acceptatieplan voor de overdracht. **Alle 1.209 cases in `inventory/VISUAL-CASES.csv` starten op `NOT_RUN`.** Het bestand beschrijft controles; het rapporteert geen geslaagde browser- of productietests.

## 1. Bewijsniveaus gescheiden houden

| Niveau | Betekenis in deze overdracht | Wat dit niet bewijst |
|---|---|---|
| Bronvergelijking | Routes, componenten, stijlen, assets, template-ID's, wizardstappen en schaalgrenzen zijn gelezen uit de vastgelegde repositories. De mapping en canon beschrijven verschillen en migratiegrenzen. | Geen bewijs van runtime-interactie, schermgelijkenis of productie-integratie. |
| Assetcontrole | De twintig Sites VeyoCast-brandbestanden en vier FieldFlow-foto's zijn bytegelijk aangetroffen in GitHub. Het pakket heeft een bestandeninventaris. | Geen bewijs dat alle assets later in Control, worker of Player daadwerkelijk laden. |
| Referentiebundel | De hoofdagent bouwt de afzonderlijke lokale referentiebundel en legt het daadwerkelijke buildresultaat in het afleverrapport vast. Dit QA-document verklaart geen aanvullende build uitgevoerd. | Geen productiebuild, livebrowsercontrole, e2e-test of apparaatacceptatie. |
| Visuele pariteit | Door uitvoerende Codex nog uit te voeren tegen de exacte bronversie, gelijke fixtures, fonts en viewports. | Een typecheck of foutloze bundel is niet voldoende. |
| Productiewerking | Door uitvoerende Codex nog uit te voeren met echte lokale/staging-servercommands, rechten, opslag, publicatie en releasecontracten. | Demobuttons en browseropslag gelden niet als serverbewijs. |
| Hardware | Fysieke Android/iPhone/TV/LG-acceptatie nog uit te voeren waar van toepassing. | Een browseremulator bewijst geen gedrag op een echt scherm. |

Bewaar per uitgevoerd resultaat: case-ID, bron-SHA, implementatie-SHA, fixtureversie, viewport/DPR, browser/OS, datum, verwachte en werkelijke uitkomst, artifacts en eventuele blokkade. Gebruik `PASS`, `FAIL`, `BLOCKED` of `NOT_APPLICABLE` pas met onderbouwing. Een ontbrekende provider, fysiek toestel of credential is `BLOCKED`, niet `PASS`.

## 2. Referentie lokaal openen

Vanuit de uitgepakte pakketroot:

```bash
python3 reference-preview/serve.py
```

Daarna:

- Normale demo: `http://127.0.0.1:4173/#/dashboard`
- Voorbeeld losse TV-slide: `http://127.0.0.1:4173/?template=wedstrijd&orientation=landscape`
- Portrait: vervang `landscape` door `portrait`.

Dit is een lokale, alleen als referentie bedoelde bundel. Deze server bindt aan loopback en voert geen productie-login of API-koppeling uit. Stop met Ctrl+C. De directe templatewrapper accepteert **alleen** `template` en `orientation`; schrijf geen fictieve `scale`, `state` of `theme` URLparameters in een testrunner.

De acht in `source/sites/app/prototype/onzetrots-tv-templates.ts` geverifieerde basekind-ID's:

| ID | Naam |
|---|---|
| `wedstrijd` | Onze wedstrijddag |
| `programma` | Vandaag op het veld |
| `uitslagen` | Zo speelden we |
| `stand` | De stand van zaken |
| `kantine` | Even naar de kantine |
| `clubnieuws` | Dit leeft op de club |
| `partners` | Samen maken we de club |
| `welkom` | Dit is onze trots |

Voor gewijzigde velden, schalen en states: gebruik de bestaande Studio-controls of maak tijdens implementatie een apart fixture-testharnas dat exact dezelfde renderer aanroept. Wijzig de bevroren referentiecomponenten niet om een mislukte vergelijking te laten slagen.

## 3. Deterministische fixturevoorwaarden

Gebruik voor referentie en kandidaat dezelfde invoer. De fixtureadapter mag het bestaande productiemodel vullen, maar mag de opmaak niet veranderen.

**QA-01 basis:** tenant Duindorp SV; vaste gebruiker en rol; timezone `Europe/Amsterdam`; locale `nl-NL`; vaste kalenderdatum 11 oktober 2026, 12:00 lokale tijd; twee schermen in één groep plus één apart scherm; dezelfde statussen; stabiele UUID's; dezelfde volgorde van records. Gebruik lokale testassets uit het pakket. Een schone geïsoleerde browsercontext voorkomt eerdere `veyocast-demo-*`-wijzigingen. Vaste IDs/timestamps maken productieaudit reproduceerbaar; gebruik nooit een echte productietenant voor deze fixture.

**QA-LED:** Duindorp SV 1 tegen Bezoekers; 2–1; klok 67:24; scorer D. Jansen, minuut 67′; gebeurtenissen 67′ 2–1, 38′ 1–1, 12′ 1–0; originele eigen-/tegenstanderafbeeldingen; overlay20, grunge25, veilige marge3, standaard deelschaal100. Varianten vergelijken één factor per keer.

**QA-SL-01:** gebruik exact de Sites `demoRows` voor het gekozen Sportlink-type en stabiele gestructureerde productie-equivalenten. Voeg daarna genoeg unieke rijen toe voor twee pagina's. Scores mogen niet uit een naam worden afgeleid; ontbrekende waarden blijven onbekend. Bevries club/team/poule/filter en geselecteerde standkolommen.

**QA-MENU-01:** de twaalf producten, drie categorieën en prijzen van de kantinetemplate als vaste fixture; daarnaast één categorie-uitvariant. Prijzen zijn fixturewaarden, geen productclaims.

**QA-VIDEO-01:** één testbron met lokale fallbackafbeelding. Sites bewijst alleen de configuratie-/fallbackweergave; echte video- en storingstests gebeuren in de productieadapter met de bestaande YouTube-contracten.

**QA-TV-varianten:** vertrek steeds vanuit de ongewijzigde `ONZETROTS_TV_TEMPLATES`-entry:

| Variant | Deterministische wijziging |
|---|---|
| `long-copy` | Titel `SAMEN MAKEN WE ONZE CLUB NOG MOOIER`; team `Duindorp SV JO19-1 Zaterdag`; tegenstander `Scheveningen Combinatie JO19-2`; één product `Tosti ham-kaas met extra tomaat`; geen andere velden veranderen. |
| `missing-logo` | Verwijder alleen de expliciete club-/team-/rijlogo's; behoud tekst en foto. Controleer de bedoelde fallback, geen kapot afbeeldingsicoon. |
| `custom-background` | Kies exact `/onzetrots/premium/havenlicht.png`, overlay20; valideer `contain` en `cover` waar de editor dit aanbiedt. |
| `empty-data` | Voor lijsttemplates `rows:[]`; voor welkom/wedstrijd ontbrekende optionele tekst/beeldvelden. Verwijder geen verplichte canonieke identiteit uit het contract om een onmogelijke state te fabriceren. |
| `overflow-page-2` | Voor lijsten: programma/uitslagen/stand 9 rijen, kantine13, clubnieuws4, partners7. Unieke stabiele IDs en zichtbare volgnummers. Welkom/wedstrijd hebben geen automatische lijstpagina; bevestig dat hier géén tweede pagina wordt verzonnen. |

Voor alle captures:

1. Wacht op `document.fonts.ready`, alle noodzakelijke afbeeldingen/masks en minimaal twee stabiele layoutframes. Verifieer de gekozen fontfamilie én geladen fontbytes; een fallbackfont is een fout.
2. Gebruik DPR1 voor baselinebrowsercaptures, vaste browser- en font-renderomgeving, 100% browserzoom en dezelfde viewport. Test 200% zoom afzonderlijk voor toegankelijkheid.
3. Bevries datum/clock/randomness via het testharnas, niet met wijzigingen in productielogica. Zet de preview op pauze voor statische vergelijking. Wacht animaties af of freeze ze op hetzelfde eindframe; leg de gekozen methode vast.
4. Bevries alle providerresponsen en netwerkvariatie. Een live wedstrijduitslag is geen stabiele golden.
5. Gebruik dezelfde scrollpositie, actieve tabs, expanded-items, selectie en cursor/focusstatus. Vergelijk focused en unfocused niet door elkaar.
6. Screenshots mogen geen wachtwoorden, API-keys, device secrets, persoonsgegevens uit productie of signed assettoegang bevatten.

## 4. Matrix en dekking

`inventory/VISUAL-CASES.csv` heeft unieke IDs en concrete setup/assertions. Het is geen verplichte blind uit te voeren reeks van 1.209 dure end-to-endruns: goedkope renderer-/componentcaptures mogen de broadcastcombinaties dekken. Functionele server-/hardwarechecks blijven afzonderlijke gates.

| Groep | Aantal | Dekking |
|---|---:|---|
| ROUTE | 342 | Elke niet-endpointregel uit de routemapping op twee passende formaten, inclusief productie-only en native oppervlakken |
| RESP | 66 | Kernroutes op 360, 390, 412, 768, 1024 en 1440px breed |
| SHELL | 16 | Zoeken, account, context, meldingen, Meer, rail, keyboard en reduced motion |
| PLAYLIST | 96 | Editor/picker/duur/bulk/volgorde/publiceren/dirty/undo/thema op zes viewports, inclusief telefoon landscape |
| WIZARD | 64 | Iedere bron- en Studio-wizardstap op mobiel en desktop |
| STUDIO | 24 | Gallery, nieuw ontwerp, inspector, assets, layout, mobile panels, huisstijl, undo/redo, genereren en TV-data |
| TEMPLATE | 44 | Alle elf bestaande templates × FieldFlow/OnzeTrots TV × twee oriëntaties |
| TV | 48 | Acht originele TV-composities × twee oriëntaties × schaal75/100/140 |
| TV-STATE | 80 | Alle acht TV-composities × twee oriëntaties × vijf data-/beeldvarianten |
| LED | 240 | Vier stijlen × acht momenten × twee oriëntaties × ondersteunde schaalscenario's |
| LED-PART | 48 | Vier deelschaalcontrols op70/200, drie OnzeTrots-stijlen, twee oriëntaties |
| SPORTLINK | 72 | Zes gegevensfamilies × twee thema's × twee oriëntaties × schaal70/100/140 |
| MENU | 12 | Twee thema's × twee oriëntaties × schaal70/100/140 en categorieweergave |
| YOUTUBE | 4 | Fallbackkaart in beide thema's en oriëntaties |
| STATE | 45 | Productiegebonden laad-/fout-/rechten-/conflict-/offlinegevallen |
| DEVICE | 8 | Echte telefoons, keyboard, Player online/offline, LG, Android TV en themerollback |

API-endpoints zijn geen visuele pagina's en krijgen geen fictieve screenshot. Hun autorisatie-/mutatie-/releasechecks volgen de workflow- en contractmapping en de bestaande repositorytests. Routes zonder directe Sites-uitvoering hebben `STYLE_AND_PRESERVATION`; daarmee wordt nadrukkelijk geen pixelgelijke screenshotreferentie geclaimd. Ze moeten wel dezelfde gedeelde componenttaal krijgen en hun bestaande functionaliteit behouden.

## 5. Viewports en schaalgrenzen

Controlbaseline: 360×800, 390×844, 412×915, 768×1024, 1024×768 en 1440×900. Extra playlistlandscape: 844×390. Broadcast: 1920×1080 en 1080×1920, zonder browsermodalmarges in de uiteindelijke output.

Controleer concreet de grenzen 650/700/720/767/800/960/999/1024/1050/1100px waar de betrokken module omschakelt. Maak bij een fout rond een breakpoint aanvullende `grens−1`, `grens`, `grens+1` captures; trek geen nieuw universeel breakpoint over alle componenten.

LED `blue`, `paper` en `onzetrots-tv` hebben overall en titel-/stand-/logo-/teamschalen70–200%. De schermvullendpreset is overall125, titel110, stand120, logo130, teams110; safeArea3; branding en sceneLabel uit. Legacy FieldFlow gebruikt de bestaande algemene70–140%-schaal. De gewone TV Studio heeft75–140%. Test alleen controls die voor de gekozen stijl werkelijk aangeboden worden.

De vier LED-stijlen hebben verschillende contractvelden: de drie oudere gebruiken `config.ledTheme`; OnzeTrots TV gebruikt `themeId:'onzetrots-tv'`. Eén opgeslagen `fieldflow`-waarde is geen vervanging voor beide contractsituaties.

## 6. Pariteitsassertions

Vergelijk side-by-side en met image-overlaydiff. Beoordeel eerst geometrie: paneelbreedten, ruimte, uitlijning, lettertype/-gewicht, tekstafbreking, thumbnailuitsnede, buttons, statuschips, randen, schaduw, actieve selectie en scrollbar. Onderzoek daarna contrast en branding.

Geen acceptatie op basis van uitsluitend een groot pixelverschilpercentage. Anti-aliasverschil kan gemotiveerd worden; een ander font, andere compositie, verdwenen beeld, mobiele overlap of afgekapte tekst niet. Gebruik geen screenshot van de pagina als productinterface.

Bij echte productiegegevens is een andere naam of teller terecht; vergelijk daarvoor een fixtureversie met identieke data. Semantische correcties zoals capabilities, immutable publicatiestatus of lege providerdata mogen een gemotiveerd verschil veroorzaken. Dat verschil moet in het bewijs staan en mag niet ongemerkt worden afgedaan als “ongeveer hetzelfde”.

Voor broadcast moet dezelfde geselecteerde template/presentatie zichtbaar zijn in:

- Studio- en dynamische editorpreview;
- playlistthumbnail en grote preview;
- immutable configuratie/snapshot met juiste datarevisie;
- geëxporteerde Studio PNG/MP4 waar van toepassing;
- moderne Player en ondersteunde Static LG-/fallbackuitvoer.

Controleer dat eigen/thematexturen, fonts, maskers, club-/tegenstanderlogo's, sponsorlogo's en achtergronden in de releaseassetverzameling zitten. Een goed renderende Control-preview met 404 in de Player is `FAIL`.

## 7. Productiejourneys die screenshots niet vervangen

1. Mobiel: upload twee bestanden → wacht op ready → voeg beide in gekozen volgorde toe → wijzig duur → verplaats item → sla op → herlaad → publiceer naar twee schermen → controleer actieve release.
2. Bewaak concurrency: hetzelfde concept in twee sessies; tweede stale save toont herstel en wist geen wijzigingen stilzwijgend.
3. Afgebroken verbinding tijdens upload/save/publish: geen false-success; retry idempotent; geen dubbele playlistitems of releases zonder nieuwe inhoud.
4. Themawissel per slide, selectie en playlist behoudt inhoud en providerbinding; opslaan/herladen, undo en nieuwe publicatie consistent.
5. Sportlink/LED Scores/Twelve-configuratie blijft server-only; permissies/featureflags/providerfouten eerlijk zichtbaar. Onderliggende event/dataregels blijven gelijk.
6. Schermgroepselectie dedupliceert targets. Publicatie weigert niet-ready of incompatibele assets en respecteert bestaande readiness-/opslagchecks.
7. Live data verversen volgens bestaand contract zonder de gepubliceerde configuratie mutabel te maken. Oude opgeslagen thema's en releases blijven decodeerbaar.
8. Offline Player speelt last-known-good door; onvolledige of corrupte pending assets activeren niet; nieuwe volledige release wisselt op natuurlijke grens.
9. Controleer repository-only routes, native functies en platformrollen uit de routemapping: een mooier Control-scherm mag deze niet verwijderen.
10. Normale playback behoudt de goedgekeurde locked VeyoCast system mark op de bestaande plaats/opacity; clubthemawoordmerken zijn content, geen vervangende softwarewatermark.

## 8. Vrijgavecriteria

Voer de in `AGENTS.md` en relevante canons vereiste gates uit voor de gewijzigde gebieden. Minimaal de toepasselijke lint/typecheck/unit/build, UI a11y/e2e en bij geraakt schema RLS/reset; bij output-/assetwijzigingen Player/offlinechecks. Neem geen historisch groen resultaat over als nieuw bewijs.

Werk eerst de sourcepariteit af, daarna de echte productiestates en operationele journeys. Presenteer een overzicht van geslaagde, mislukte, geblokkeerde en niet-toepasselijke cases. De visuele review bevat representatieve desktop-, telefoon- en TV-captures plus alle gevonden afwijkingen; de volledige artifactset blijft reproduceerbaar.

Productiepromotie verloopt via de bestaande beschermde deploymentketen na stagingacceptatie. Deze overdracht geeft geen bewijs dat de productie-integratie al is gebouwd, uitgerold of op fysieke schermen is goedgekeurd.
