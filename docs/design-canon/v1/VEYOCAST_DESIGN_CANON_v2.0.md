---
title: "VeyoCast Bold - Design & Product Canon"
subtitle: "Normatieve merk-, website-, dashboard- en playerstandaard"
author: "VeyoCast"
date: "14 juli 2026"
lang: nl-NL
---

# Inhoud

1. Documentstatus
2. Merkfundament
3. Logo- en iconsysteem
4. Kleurcanon
5. Typografie
6. Raster, spacing en containers
7. Geometrie, surfaces, borders en elevation
8. Iconografie, fotografie en beeldtaal
9. Motion en transities
10. Contentdesign en informatiehiërarchie
11. Gedeelde componentarchitectuur
12. Marketingwebsitecanon
13. Control dashboardcanon
14. Player- en ClubTV-canon
15. Cross-platform responsive canon
16. Toegankelijkheid
17. Developerimplementatie
18. Design governance
19. Release- en kwaliteitschecklists
20. Canonieke pagina- en stateblauwdrukken
21. Volledige componentinventaris
22. Tokenreferentie
23. Verboden patronen
24. Companion files

# Documentstatus

**Document:** VeyoCast Bold - Design & Product Canon  
**Versie:** 2.1.2  
**Status:** Canoniek / normatief; merkassetset v1.0 goedgekeurd  
**Datum:** 21 juli 2026  
**Reikwijdte:** merkidentiteit, marketingwebsite, control dashboard, mobiele PWA, player setup, fullscreen playback, ClubTV-templates, design tokens, componentbibliotheek, contentstijl, toegankelijkheid en governance.

Dit document is de bron van waarheid voor alle zichtbare VeyoCast-ervaringen. Het doel is niet alleen om een stijl te beschrijven, maar om beslissingen vast te leggen die ontwerpers, developers, marketeers, supportmedewerkers en externe partners consequent moeten toepassen.

## 0.1 Normatieve taal

In dit canon worden drie niveaus gebruikt:

- **MOET**: verplicht. Afwijken vereist een formeel goedgekeurde uitzondering.
- **HOORT**: de standaardkeuze. Afwijken mag alleen met een aantoonbare functionele reden.
- **MAG**: toegestaan binnen de genoemde randvoorwaarden.

## 0.2 Volgorde van autoriteit

Bij tegenstrijdigheid geldt deze volgorde:

1. Het exact aangeleverde, goedgekeurde logo- of iconbestand.
2. De tokens in `veyocast-design-tokens.json`.
3. Dit canon.
4. De gedeelde componentbibliotheek en Storybook-documentatie.
5. Product- of campagnespecifieke ontwerpen.
6. Visuele mock-ups en sfeerbeelden.

Mock-ups illustreren de richting, maar veranderen geen logo-assets, kleurwaarden, toegankelijkheidseisen of functionele productregels.

## 0.3 Productgrenzen

VeyoCast bestaat visueel uit drie samenhangende maar verschillende omgevingen:

1. **Brand & Marketing** - overtuigend, editorial, expressief en conversiegericht.
2. **Control** - operationeel, rustig, informatierijk en zeer bruikbaar.
3. **Player** - tijdens normale weergave terughoudend als software; setup en diagnostiek zijn merkbaar VeyoCast, de clubcontent staat centraal en alleen de goedgekeurde vaste system mark blijft zichtbaar.

De systemen delen dezelfde merkcodes, maar hebben verschillende dichtheid, typografische schaal en interactielogica.

\newpage

# 1. Merkfundament

## 1.1 Kernbelofte

**VeyoCast zet clubschermen aan.**

VeyoCast maakt communicatie zichtbaar, actueel en onmogelijk om te missen. Het product verbindt media, playlists, publicaties, schermen, clubinformatie en sponsorcontent in één betrouwbare omgeving.

## 1.2 Positionering

VeyoCast is een modern narrowcasting- en ClubTV-platform voor sportverenigingen en organisaties die één of meerdere schermen professioneel willen beheren. Het merk combineert:

- de directheid van sportcommunicatie;
- de discipline van een operationeel softwareplatform;
- de visuele kracht van editorial design;
- de betrouwbaarheid van offline-first playback;
- de eenvoud die vrijwilligers en clubbeheerders nodig hebben.

## 1.3 Merkpersoonlijkheid

| As | VeyoCast staat voor | VeyoCast vermijdt |
|---|---|---|
| Visueel | krachtig, grafisch, precies | zacht, pastelkleurig, generiek |
| Tone of voice | direct, helder, volwassen | hype, jargon, kinderlijkheid |
| Product | betrouwbaar, controleerbaar, transparant | magie zonder uitleg, verborgen status |
| Sportcontext | authentieke clubcultuur | mascottes, clip-art, clichés |
| Premium | materiaalgevoel, discipline, ritme | overdadige effecten, luxe om de luxe |
| Technologie | menselijk uitgelegd | futuristische sciencefictiontaal |

## 1.4 Vijf ontwerpprincipes

### 1. Zichtbaarheid boven decoratie

Elke keuze moet informatie sterker maken. Grote typografie, duidelijke statussen en gecontroleerd contrast hebben voorrang op ornament.

### 2. Controle moet voelbaar zijn

De gebruiker ziet altijd wat actief is, wat verandert, welke schermen geraakt worden en of een publicatie gereed is. Acties hebben duidelijke gevolgen en terugkoppeling.

### 3. Betrouwbaarheid is een visuele eigenschap

Offline status, releaseversies, synchronisatie, opslag en laatste verbinding worden begrijpelijk gepresenteerd. Geen verborgen systeemtoestand en geen zwart scherm als standaardfoutbeeld.

### 4. Clubcontent is de held

In de player domineert de club, niet VeyoCast. Setup, pairing, startup en
diagnostiek zijn volledig merkbaar; tijdens normale playback blijft uitsluitend
de locked VeyoCast-lock-up linksonder op exact 60% opacity zichtbaar. Deze
expliciet goedgekeurde system mark bevat geen metadata, status of bediening.

### 5. Eén systeem, verschillende intensiteiten

Marketing mag expressief zijn, Control moet kalm zijn en de Player moet vanaf afstand leesbaar zijn. Dezelfde tokens worden per context anders gedoseerd.

## 1.5 Merkzin en kernboodschappen

**Primaire merkzin:** `Zet je clubschermen aan.`

**Ondersteunende formuleringen:**

- Alles wat speelt, direct in beeld.
- Eén platform. Volledige controle.
- Blijft spelen, ook als internet even niet meewerkt.
- Geef sponsoren de zichtbaarheid die ze verdienen.
- Beheer ieder scherm vanuit één omgeving.
- Gebouwd voor betrouwbare ClubTV.

Claims MOETEN controleerbaar zijn. Er worden geen klanten, integraties, beschikbaarheden, prijzen, prestaties of testimonials verzonnen.

## 1.6 Terminologie

Gebruik overal dezelfde producttaal:

| Term | Definitie | Niet gebruiken als synoniem |
|---|---|---|
| Scherm | De door de club beheerde bestemming of locatie | monitoraccount, kijker |
| Player | Het geregistreerde afspeelapparaat of de PWA | gebruiker, browserpagina |
| Playlist | Bewerkbare inhoudsvolgorde | kanaal, feed |
| Concept | Nog niet gepubliceerde playliststatus | tijdelijk, kladje als formele status |
| Release | Onveranderlijke gepubliceerde versie | live concept |
| Publiceren | Een nieuwe release maken en toewijzen | opslaan |
| Actieve release | De versie die daadwerkelijk speelt | nieuwste versie |
| Gewenste release | De versie die de player moet downloaden | wachtrij zonder context |
| Synchroniseren | Downloaden en verifiëren van benodigde inhoud | live streamen |
| Media | Afbeeldingen, video's en later ondersteunde assets | bestanden als enige term |
| Tenant | Interne technische term voor een organisatie | zichtbaar gebruiken waar 'vereniging' of 'organisatie' begrijpelijker is |

## 1.7 Tone of voice

VeyoCast schrijft in helder Nederlands, met actieve werkwoorden en korte zinnen. De gebruiker wordt aangesproken met **je**. Technische details worden vertaald naar gevolgen.

**Goed:** `Release 13 wordt gedownload. Release 12 blijft spelen tot alle bestanden gereed zijn.`  
**Niet goed:** `Atomic deployment in progress.`

**Goed:** `Kantine TV is 12 minuten niet gezien.`  
**Niet goed:** `Heartbeat timeout.`

**Goed:** `Probeer opnieuw`  
**Niet goed:** `Submit retry request`

### Schrijfregels

- Knoppen beginnen met een werkwoord: `Publiceren`, `Scherm koppelen`, `Media uploaden`.
- Statussen zijn zelfstandige, herkenbare woorden: `Online`, `Offline`, `Synchroniseren`, `Gereed`.
- Foutmeldingen noemen oorzaak voor zover veilig, gevolg en herstelactie.
- Vermijd uitroeptekens in de productinterface; marketing mag ze spaarzaam gebruiken.
- Vermijd Engels waar een goede Nederlandse term bestaat.
- Gebruik zinskapitalisatie, geen Title Case in Nederlandse interfacekoppen.
- Getallen en eenheden krijgen een spatie: `18,4 GB`, `14:30 uur`, `78%`.

\newpage

# 2. Logo- en iconsysteem

## 2.1 Status van het merkasset

De officiële VeyoCast-merkassetset v1.0 is op 20 juli 2026 goedgekeurd door ontwerper en merkeigenaar Danny Goldenbelt. De aangeleverde primaire, inverse en compacte SVG-masters zijn byte-ongewijzigde **locked assets** in `assets/brand/`. Alleen de daar gedocumenteerde monochrome, favicon-, PWA-, Apple touch- en social-afgeleiden zijn eveneens officieel. Iedere andere variant vereist nieuwe expliciete goedkeuring.

Locked masters worden als goedgekeurde vector geplaatst; ze worden niet opnieuw getekend, getraceerd, nagemaakt met een lettertype of automatisch gereconstrueerd.

Het logo MOET:

- volledig zichtbaar zijn;
- dezelfde verhouding en interne afstand behouden;
- zonder effecten worden geplaatst, behalve de hieronder toegestane lichte
  rotatie en subtiele glow;
- optisch scherp worden gerenderd;
- uit een goedgekeurd bronbestand komen.

Het logo MAG NIET:

- worden uitgerekt, afgesneden of scheefgetrokken;
- een andere letterspatiëring of woordmerktypografie krijgen;
- een harde rand, zware schaduw, bevel of gradient krijgen;
- worden gecombineerd met een zelfgemaakt monogram;
- als tekst worden nagetypt om het asset te vervangen;
- per scherm of tenant van kleur veranderen.

Een lichte rotatie en een subtiele, zachte glow zijn als plaatsingseffect altijd
toegestaan. Ze vereisen geen aparte goedkeuring zolang het asset volledig
zichtbaar en direct herkenbaar blijft, de glow de officiële kleur niet verandert
en de rotatie niet groter is dan 4 graden.

### Expliciet goedgekeurde logo-animatie

Logo-animatie is alleen toegestaan nadat de merkeigenaar de concrete toepassing
expliciet heeft goedgekeurd. Die toestemming geldt uitsluitend voor de genoemde
toepassing en vormt geen algemene goedkeuring voor andere schermen of campagnes.

Bij een goedgekeurde logo-animatie:

- blijft het locked asset zelf byte-ongewijzigd;
- beweegt alleen het volledige asset als één geheel;
- blijven verhouding, kleur, clear space en herkenbaarheid intact;
- mogen de algemeen toegestane lichte rotatie en subtiele glow worden gebruikt;
- is er een statische variant voor `prefers-reduced-motion`;
- zijn morphing, recolouring, uitsnijden en nieuw getekende tussenframes
  verboden.

## 2.2 Vereiste officiële varianten

Alleen de locked masters en expliciet goedgekeurde technische afgeleiden zijn officieel. De v1.0-assetset bevat:

- primaire horizontale lock-up;
- goedgekeurd compact icoon;
- expliciet goedgekeurde inverse lock-up voor donkere ondergronden;
- goedgekeurde monochrome zwarte en witte lock-up;
- faviconbestanden;
- maskable PWA-iconen;
- social avatar-export.

Andere kleuren, geometrieën, uitsneden of lock-ups zijn niet officieel. Op een donkere of drukke achtergrond wordt de goedgekeurde inverse asset of een vlakke Paper White-logoplaat gebruikt.

## 2.3 Operationele plaatsing

Dit canon legt plaatsingsmaten vast, geen geometrische reconstructie van het logo. De originele asset bepaalt altijd zijn verhouding.

| Toepassing | Aanbevolen zichtbare hoogte | Plaatsing |
|---|---:|---|
| Marketingheader desktop | 24-30 px | links, verticaal gecentreerd |
| Marketingheader mobiel | 22-26 px | links, volledig zichtbaar |
| Dashboardsidebar | 24-28 px | bovenaan met royale ademruimte |
| Login/splash | 32-48 px | gecentreerd of links uitgelijnd |
| Player startup 1080p | 80-120 px | gecentreerd, niet dominant |
| Pairing-/diagnostiekscherm 1080p | 64-96 px | boven of links van instructie |
| Presentatiecover | afhankelijk van formaat | klein ten opzichte van headline |
| Favicon | goedgekeurd compact iconasset | nooit de volledige lock-up verkleinen |

Bij kleine breedtes wordt niet automatisch een letter uit de volledige lock-up geknipt. Gebruik daarvoor uitsluitend het afzonderlijk goedgekeurde compacte VeyoCast-icoon.

## 2.4 Vrije ruimte

Bij de master-vector is geen afzonderlijke formele clearspace-bouwtekening aangeleverd. Daarom wordt geen vermeende constructiemaat uit het raster afgeleid en geldt deze operationele regel:

- rond het logo MOET zichtbaar meer ruimte zitten dan tussen naburige interface-elementen;
- het logo raakt nooit een rand, foto, regel, badge of CTA;
- in headers is minimaal één standaardruimte-eenheid van 24 px rond de zichtbare logo-inktvorm vereist;
- op drukke fotografie wordt een effen contrasterende plaat gebruikt.

## 2.5 Achtergronden

**Toegestaan:**

- Paper White;
- effen witte kaart;
- goedgekeurde inverse asset op Ink Black;
- Paper White-plaat op Ink Black;
- rustige fotografie met voldoende effen ruimte en bewezen contrast.

**Niet toegestaan:**

- het logo direct op wedstrijdactie met onvoldoende contrast;
- transparante glasplaten met ruis achter het logo;
- drukke sponsorwanden;
- gradients die door de lettervormen heen lopen;
- willekeurige clubkleuren als logovariant.

## 2.6 Compact icoon

Het goedgekeurde compacte icoon is het primaire compacte merkteken. Het kan worden gebruikt voor:

- favicon;
- PWA-icon;
- social avatar;
- device tile;
- klein app-symbool wanneer de volledige lock-up niet past;
- goedgekeurde hoekbranding in setup- of diagnostiekcontext.

Het icoon wordt exact als asset gebruikt. Geometrie, hoeken, materiaalstructuur en verhoudingen worden niet aangepast.

## 2.7 Maskable PWA-icon

Voor een maskable icon geldt:

  - het volledige goedgekeurde icoon blijft binnen de centrale veilige zone;
- cruciale delen bevinden zich niet in de buitenste 20% van het canvas;
- de achtergrondkleur is een expliciet onderdeel van het goedgekeurde iconbestand;
- er wordt geen extra afgerond vierkant, ring of schaduw door het platformontwerp toegevoegd;
- exports worden visueel getest als cirkel, squircle, afgeronde rechthoek en adaptive icon.

Aanbevolen exports: 192, 256, 384, 512 en 1024 px. De 512 px-versie is minimaal vereist voor de PWA-manifestset.

## 2.8 Bestandsnamen

Gebruik vaste, betekenisvolle namen:

```text
veyocast-logo-primary.svg
veyocast-logo-inverse.svg
veyocast-logo-monochrome-black.svg
veyocast-logo-monochrome-white.svg
veyocast-icon-primary.svg
veyocast-icon-maskable-512.png
veyocast-favicon-32.png
veyocast-social-avatar-1024.png
```

`final-logo-2-new.png` en vergelijkbare namen zijn verboden in de canonieke assetmap.

## 2.9 Logo-QA

Voor iedere release wordt gecontroleerd:

- komt het bestand uit de officiële assetmap;
- is de verhouding ongewijzigd;
- is het logo volledig zichtbaar;
- is het contrast voldoende;
- is er geen effect of kleurwijziging;
- is op mobiel geen zelfgemaakte verkorte variant gebruikt;
- is de resolutie passend bij de weergave;
- is het asset niet onnodig als base64 of screenshot opgenomen.

\newpage

# 3. Kleurcanon

## 3.1 Kernpalet

| Naam | Hex | Primaire rol |
|---|---|---|
| Ink Black | `#0A0A0A` | hoofdachtergrond, hoofdtekst, premium contrast |
| Paper White | `#FAFAF7` | warme lichte achtergrond, tekst op donker |
| Electric Orange | `#FF5C20` | primaire actie, merkaccent, aandacht |
| Signal Blue | `#315CFF` | systeemstatus, focus, informatieve accenten |
| Soft Grey | `#E8E8E3` | rustige vlakken, scheiding, lichte achtergrond |

Het palet is bewust klein. Een pagina of scherm HOORT niet alle vijf kleuren met gelijke intensiteit te gebruiken.

## 3.2 Kleurdosering

**Marketing dark default:**

- 65-80% Ink Black en donkere neutralen;
- 10-20% Paper White voor tekst en lichte secties;
- 5-10% Electric Orange voor acties en krachtige woorden;
- 0-8% Signal Blue voor systeem- of sponsorsecties;
- Soft Grey voor scheiding en ondersteunende tekst.

**Dashboard:**

- 70-90% neutrale oppervlakken;
- Orange alleen voor primaire actie of expliciete aandacht;
- Blue voor focus, selectie en synchronisatie;
- semantische kleuren alleen voor toestand.

**Playercontent:**

- templates mogen clubkleuren gebruiken als contentthema;
- VeyoCast Orange en Blue functioneren als templateaccent, niet als verplichte clubkleur;
- tekstcontrast en afstandsleesbaarheid gaan voor merkdosering.

## 3.3 Contrastmatrix

| Combinatie | Contrast | Gebruik |
|---|---:|---|
| Ink Black op Paper White | 18,93:1 | alle tekstgroottes |
| Paper White op Ink Black | 18,93:1 | alle tekstgroottes |
| Ink Black op Electric Orange | 6,41:1 | primaire knoptekst, labels |
| Paper White op Electric Orange | 2,95:1 | niet voor tekst; alleen grote decoratieve vormen |
| Paper White op Signal Blue | 4,89:1 | normale tekst en knoppen |
| Ink Black op Signal Blue | 3,87:1 | alleen grote tekst; niet als standaard |
| Signal Blue op Paper White | 4,89:1 | links, focus, statuslabels |
| Signal Blue op Soft Grey | 4,16:1 | grote tekst of niet-tekstuele indicatoren |
| Paper White op Soft Grey | 1,18:1 | verboden voor tekst |

De primaire Orange-knop gebruikt daarom **Ink Black tekst**, niet witte tekst.

## 3.4 Neutrale schaal

De interface gebruikt een uitgebreide neutrale schaal om diepte te maken zonder decoratieve gradients:

- `neutral-0 #FFFFFF`
- `neutral-25 #FAFAF7`
- `neutral-50 #F4F4F0`
- `neutral-100 #E8E8E3`
- `neutral-200 #D7D7D1`
- `neutral-300 #B9B9B2`
- `neutral-400 #92928B`
- `neutral-500 #6C6C67`
- `neutral-600 #4D4D49`
- `neutral-700 #333331`
- `neutral-800 #1F1F1E`
- `neutral-850 #171717`
- `neutral-900 #111111`
- `neutral-950 #0A0A0A`
- `neutral-1000 #050505`

## 3.5 Semantische kleuren

Merkaccenten en systeemstatus zijn verschillende dingen. Orange betekent niet automatisch fout en Blue betekent niet automatisch online.

| Semantiek | Solid | Lichte surface | Donkere tekst/variant | Betekenis |
|---|---|---|---|---|
| Success | `#18794E` | `#E8F7EF` | `#0E5A38` / `#46D18C` | gereed, actief, geslaagd |
| Warning | `#B95C00` | `#FFF0E2` | `#763A00` / `#FFAD66` | aandacht, capaciteit, bijna verlopen |
| Critical | `#C7322B` | `#FDEDEC` | `#861E1A` / `#FF716B` | fout, offline als actie nodig is, mislukking |
| Info | `#315CFF` | `#EEF1FF` | `#1E39B5` / `#8FA4FF` | synchronisatie, informatie, focus |

Elke status bevat minimaal tekst of een herkenbaar icoon naast kleur.

## 3.6 Light theme

```text
Background       #FAFAF7
Surface          #FFFFFF
Surface muted    #F4F4F0
Surface strong   #E8E8E3
Text             #0A0A0A
Text muted       #4D4D49
Text subtle      #6C6C67
Border           #D7D7D1
Border strong    #B9B9B2
Focus            #315CFF
Action           #FF5C20
On action        #0A0A0A
```

## 3.7 Dark theme

```text
Background       #0A0A0A
Surface          #111111
Surface muted    #171717
Surface strong   #1F1F1E
Text             #FAFAF7
Text muted       #C9C9C4
Text subtle      #92928B
Border           #2A2A28
Border strong    #3D3D39
Focus            #6681FF
Action           #FF5C20
On action        #0A0A0A
```

De dark theme is geen negatieve kopie van light. Donkere vlakken worden met subtiele helderheidsstappen en borders onderscheiden; zware schaduwen zijn zelden nodig.

## 3.8 Gradients

Generieke SaaS-gradients zijn niet canoniek. Gradients zijn alleen toegestaan als functionele beeldbehandeling:

- donkere overlay om tekst op fotografie leesbaar te maken;
- subtiele transparante fade bij scroll- of cropgrenzen;
- contenttemplate met gecontroleerde overgang tussen foto en effen vlak.

Geen kleurrijke mesh-gradients, neon-glow of regenboogachtergronden.

\newpage

# 4. Typografie

## 4.1 Fontfamilies

**Display:** `Inter Tight`  
Voor marketingheadlines, grote sectiekoppen en playerheadlines.

**UI en body:** `Inter`  
Voor dashboard, formulieren, tabellen, langere tekst en navigatie.

**Monospace:** `Geist Mono`  
Voor pairingcodes, versies, technische identifiers en codevoorbeelden.

Fallbacks MOETEN in CSS zijn opgenomen. Het logo wordt nooit met deze fonts nagemaakt.

## 4.2 Gewichten

- 400 Regular - langere bodytekst.
- 500 Medium - labels, navigatie, compacte interface.
- 600 Semibold - componenttitels en knoppen.
- 700 Bold - koppen en belangrijke numerieke waarden.
- 800 ExtraBold - grote marketing- en playerheadlines, spaarzaam.

Dunne gewichten zijn niet canoniek; ze verliezen kracht en leesbaarheid op schermen.

## 4.3 Marketingtype-schaal

| Token | Desktop | Tablet | Mobiel | Gebruik |
|---|---|---|---|---|
| Display XXL | 96/88 | 72/68 | 52/50 | hero met korte regel |
| Display XL | 72/68 | 60/58 | 44/44 | alternatieve hero |
| H1 | 64/60 | 52/52 | 40/42 | paginatitel |
| H2 | 48/52 | 40/44 | 32/36 | sectiekop |
| H3 | 36/40 | 32/36 | 26/32 | featuregroep |
| H4 | 28/34 | 26/32 | 22/28 | kaart/ondersectie |
| Lead | 20/30 | 19/29 | 18/28 | hero-intro |
| Body L | 18/29 | 18/28 | 17/27 | prominente body |
| Body M | 16/26 | 16/25 | 16/24 | standaard body |
| Body S | 14/22 | 14/22 | 14/21 | ondersteunend |
| Label | 12/16 | 12/16 | 12/16 | eyebrow, metadata |

Displaytekst gebruikt letterspatiëring tussen `-0.055em` en `-0.025em`. Bodytekst gebruikt `-0.01em` tot `0`.

## 4.4 Dashboardtype-schaal

| Rol | Grootte / regel | Gewicht | Opmerking |
|---|---:|---:|---|
| Pagina H1 | 32/40 | 700 | één per pagina |
| Sectie H2 | 20/28 | 650-700 | duidelijke scangrens |
| Subsectie H3 | 16/24 | 650 | boven tabel of groep |
| Metric | 32/36 | 700 | met zichtbaar label |
| Card title | 14/20 | 600 | compact |
| Body | 14/20 | 400 | standaard interface |
| Dense table | 13/18 | 400-500 | alleen desktop |
| Label | 12/16 | 500-600 | form en metadata |
| Caption | 12/16 | 400 | niet lichter dan voldoende contrast |
| Code/ID | 12/18 | 500 mono | versies en codes |

De minimale standaard interfacegrootte is 14 px. 12 px is alleen voor secundaire metadata, nooit voor primaire acties of kernstatus.

## 4.5 Player-type-schaal op 1080p

| Rol | Richtwaarde | Gebruik |
|---|---:|---|
| Hero | 96-144 px | matchday/hoofdboodschap |
| Titel | 64-84 px | programma, uitslagen, sponsor |
| Subtitel | 44-56 px | teams, aanbod, actie |
| Body | 36-48 px | korte uitleg of rijtekst |
| Label | 28-34 px | tijd, veld, kleedkamer, metadata |
| Kleine metadata | 24-28 px | alleen indien niet essentieel |
| Pairingcode | 72-112 px mono | afstandsleesbaar |

Op 4K worden waarden bij voorkeur ongeveer verdubbeld of via viewporttokens geschaald. Tekst wordt nooit verkleind om te veel content op één slide te persen; content wordt gepagineerd.

## 4.6 Regelbreedte

- marketing body: 50-75 tekens per regel;
- dashboardbeschrijving: 45-80 tekens;
- playerboodschap: maximaal 35-45 tekens per regel;
- CTA-label: bij voorkeur 1-4 woorden;
- tabelkolommen: inhoudelijk compact, geen alinea's.

## 4.7 Hoofdlettergebruik

- Nederlandse headings gebruiken zinskapitalisatie.
- Eyebrows mogen uppercase met `0.08em` tracking.
- Volledig uppercase wordt niet gebruikt voor lange koppen.
- Statusbadges gebruiken zinskapitalisatie: `Synchroniseren`, niet `SYNCHRONISEREN`.
- Sponsor- of teamnamen volgen hun officiële schrijfwijze.

## 4.8 Numerieke typografie

Voor statusoverzichten en tabellen worden tabular figures gebruikt wanneer getallen verticaal uitlijnen. Tijden gebruiken `14:30`, percentages `78%`, opslag `18,4 GB`, versies `versie 13` of compact `v13` waar ruimte beperkt is.

\newpage

# 5. Raster, spacing en containers

## 5.1 Basiseenheid

De basis is **4 px**. Alle afstanden, afmetingen en rastergaps worden hiervan afgeleid, behalve optische correcties van 1-2 px voor iconen en borders.

Canonical spacing tokens:

`0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 112, 128, 160, 192 px`.

## 5.2 Breakpoints

| Naam | Vanaf | Hoofdgebruik |
|---|---:|---|
| xs | 360 px | klein mobiel |
| sm | 480 px | mobiel breed |
| md | 768 px | tablet / grote telefoon landscape |
| lg | 1024 px | compacte laptop / dashboardomslagpunt |
| xl | 1280 px | desktop |
| 2xl | 1440 px | wide desktop |
| 3xl | 1600 px | ultrawide contentregeling |

Breakpoints zijn inhoudsgedreven. Een component mag eerder omslaan wanneer inhoud anders onleesbaar wordt.

## 5.3 Marketingcontainers

| Container | Maxbreedte | Gebruik |
|---|---:|---|
| Reading | 720 px | artikelen, lange copy, FAQ |
| Content | 1280 px | standaard secties |
| Wide | 1440 px | hero, productvisual, device stage |
| Full bleed | viewport | achtergronden, foto, blue/dark secties |

Horizontale padding:

- 24 px op mobiel;
- 32 px vanaf 768 px;
- 48 px vanaf 1280 px;
- 64 px vanaf 1440 px.

## 5.4 Marketinggrid

Desktop gebruikt een 12-koloms grid met 24-32 px gutters. Tablet gebruikt 6 kolommen. Mobiel gebruikt 4 kolommen of één contentkolom met interne subgrid.

Typische verdelingen:

- hero: 5/7 of 6/6;
- tekst + productvisual: 4/8;
- use cases: 3/3/3/3;
- editorial split: 5/7;
- knowledge article: 2/8/2.

## 5.5 Dashboardcontainer

Het dashboard is fluid en gebruikt niet standaard een gecentreerde marketingcontainer.

```text
Sidebar expanded      248 px
Sidebar collapsed      72 px
Topbar                  64 px
Page gutter desktop     32 px
Page gutter tablet      24 px
Page gutter mobile      16 px
Inspector standard     360 px
Inspector wide         440 px
```

De hoofdcontent mag op ultrawide schermen een interne maxbreedte krijgen voor formulieren, maar fleet tables en editors benutten functioneel beschikbare breedte.

## 5.6 Dashboardgrid

- Overzicht: 12 kolommen, gap 24 px.
- Metrics: 3, 4 of 6 kaarten afhankelijk van breedte.
- Tabellen: volledige breedte.
- Detailpagina: 8/4 of 9/3 met inspector.
- Playlisteditor: library 280-320 px, timeline flexibel, inspector 360-440 px.
- Onder 1024 px wordt de playlisteditor een sequentiële ervaring met tabs of stappen; geen geplette drie panelen.

## 5.7 Playercontainers

Normale playback gebruikt de volledige viewport. Binnen contenttemplates gelden safe zones:

- standaard title-safe: 5% aan alle kanten;
- action/QR-safe: 7,5% aan alle kanten;
- rekening houden met 3-5% overscan op oudere televisies;
- sponsorstrips raken nooit de fysieke schermrand;
- essentiële informatie staat niet achter een ticker, klok of overlay.

## 5.8 Verticale ritmes

**Marketingsecties:** 96-160 px verticale padding desktop, 72-112 tablet, 56-80 mobiel.  
**Dashboardsecties:** 24-40 px tussen hoofdgroepen, 16-24 px binnen kaarten.  
**Player:** ritme wordt bepaald door veilige zones en afstandsleesbaarheid; grote lege ruimte is functioneel.

## 5.9 Full-bleed en inset

Een full-bleed achtergrond mag viewportbreed zijn, maar tekst en bediening blijven in een contentcontainer. Afbeeldingen mogen full-bleed zijn wanneer:

- de crop is geregisseerd;
- cruciale personen of logo's buiten crop-risico blijven;
- tekst op een apart, stabiel vlak staat;
- mobiel een eigen crop/focal point heeft.


\newpage

# 6. Geometrie, surfaces, borders en elevation

## 6.1 Vormtaal

VeyoCast is strak, technisch en editorial. Geometrie ondersteunt precisie:

- rechte lijnen en duidelijke uitlijning;
- beperkte afronding;
- compacte, functionele controls;
- asymmetrische marketingcomposities binnen een strikt raster;
- geen bubbelachtige kaartwereld.

## 6.2 Radii

| Token | Waarde | Gebruik |
|---|---:|---|
| none | 0 px | tabellen, editorial frames, playerzones |
| xs | 2 px | kleine chips, interne accenten |
| sm | 4 px | badges, compacte inputs |
| md | 6 px | standaard buttons en inputs |
| lg | 8 px | kaarten, popovers, dialogs |
| xl | 12 px | grote device panels of hero-productstage |
| 2xl | 16 px | uitzonderlijk: groot mobiel sheet of showcaseframe |
| full | 9999 px | statusdot, avatar, enkele pills |

Standaard kaarten gebruiken 6-8 px, niet 20-32 px. Pricingcards en grote marketingstages mogen 12 px gebruiken. Playercontent gebruikt meestal 0-4 px.

## 6.3 Borders

- standaard border: 1 px;
- sterke scheiding: 2 px;
- light theme: `#D7D7D1` of `#B9B9B2`;
- dark theme: `#2A2A28` of `#3D3D39`;
- Orange border is een actieve of geselecteerde toestand, geen decoratieve omlijsting;
- Blue border is focus, informatie of synchronisatie;
- foutstatus combineert critical border met tekst en icoon.

## 6.4 Schaduwen

Schaduw is ondersteunend, nooit de primaire scheiding.

| Niveau | Gebruik |
|---|---|
| none | standaard dashboardkaarten en playercontent |
| sm | zwevend filter, sticky toolbar, subtiele kaart op lichte achtergrond |
| md | popover, dropdown, sheet |
| lg | modal of photorealistische device stage |

Dark mode gebruikt vooral border en luminantieverschil. Een glow rond Orange of Blue is niet canoniek.

## 6.5 Oppervlaktehiërarchie

**Light:** background → surface muted → surface → surface strong.  
**Dark:** background → surface → surface muted → surface strong.

Een pagina gebruikt maximaal drie gelijktijdige oppervlakniveaus binnen één viewport. Te veel geneste kaarten veroorzaken visuele ruis.

## 6.6 Inset versus floating

- Tabellen, timelines en editors zijn bij voorkeur inset in de pagina, niet als losse zwevende kaarten.
- Popovers en dialogs zijn floating.
- Marketingproductvisuals mogen floating lijken door device mock-ups.
- Playercontent staat nooit als klein dashboardkaartje op het televisiescherm; het gebruikt het volledige canvas.

\newpage

# 7. Iconografie, fotografie en beeldtaal

## 7.1 Interface-iconen

De standaardbibliotheek is **Lucide** of een functioneel equivalente line-iconset met consistente geometrie.

- stroke: 1,75-2 px;
- standaardmaten: 16, 20 en 24 px;
- 32 px alleen voor empty states en marketingfeatures;
- iconen staan optisch, niet alleen mathematisch, gecentreerd;
- één iconstijl per productoppervlak.

Gevulde iconen worden alleen gebruikt voor geselecteerde toestand, sterke status of platformconventie. Duotone, emoji en cartooniconen zijn niet canoniek.

## 7.2 Icoonbetekenis

Een icoon mag nooit zelfstandig een onverwachte of kritieke actie representeren. `Publiceren`, `Verwijderen`, `Koppelen` en `Intrekken` hebben een zichtbaar tekstlabel of tooltip plus toegankelijke naam.

Vaste betekenissen:

- play: preview of afspelen;
- upload: media uploaden;
- screen/monitor: scherm;
- list/video-stack: playlist;
- radio/waves: synchroniseren of verbinding;
- cloud-off: offline;
- check-circle: gereed/gepubliceerd;
- alert-triangle: aandacht;
- x-circle: fout/mislukt;
- rotate-cw: opnieuw proberen of synchroniseren;
- publish/send: publiceren, mits tekstlabel aanwezig.

## 7.3 Productillustraties

VeyoCast gebruikt geen cartoonillustraties als primaire visuele taal. Toegestaan zijn:

- technische schema's;
- eenvoudige lijnillustraties voor onboarding;
- abstracte gridcomposities met Orange/Blue datapunten;
- functionele flowdiagrammen;
- echte UI-screenshots.

Illustraties blijven vlak, beperkt in kleur en zonder mascottes.

## 7.4 Fotografie

Fotografie voelt echt, lokaal en professioneel:

- moderne sportclub, clubhuis, velden, vrijwilligers en teams;
- natuurlijk of gecontroleerd warm licht;
- zichtbare menselijke activiteit zonder chaotische drukte;
- authentieke materialen: hout, beton, metaal, clubtextiel;
- sterke compositie met ruimte voor typografie;
- actieve sportbeelden met duidelijke focale persoon.

Vermijd:

- generieke stockfoto's van juichende zakenmensen;
- stadionbeelden die niet passen bij verenigingssport;
- overdreven neon of sciencefiction;
- clichévoetballen op gras als los decoratief object;
- onrealistische scherminstallaties of zichtbare kabelchaos;
- bekende merken of echte clubs zonder toestemming.

## 7.5 Beeldbehandeling

- Fotografie blijft geloofwaardig; geen extreem HDR-effect.
- Donkere overlay: 20-55% Ink Black wanneer tekst over beeld staat.
- Orange en Blue kunnen als vlak, regel of subtiel lichtaccent worden toegevoegd, niet als volledige kleurfilter.
- Portretten worden niet afgesneden bij ogen, handen of belangrijke actie.
- Thumbnails krijgen een vast focal point per breakpoint.

## 7.6 Productscreenshots

Screenshots MOETEN:

- functioneel geloofwaardige gegevens tonen;
- geen willekeurige decoratieve grafieken bevatten;
- juiste statuskleuren en termen gebruiken;
- persoonsgegevens vermijden;
- versies, schermnamen en tijden consistent houden;
- op marketingpagina's voldoende groot zijn om kerninformatie te herkennen.

UI-tekst in visuals wordt niet met pseudo-Latijn of onleesbare willekeurige tekst gevuld.

## 7.7 Club- en sponsorassets

Clublogo's, sponsorlogo's en foto's worden als tenantcontent behandeld. VeyoCast verandert hun verhouding niet. In player-templates worden sponsorlogo's geplaatst op een contrasterend vlak met voldoende ademruimte.

## 7.8 QR-codes

- minimale rustige rand: vier modules;
- geen logo in de QR zonder bewezen scanbaarheid;
- op 1080p bij normale clubhuisafstand minimaal circa 220 px;
- altijd een korte tekstuele actie of URL als alternatief;
- test op het fysieke scherm, niet alleen in Figma;
- geen QR op bewegend of druk beeld zonder effen plaat.

\newpage

# 8. Motion en transities

## 8.1 Bewegingsprincipes

Beweging legt verandering uit, bevestigt oorzaak en gevolg en bewaart oriëntatie. VeyoCast beweegt niet om speels te lijken.

## 8.2 Duurtokens

| Token | Duur | Gebruik |
|---|---:|---|
| instant | 80 ms | press state, kleurreactie |
| fast | 140 ms | hover, tooltip, kleine indicator |
| standard | 220 ms | dropdown, accordion, tab |
| slow | 320 ms | dialog, sheet, layoutwisseling |
| scene | 480 ms | marketingproductstage, playertransition |

## 8.3 Easing

- standaard: `cubic-bezier(0.2, 0, 0, 1)`;
- enter: `cubic-bezier(0, 0, 0.2, 1)`;
- exit: `cubic-bezier(0.4, 0, 1, 1)`;
- emphasized: `cubic-bezier(0.2, 0.8, 0.2, 1)`.

Geen elastische bounce of overshoot in operationele interfaces.

## 8.4 Dashboardmotion

Toegestaan:

- sidebar in- en uitklappen;
- sheet en dialog;
- progressief invullen van progressbars;
- reorderfeedback bij drag-and-drop;
- statusdot met rustige pulse tijdens actieve synchronisatie;
- skeleton naar content zonder grote layout shift.

Niet toegestaan:

- kaarten die continu zweven;
- tellingen die bij iedere paginaweergave lang animeren;
- draaiende dashboardachtergronden;
- parallax in tabellen;
- loadinganimaties langer dan nodig.

## 8.5 Marketingmotion

Marketing mag meer ritme hebben, maar blijft functioneel:

- productstage kan een korte, gecontroleerde state transition tonen;
- secties mogen subtiel in beeld komen;
- Orange markeringen kunnen lineair worden onthuld;
- geen autoplay carrousel met essentiële informatie;
- beweging stopt of reduceert bij `prefers-reduced-motion`.

## 8.6 Playertransities

Canonieke transities:

- harde editorial cut;
- crossfade van 300-500 ms;
- directionele wipe van 400-600 ms;
- mask transition van maximaal 600 ms.

Niet toegestaan:

- spin, bounce, flip, cube, extreme zoom;
- logo morphing;
- stroboscopische flitsen;
- langdurige 3D-overgangen;
- transities die leesbare tijd afnemen van een korte slide.

## 8.7 Reduced motion

Bij `prefers-reduced-motion`:

- marketingreveal wordt direct of als korte fade uitgevoerd;
- dashboardlayout wisselt zonder grote translatie;
- player gebruikt cuts of korte fades;
- pulserende statussen worden statisch met tekstlabel.

\newpage

# 9. Contentdesign en informatiehiërarchie

## 9.1 Algemene hiërarchie

Elk scherm beantwoordt in deze volgorde:

1. Waar ben ik?
2. Wat is de huidige toestand?
3. Wat is hier de belangrijkste taak?
4. Welke gevolgen heeft de actie?
5. Wat kan ik daarna doen?

## 9.2 Interfacecopy

Knoppen zijn concreet:

- `Nieuwe playlist`
- `Media uploaden`
- `Publiceren`
- `Scherm koppelen`
- `Bekijk details`
- `Probeer opnieuw`
- `Intrekken`

Vage labels zoals `Doorgaan`, `OK`, `Bevestigen` en `Meer` worden alleen gebruikt wanneer context volstrekt duidelijk is. Destructieve knoppen noemen het object: `Scherm verwijderen`.

## 9.3 Statuscopy

Canonical statuses:

### Scherm/device

- Online
- Offline
- Synchroniseren
- Update gereed
- Opslag bijna vol
- Onderhoud
- Uitgeschakeld
- Ingetrokken

### Media

- Uploaden
- Verwerken
- Gereed
- Validatie mislukt
- Verwijderd

### Playlist/publicatie

- Concept
- Klaar voor review
- Publiceren
- Gepubliceerd
- Downloaden
- Verifiëren
- Wissel gereed
- Mislukt

Statusnamen worden niet per pagina opnieuw uitgevonden.

## 9.4 Foutmeldingen

Formule:

**Wat ging mis. Wat is het gevolg. Wat kan de gebruiker doen.**

Voorbeeld:

`De video kon niet worden verwerkt. De playlist kan pas worden gepubliceerd wanneer dit bestand is vervangen of verwijderd. Upload een MP4 met H.264-video.`

Technische details zoals errorcode mogen in een uitklapbaar detail of kopieerbare supportcode staan, niet als hoofdboodschap.

## 9.5 Lege toestanden

Een empty state is niet alleen leegte. Hij bevat:

- een duidelijke titel;
- één korte uitleg;
- één primaire volgende stap;
- optioneel een secundaire documentatielink;
- geen enorme decoratieve illustratie die de taak verdringt.

Voorbeeld: `Nog geen playlists` + `Maak een playlist om media in een vaste volgorde naar je schermen te publiceren.` + `Nieuwe playlist`.

## 9.6 Datums en tijden

- interface: `14 juli 2026`, `14:30`, `2 minuten geleden`;
- audit en technische details: absolute tijd plus timezone indien relevant;
- relatieve tijd heeft een tooltip of detail met absolute tijd;
- player gebruikt grote, lokale tijdnotatie;
- weekdagen voluit wanneer ruimte dit toelaat.

## 9.7 Persoons- en clubdata

Mock-ups gebruiken fictieve, consistente namen. Productie toont alleen data waarvoor de gebruiker rechten heeft. Geen gevoelige persoonsgegevens in marketingbeelden, playerdiagnostiek of openbare schermen.

\newpage

# 10. Gedeelde componentarchitectuur

De componentbibliotheek wordt opgebouwd in lagen:

1. **Primitives** - Box, Stack, Grid, Text, Icon, Divider, AspectRatio.
2. **Controls** - Button, Input, Select, Checkbox, Menu, Tabs.
3. **Data display** - Card, Table, ListRow, Badge, Timeline.
4. **Feedback** - Alert, Toast, Progress, Skeleton, EmptyState.
5. **Patterns** - PageHeader, ScreenFleetTable, PlaylistEditor, PairingFlow.
6. **Templates** - marketingpagina, dashboardpagina, playercontenttemplate.

Productcode gebruikt geen lokaal nagemaakte buttons of badges wanneer een canonieke component bestaat.

## 10.1 Buttons

### Varianten

**Primary**  
Orange achtergrond, Ink Black tekst, geen zware schaduw. Eén primaire knop per lokale actiegroep.

**Secondary**  
Transparante of surface-achtergrond, duidelijke border, tekst in foreground.

**Tertiary/Ghost**  
Geen border in rust; subtiele hover/active surface.

**Destructive**  
Critical solid of outlined, alleen voor vernietigende actie.

**Inverse**  
Voor donkere hero of player-setup; gebruikt bewezen contrast.

### Maten

| Size | Hoogte | Horizontale padding | Icoon |
|---|---:|---:|---:|
| xs | 32 px | 12 px | 16 px |
| sm | 36 px | 14 px | 16 px |
| md | 40 px | 16 px | 18 px |
| lg | 44 px | 18 px | 20 px |
| xl | 48 px | 20 px | 20-24 px |

Touchtargets zijn minimaal 44 x 44 px, ook wanneer het zichtbare control kleiner is.

### Staten

- hover: lichte luminantieverschuiving, geen sprong;
- active: 1-2 px optische press of donkerder vlak;
- focus: 2 px Blue ring met 2 px offset;
- loading: label blijft of wordt aangevuld met spinner; breedte verandert niet;
- disabled: lagere nadruk, cursor en semantiek correct; niet gebruiken om rechten uit te leggen zonder tekst.

## 10.2 Icon buttons

Icon buttons hebben altijd een toegankelijke naam. Op desktop verschijnt een tooltip; op touch is het icoon herkenbaar of wordt een label toegevoegd. Kritieke en zeldzame acties blijven tekstknoppen.

## 10.3 Links

- Inline links zijn onderstreept of krijgen een duidelijke onderstreepte hover/focus.
- Navigatielinks mogen zonder underline, maar current state is zichtbaar en semantisch.
- Externe links mogen een extern-icoon tonen.
- Orange wordt niet voor alle links gebruikt; Blue is de primaire functionele linkkleur in light theme.

## 10.4 Form fields

Een standaardveld bevat:

1. label;
2. control;
3. optionele helpertekst;
4. optionele fouttekst;
5. optionele teller of constraint.

Placeholder is geen label. Foutstatus gebruikt border, icoon en tekst. Read-only is visueel anders dan disabled en blijft selecteerbaar waar nuttig.

## 10.5 Search en combobox

Search toont een clear action zodra inhoud aanwezig is. Resultaten worden gegroepeerd en keyboardbedienbaar. Op mobiel mogen lange comboboxen als full-screen sheet openen.

## 10.6 Checkbox, radio en switch

- Checkbox: meerdere onafhankelijke keuzes.
- Radio: precies één keuze uit een set.
- Switch: onmiddellijke binaire instelling; niet gebruiken wanneer opslaan nog apart nodig is.

Een switchlabel beschrijft de actieve eigenschap: `Audio afspelen`, niet `Audio aan/uit`.

## 10.7 Badges en statusdots

Badges zijn compact en informatief. Ze zijn niet interactief tenzij expliciet als filterchip ontworpen. Statusdot staat naast tekst behalve in extreem compacte fleet-overzichten, waar een tooltip en tabelkop de betekenis behouden.

## 10.8 Alerts, banners en toasts

- Alert: binnen contentcontext.
- Banner: app- of paginabreed systeembericht.
- Toast: tijdelijke bevestiging of achtergrondactie.
- Kritieke fouten blijven zichtbaar totdat de gebruiker ze oplost of bewust sluit.
- Succes-toasts verdwijnen na 4-6 seconden, maar pauzeren bij hover/focus.

## 10.9 Cards

Een kaart heeft een duidelijke reden: groepering, interactie of vergelijking. Een hele pagina wordt niet in tientallen identieke kaarten opgebroken.

Canonical card anatomy:

- header: titel/status/action;
- body: primaire informatie;
- footer: metadata of acties;
- hover alleen als de kaart interactief is;
- geselecteerde kaart gebruikt border + surface + eventueel checkmark.

## 10.10 Tables en data grids

Tabellen zijn de standaard voor vergelijkbare operationele data. Ze gebruiken:

- zichtbare kolomkoppen;
- 44-52 px rijhoogte standaard, 36-40 px alleen dense desktop;
- sticky header bij lange lijsten;
- rechte uitlijning voor tekst, rechts voor numerieke waarden;
- sorteerindicator naast label;
- acties in laatste kolom;
- selection toolbar bij multi-select;
- horizontaal scrollen of card/list transformatie op smalle schermen.

Een mobiele telefoon toont geen miniatuur-desktoptabel.

## 10.11 Dialogs en sheets

Dialog voor beslissingen en beperkte formulieren. Sheet voor inspectie, filter of langere zij-inhoud. Op mobiel wordt een complex dialog vaak een full-screen sheet.

Destructieve dialogs noemen object en gevolg. De primaire focus start niet automatisch op de destructieve knop.

## 10.12 Progress en loading

- determinate progress wanneer het percentage bekend is;
- indeterminate alleen wanneer geen bruikbare voortgang beschikbaar is;
- publicatie toont fase én percentage/bestanden;
- skeleton volgt de uiteindelijke layout;
- spinner zonder context is niet genoeg voor processen langer dan ongeveer twee seconden.

## 10.13 Empty, loading, error en permission states

Elk belangrijk patroon heeft vier expliciete states:

- loading;
- empty;
- ready;
- error.

Rechten worden niet alleen door verborgen controls gecommuniceerd. Een viewer ziet waar relevant dat een actie beheerrechten vereist.

## 10.14 Drag-and-drop

Drag-and-drop is aanvullend. Playlistitems hebben ook keyboardbedienbare `Omhoog` en `Omlaag` acties. Tijdens drag:

- het bronitem blijft herkenbaar;
- de dropzone is duidelijk;
- auto-scroll is beheerst;
- na drop wordt de nieuwe positie aangekondigd;
- ongeldige drops tonen reden.

## 10.15 Component naming

Code en Figma gebruiken PascalCase voor componenten en slashstructuur voor varianten:

```text
Button / Primary / MD
Badge / Status / Syncing
Card / Screen / Offline
Dialog / Destructive / Remove screen
PlayerTemplate / Matchday / Landscape
```


\newpage

# 11. Marketingwebsitecanon

## 11.1 Visuele hoofdmodus

De canonieke marketingexpressie is **dark editorial**: Ink Black als dominante achtergrond, Paper White typografie, Electric Orange voor primaire actie en headline-accent, Signal Blue voor systeem- en sponsorsecties. Lichte Paper White-secties worden doelbewust afgewisseld om ritme en leesbaarheid te creëren.

De website voelt niet als een verzameling losse SaaS-kaarten. Secties hebben grote typografie, sterke uitlijning, zichtbare grids, productbeelden en duidelijke inhoudelijke overgangen.

## 11.2 Global page shell

```text
Viewport background     Ink Black of Paper White per route
Header height desktop   72 px
Header height mobile    64 px
Content max             1280 px
Wide stage max          1440 px
Reading max             720 px
Side padding            24 / 32 / 48 / 64 px
Section spacing         56-160 px afhankelijk van breakpoint
```

De website heeft een `skip to content`-link, één `main`-landmark, één H1 en een semantische footer.

## 11.3 Header

### Desktop anatomy

1. exact officieel logoasset;
2. primaire navigatie;
3. optionele dropdownindicatoren;
4. `Inloggen` als rustige actie;
5. primaire CTA `Start met VeyoCast`.

Canonical navigatie:

- Product
- Oplossingen
- Voor verenigingen
- Integraties
- Prijzen
- Kennisbank

De header is sticky wanneer dit de oriëntatie helpt. Bij scroll verandert hij van transparant/achtergrond naar een solide surface met subtiele border; geen sterke blur of glas-effect.

### Desktopmaten

- hoogte 72 px;
- logo zichtbaar 24-30 px hoog;
- nav gap 24-32 px;
- CTA 40 px hoog;
- border-bottom 1 px bij scrolled state;
- z-index sticky 100.

### Mobiel

- logo links, hamburger rechts;
- geen zelfgemaakt compact woordmerk;
- menu opent als full-height of brede sheet;
- alle links hebben minimaal 48 px rijhoogte;
- primaire CTA staat onder de navigatielinks en is full-width;
- focus blijft in de sheet tot sluiten.

## 11.4 Hero

Canonical copy:

**H1:** `Zet je clubschermen aan.`  
**Lead:** `Beheer content, playlists en schermen vanuit één krachtig platform. Voor clubnieuws, wedstrijden, sponsoren en alles wat binnen jouw vereniging speelt.`  
**Primary:** `Bekijk VeyoCast`  
**Secondary:** `Plan een demonstratie`

### Layout

Desktop gebruikt 5/7 of 6/6. Copy staat links of linksboven; de productstage neemt visueel meer ruimte dan de tekst in beslag, zonder de H1 te verdringen.

### Hero anatomy

- optionele eyebrow, maximaal 3 woorden;
- H1 van 2-4 regels;
- lead van maximaal 3-4 regels desktop;
- twee CTA's;
- compacte benefit row met maximaal vier geloofwaardige voordelen;
- productvisual met dashboard en playerpreview;
- geen logo-cloud met fictieve klanten.

### Herohoogte

- desktop: minimaal circa 720 px of viewportgericht;
- tablet: contentgedreven, meestal 680-820 px;
- mobiel: geen geforceerde viewporthoogte; copy en stage volgen natuurlijk.

### Accentgebruik

Een kernwoord zoals `aan.` mag Orange zijn. Niet elk zelfstandig naamwoord wordt gekleurd. Blue verschijnt in productstatus, niet als willekeurig decoratief woord.

## 11.5 Productstage

De productstage toont echte productlogica:

- screen fleet met online/offline;
- actieve playlist en releaseversie;
- mediaoverzicht;
- playlisteditor;
- publicatieactie;
- playerpreview;
- storage en synchronisatie;
- connected devices.

### Stagevormen

- browserframe in desktophero;
- gelaagde laptop/monitor/telefooncompositie;
- fullscreen product screenshot in Paper White-sectie;
- dark UI detail met beperkte annotaties.

Device mock-ups blijven realistisch en ondersteunen het scherm, niet andersom. Geen onnodige smartphone als decoratie wanneer de content onleesbaar wordt.

## 11.6 Sectie: Alles wat speelt, direct in beeld

Vier vaste use cases:

1. Clubnieuws en mededelingen.
2. Wedstrijden en uitslagen.
3. Sponsoren en partners.
4. Kantine, evenementen en vrijwilligers.

### Layoutopties

- 2x2 editorial grid;
- vier kolommen met visuele preview;
- verticale hoofdstukken met afwisselende media.

Elke use case bevat titel, maximaal 60-90 woorden, één geloofwaardige preview en optioneel één link. Geen lange lijst met generieke features.

## 11.7 How it works

Drie canonieke stappen:

1. **Maak content** - upload afbeeldingen en video's of gebruik gekoppelde clubinformatie.
2. **Bouw je playlist** - bepaal volgorde, duur en inhoud.
3. **Publiceer naar je schermen** - de nieuwe release wordt gedownload en gesynchroniseerd.

De flow `Media → Playlist → Publicatie → Schermen` wordt visueel als systeem uitgelegd. Pijlen zijn decoratief; de stappen staan semantisch in een geordende lijst.

Op mobiel wordt de flow verticaal en blijft ieder screenshot groot genoeg.

## 11.8 Reliability section

Canonical headline:

**`Blijft spelen. Ook als internet even niet meewerkt.`**

De sectie is Ink Black en toont begrijpelijk:

- lokaal opgeslagen media;
- actieve release;
- nieuwe release in download;
- verificatie;
- offline playback;
- automatische herverbinding;
- opslagbeschikbaarheid;
- bevestiging dat de oude release blijft spelen.

Geen terminalvensters of technische architectuur als hoofdbeeld. De uitleg is voor clubbeheerders; technische verdieping kan via een link naar beveiliging of betrouwbaarheid.

## 11.9 Sports club section

Canonical headline:

**`Gemaakt voor het ritme van jouw vereniging.`**

Inhoud kan tonen:

- wedstrijdprogramma;
- uitslagen;
- standen;
- kleedkamerindeling;
- sponsor van de week;
- vrijwilligers gezocht;
- kantineactie;
- clubagenda.

Formulering voor integraties:

`Koppel clubdata en externe systemen via slimme integraties.`

Er wordt niet beweerd dat een specifieke koppeling beschikbaar is zolang dat niet productmatig bevestigd is. Beschikbaarheidsbadges gebruiken `Beschikbaar`, `Pilot`, `Gepland` of `Neem contact op`, met duidelijke betekenis.

## 11.10 Sponsor section

Canonical headline:

**`Geef sponsoren de zichtbaarheid die ze verdienen.`**

De sectie gebruikt Signal Blue als dominant vlak of als groot paneel. Toon:

- sponsor slides;
- campagnerotatie;
- matchday sponsor;
- club partner;
- screen selection;
- preview op clubhouse televisie;
- QR-campagne;
- conceptuele sponsorpakketten.

Fictieve sponsorlogo's zijn neutraal en niet verwarrend gelijk aan bekende merken. QR-codes hebben een tekstalternatief.

## 11.11 Feature matrix

Acht hoofdfeatures:

- Media beheren
- Playlists publiceren
- Schermen koppelen
- Offline blijven afspelen
- Team en rechten
- Status en monitoring
- Clubhuisstijl
- Integraties

De matrix is editorial: duidelijke lijnen, grote featuretitels, korte uitleg en functioneel icoon. Geen acht identieke zwevende rounded cards met lange schaduw.

## 11.12 Social proof zonder fabricatie

Toegestane veilige boodschappen:

- Ontwikkeld voor moderne sportverenigingen.
- Beheer ieder scherm vanuit één omgeving.
- Gebouwd voor betrouwbare ClubTV.
- Geschikt voor één scherm of een volledig schermnetwerk.

Een proof strip mag producteigenschappen tonen, maar geen fictieve aantallen, klantnamen, logo's of quotes.

## 11.13 Pricing preview

Drie conceptuele pakketten:

### Start

Voor essentiële content en één clubscherm.

### Club

Voor meerdere schermen, teamleden en sponsorcontent.

### Network

Voor grotere organisaties en geavanceerd schermbeheer.

Zolang prijzen niet formeel zijn vastgesteld, worden geen eurobedragen getoond. De CTA is `Vraag toegang aan` of `Neem contact op`. Het aanbevolen pakket wordt niet met manipulatieve urgentie gepresenteerd.

### Pricing card anatomy

- pakketnaam;
- korte doelgroepzin;
- lijst met 5-8 kernmogelijkheden;
- duidelijke beperkingen of contactroute;
- één CTA;
- optionele `Meest gekozen`-badge alleen met bewijs.

## 11.14 Final CTA

Canonical headline:

**`Klaar om je club aan te zetten?`**

Primary: `Start met VeyoCast`  
Secondary: `Bekijk de productdemo`

De CTA krijgt een ruime dark of Blue section met weinig afleiding. Geen extra formulieren als een eenvoudige route volstaat.

## 11.15 Footer

### Inhoud

- exact logoasset;
- Product;
- Oplossingen;
- Integraties;
- Support;
- Beveiliging;
- Privacy;
- Status;
- Contact;
- juridische links;
- copyright.

### Layout

Desktop: 4-6 kolommen, logo/positionering in eerste kolom.  
Mobiel: gestapeld; linkgroepen mogen als accordions, maar blijven zonder JavaScript toegankelijk.

De footer bevat geen overvolle social iconrij tenzij kanalen actief worden beheerd.

## 11.16 Productpagina

Een productdetailpagina gebruikt:

1. compact hero met kernbelofte;
2. grote productstage;
3. capability chapters;
4. reliability explanation;
5. security/permissions;
6. responsive/mobile proof;
7. CTA.

De pagina verklaart Control en Player als twee delen van één systeem zonder de gebruiker met infrastructuurjargon te belasten.

## 11.17 Oplossingspagina

Gebruik cases, niet alleen features. Mogelijke pagina's:

- ClubTV in de kantine;
- Sponsorcommunicatie;
- Wedstrijddag;
- Multi-screen clubhuis;
- Verenigingscommunicatie;
- Grotere organisaties/netwerken.

Elke pagina heeft probleem, gewenste situatie, VeyoCast-flow, voorbeeldschermen, relevante features en CTA.

## 11.18 Integratiepagina

Componenten:

- uitleg van snapshots en betrouwbaarheid;
- provider cards;
- statussen;
- gegevenscategorieën;
- privacy en beheer;
- aanvraagroute.

Providerlogo's worden alleen met toestemming gebruikt. `Gepland` is geen belofte van datum.

## 11.19 Kennisbank

### Index

- zoekveld;
- categorieën;
- aanbevolen artikelen;
- recente updates;
- contact/supportroute.

### Article body

- max 720 px;
- duidelijke H2/H3;
- stappen als genummerde lijst;
- screenshots met captions;
- waarschuwingen als Alert-component;
- code of identifiers in mono;
- `Laatst bijgewerkt` en productversie waar relevant.

## 11.20 Formulieren

Marketingformulieren zijn kort. Demoaanvraag bevat alleen benodigde velden:

- naam;
- organisatie/vereniging;
- e-mail;
- aantal schermen of situatie;
- optioneel toelichting;
- toestemming/privacy.

Inline fouten verschijnen bij velden én in een samenvatting bovenaan bij submit. Succes toont de vervolgstap en verwachte reactietijd zonder onrealistische belofte.

## 11.21 SEO en metadata

Elke route bevat:

- unieke title;
- unieke meta description;
- canonical URL;
- Open Graph-image in VeyoCast-stijl;
- correcte headingstructuur;
- structured data waar passend;
- menselijke URL's;
- noindex voor staging, auth en interne previewroutes.

OG-beelden gebruiken exact logoasset, grote headline, Ink/Paper/Orange en voldoende safe zone voor crops.

## 11.22 Responsive websitegedrag

### Onder 768 px

- één kolom;
- hero productstage onder copy;
- full-width CTA's waar hiërarchie dit vraagt;
- nav als sheet;
- use cases gestapeld;
- pricing één kolom;
- screenshotdetails niet te klein;
- tabellen worden cards of horizontaal scrollbaar.

### 768-1279 px

- 6-koloms grid;
- twee koloms secties waar inhoud past;
- nav kan compact desktop of menu zijn op basis van tekstbreedte;
- device stage vereenvoudigt.

### 1280 px en hoger

- 12-koloms grid;
- volledige asymmetrische composities;
- maximale contentbreedtes blijven gelden;
- geen extreem lange regels op ultrawide.

## 11.23 Website anti-patterns

- hero met generieke paars-blauwe gradient;
- illustratieve mascotte;
- 20 afgeronde featurecards;
- onleesbare UI-screenshot als achtergrondtextuur;
- bewegende carrousel met cruciale informatie;
- fake logos/testimonials;
- witte tekst op Orange CTA;
- logo nagetypt in header;
- twee H1's;
- mobile screenshot als gekrompen desktoppagina;
- stockbeelden zonder clubcontext;
- claims dat integraties live zijn zonder bevestiging.


\newpage

# 12. Control dashboardcanon

## 12.1 Rol van Control

Control is het beheeroppervlak voor platformadmins, tenantadmins, editors en viewers. Het dashboard voelt professioneel en krachtig, maar blijft bruikbaar voor vrijwilligers die niet dagelijks met software werken.

Prioriteiten:

1. actuele toestand;
2. duidelijke vervolgstap;
3. veilige publicatie;
4. zichtbare gevolgen;
5. snelle foutdiagnose;
6. geen onnodige visuele drukte.

## 12.2 Themakeuze

Control ondersteunt light en dark theme. De gebruiker kan een voorkeur instellen; systeemvoorkeur mag standaard worden gevolgd. Functionele betekenis blijft gelijk in beide thema's.

- Light is optimaal voor lange sessies, tabellen en formulieren.
- Dark sluit aan bij marketing en kan prettig zijn in clubomgevingen.
- De componentstructuur verandert niet tussen thema's.
- Tenantkleuren nemen de interface niet over; ze worden gebruikt in brandingpreviews en clubcontent.

## 12.3 App shell

### Desktop

```text
Sidebar               248 px expanded / 72 px collapsed
Topbar                 64 px
Page gutter            32 px
Main min width          0; content may shrink correctly
Inspector              360 or 440 px
Sticky action/footer    context dependent
```

### Sidebar anatomy

1. exact VeyoCast-logo;
2. tenant switcher of platformcontext;
3. primaire navigatie;
4. eventueel gescheiden platformsectie;
5. help/support;
6. user profile.

Tenantnavigatie:

- Overzicht
- Media
- Playlists
- Schermen
- Integraties
- Team
- Auditlog
- Instellingen

Platformnavigatie:

- Overzicht
- Tenants
- Gebruikers
- Schermen
- Systeemstatus
- Auditlog
- Instellingen

Actieve item gebruikt surface, duidelijke tekst en eventueel Orange of Blue accent. Niet elk item krijgt een gekleurd icoon.

### Collapsed sidebar

- alleen officiële iconen of functionele navigatie-iconen;
- logo wordt niet zelf ingekort; gebruik alleen een afzonderlijk goedgekeurd compact icoon;
- tooltips tonen labels;
- actieve item blijft visueel herkenbaar;
- collapsekeuze wordt lokaal onthouden.

### Mobiel/tablet

Onder 1024 px wordt sidebar een sheet. De topbar bevat menu, context, titel of breadcrumb en primaire acties. Een permanente bottom nav wordt alleen gebruikt wanneer maximaal vijf hoofdroutes voldoende zijn; standaard is een navigatiesheet.

## 12.4 Topbar

Componenten:

- breadcrumbs of compacte context;
- tenantnaam;
- globale zoekactie;
- command shortcut;
- notificaties;
- help;
- usermenu;
- contextuele primaire actie, bijvoorbeeld `Nieuwe playlist`.

De topbar wordt niet gevuld met statistieken. Notificaties tonen aantoonbare actiepunten, geen algemene activity feed.

## 12.5 Page header

Canonical anatomy:

1. breadcrumb;
2. H1;
3. korte uitleg of status;
4. primaire actie;
5. secundaire acties of overflowmenu;
6. optionele tabs.

Voorbeeld:

**Goedemorgen, Danny**  
`Dit is de actuele status van jouw VeyoCast-omgeving.`

Bij resourcepagina's:

**Kantine hoofdscherm**  
`Online · Release 12 actief · 2 minuten geleden gezien`

Op mobiel komen acties onder titel of in een sticky actionbar; de H1 blijft als eerste informatie.

## 12.6 Tenant overview

### Hoofdblokken

- 6 actieve schermen;
- 1 scherm offline;
- 12 playlists;
- 84 mediabestanden;
- 2 publicaties in verwerking;
- 18,4 GB opslag gebruikt;
- schermstatus;
- actieve publicatie;
- recente playlists/media;
- concrete aandachtspunten.

### Metrics

Metriccards bevatten label, waarde, status/context en optionele link. Geen decoratieve grafiek als één getal volstaat. De volgorde is operationeel: schermen en publicaties vóór media-aantallen.

## 12.7 Schermstatus

Canonical kolommen:

- Scherm
- Status
- Actieve playlist
- Releaseversie
- Laatst gezien
- Opslag
- Verbinding
- Actie

Canonical voorbeelden:

- Kantine hoofdscherm
- Entree
- Sponsorwand
- Kleedkamergang
- Bestuurskamer
- Jeugdgebouw

### Statuslogica

- **Online:** heartbeat binnen de vastgestelde gezonde drempel.
- **Offline:** geen heartbeat binnen kritieke drempel.
- **Synchroniseren:** nieuwe release wordt gedownload of geverifieerd.
- **Update gereed:** pending release is volledig beschikbaar en wacht op switch.
- **Opslag bijna vol:** onder veiligheidsmarge.
- **Onderhoud:** bewust gemarkeerd, geen onverwachte storing.

`Offline` gebruikt niet automatisch schreeuwerig rood in iedere rij. Critical wordt gebruikt wanneer actie nodig is; anders een ingetogen status met duidelijk tekstlabel.

## 12.8 Screen card op mobiel

Een schermkaart toont in volgorde:

1. naam en locatie;
2. status;
3. actieve playlist en release;
4. laatst gezien;
5. storage/verbinding als relevant;
6. primaire detailactie.

Niet alle desktopkolommen worden letterlijk onder elkaar gekopieerd; secundaire diagnostiek staat in detail.

## 12.9 Schermdetail

### Header

- schermnaam;
- locatie;
- statusbadge;
- laatste heartbeat;
- acties: preview, synchroniseren, opnieuw koppelen, intrekken, meer.

### Tabs/secties

1. Overzicht
2. Diagnostiek
3. Releases
4. Gebeurtenissen
5. Instellingen

### Overzicht

- huidige playlist;
- actieve release;
- gewenste release;
- storagegebruik;
- appversie;
- platform/capabilities;
- recent item of screenshot indien veilig;
- health summary.

### Diagnostiek

- networkstatus;
- cached asset count;
- storage quota/usage;
- syncfase;
- laatste foutcode;
- persistent storage status;
- device session status;
- app- en buildversie.

Technische termen krijgen een korte uitleg of tooltip. Gevoelige tokens worden nooit getoond.

## 12.10 Pairingflow

### Stap 1 - Scherm maken/selecteren

Naam, locatie, oriëntatie, resolutie en optionele tags.

### Stap 2 - Code invoeren of QR scannen

- zes tekens;
- expires in duidelijke tijd;
- rate limit en foutmelding begrijpelijk;
- geen ambiguïteit tussen O/0 en I/1.

### Stap 3 - Device bevestigen

Toon device naam, browser/platform, scherm en tenant. De beheerder bevestigt bewust.

### Stap 4 - Download en gereed

Toon dat de eerste release wordt voorbereid; geef aan wanneer het scherm veilig kan worden gebruikt.

Pairingdialog wordt op mobiel full-screen. Expired codes hebben één duidelijke `Nieuwe code`-actie.

## 12.11 Media library

### Toolbar

- zoekveld;
- filters op type, status, datum, gebruik;
- grid/list toggle;
- selectieacties;
- `Media uploaden` primary.

### Media card anatomy

- thumbnail;
- type-icoon;
- titel/filename;
- afmetingen of duur;
- bestandsgrootte;
- status;
- gebruik in playlists;
- overflowacties.

### Statussen

- Uploaden
- Verwerken
- Gereed
- Validatie mislukt
- Verwijderd

Processing toont fase indien nuttig: `Video normaliseren`, `Thumbnail maken`, `Controleren`.

### Selectie

Multi-select activeert een sticky selection toolbar met aantal, toevoegen aan playlist, downloaden indien toegestaan, verplaatsen/taggen en verwijderen.

## 12.12 Uploadflow

### Dropzone

Toont toegestane typen, maximale grootte en dat uploads na upload worden verwerkt. Drag-and-drop is aanvullend; browse via keyboard is volledig ondersteund.

### Uploadqueue

Per bestand:

- naam;
- type;
- voortgang;
- fase;
- cancel/retry;
- fout met herstelactie.

Het sluiten van de queue annuleert niet automatisch achtergronduploads. De globale status blijft bereikbaar.

## 12.13 Media inspector

Rechter sheet/inspector bevat:

- grote preview;
- titel;
- type en metadata;
- verwerkingstatus;
- duur/afmetingen;
- filesize en checksum indien nuttig;
- gebruik in playlists;
- alt/omschrijving waar van toepassing;
- acties: hernoemen, vervangen, downloaden, verwijderen.

Een mediaasset dat in een gepubliceerde release zit kan niet stilzwijgend worden vervangen. Nieuwe inhoud wordt een nieuwe asset/variant en vereist herpublicatie.

## 12.14 Playlist list

### Toolbar

- zoeken;
- statusfilter;
- assignmentfilter;
- sorteren;
- view toggle;
- `Nieuwe playlist`.

### Playlist card/row

- montage van 3-4 thumbnails;
- naam;
- itemaantal;
- totale duur;
- toegewezen schermen;
- laatste publicatie;
- status: Concept, Gepubliceerd, Bijwerken, Fout;
- preview;
- publiceeractie.

Draft en published zijn duidelijk onderscheiden zonder het hele kaartvlak fel te kleuren.

## 12.15 Playlist editor

### Desktop drie-panelen

**Links - mediabibliotheek, 280-320 px**

- search;
- filters;
- images;
- videos;
- widgets;
- draggable items;
- upload shortcut.

**Midden - ordered timeline, flexibel**

- playlistnaam en metadata;
- items met drag handle;
- thumbnail;
- duur;
- media/type indicator;
- sponsorlabel;
- validation state;
- remove/duplicate;
- insertion dropzones.

**Rechts - inspector, 360-440 px**

- geselecteerd item;
- duration;
- fit mode;
- muted audio;
- background;
- focal point;
- preview settings;
- usage/warnings.

**Top actions**

- Opslaan als concept
- Voorbeeld
- Publiceren

### Save status

Toon `Opslaan...`, `Opgeslagen`, `Kan niet opslaan` discreet maar zichtbaar. Autosave en expliciete publicatie zijn verschillende concepten.

### Keyboardreordering

Ieder item heeft contextmenu en toegankelijke acties `Omhoog`, `Omlaag`, `Naar begin`, `Naar einde`. Na reorder wordt positie aangekondigd.

### Validatie

Editor markeert:

- asset niet gereed;
- ontbrekende duur;
- ongeschikt aspect ratio;
- unsupported media;
- te grote release;
- schermassignment zonder compatibele oriëntatie.

## 12.16 Mobile playlist editor

Onder 1024 px wordt de editor niet geplet. Canonieke flow:

1. Playlistitems
2. Media toevoegen
3. Iteminstellingen
4. Preview
5. Publiceren

Een sticky bottom action bar toont primaire actie. Reordering gebeurt via drag met grote handles en via menuacties.

## 12.17 Playerpreview

- ondersteunt 16:9 en 9:16;
- toont veilige zones optioneel;
- play/pause, vorige/volgende en scrub alleen in editor;
- itemduur en sequence zichtbaar;
- `fit` en `fill` worden realistisch gerenderd;
- video is standaard muted;
- preview mag niet doen alsof een online publicatie al actief is.

## 12.18 Publicatieflow

Publiceren is een expliciete, meervoudige statusflow:

1. Concept
2. Review
3. Publiceren
4. Downloaden
5. Verifiëren
6. Wissel gereed
7. Actief

### Publish review dialog/pagina

Toon:

- playlistnaam;
- nieuwe releaseversie;
- wijzigingen sinds vorige release;
- totale assets en bytes;
- target screens;
- waarschuwingen;
- expected behavior: huidige release blijft spelen.

### Actieve publicatiepanel

Voorbeeld:

```text
Playlist: Kantineprogramma
Actieve release: versie 12
Nieuwe release: versie 13
Downloaden: 78%
5 van 6 schermen gereed
1 scherm downloadt nog
```

De boodschap `Vorige release blijft spelen tot de nieuwe release volledig gereed is` staat zichtbaar bij eerste uitleg en in details.

### Failure

Een mislukte download op één scherm maakt duidelijk dat andere schermen mogelijk al gereed zijn en dat de oude release op het probleemscherm blijft spelen. Herstelacties zijn per screen en voor de hele publicatie beschikbaar.

## 12.19 Release history en diff

Elke release toont:

- version number;
- published by;
- timestamp;
- item count;
- total bytes;
- target screens;
- status;
- manifest hash in technische detail;
- diff: added, removed, changed.

Een release is immutable. `Herstellen` maakt een nieuwe release gebaseerd op oude inhoud; het wijzigt de historie niet.

## 12.20 Integrations

Integration card bevat:

- providernaam en toegestaan logo;
- status;
- capabilities;
- last successful sync;
- last error;
- configuratieactie;
- disconnect.

Credentials worden niet in platte tekst getoond. Sync history gebruikt timeline/table met records, duur en foutboodschap.

## 12.21 Team en rechten

Team table:

- naam;
- e-mail;
- rol;
- status;
- laatste activiteit;
- acties.

Rollen krijgen menselijke uitleg:

- Owner - volledige verantwoordelijkheid;
- Admin - beheert mensen, schermen en publicaties;
- Editor - beheert media en playlists;
- Viewer - alleen lezen.

Een rolwijziging toont gevolgen. De laatste owner kan niet zonder overdracht worden verwijderd.

## 12.22 Auditlog

Audit entries tonen:

- actor;
- action;
- target;
- tenant/context;
- absolute timestamp;
- result;
- metadata/detail.

Filters: actor, action, resource, date, result. De log is append-only in productgedrag. Geen edit/delete acties.

## 12.23 Settings

Secties:

- Clubprofiel
- Huisstijl
- Schermstandaarden
- Team en toegang
- Opslag en limieten
- Integraties
- Beveiliging
- Geavanceerd

Lange settingspagina's gebruiken subnavigatie. Save actions blijven zichtbaar. Destructieve instellingen staan in een aparte danger zone met uitleg.

## 12.24 Platform admin

Platformadmin gebruikt dezelfde componenten, maar een duidelijk platformcontextlabel en aparte navigatie. Kernpagina's:

- tenants;
- tenantstatus;
- screen limits;
- active/offline devices;
- storage;
- media processing jobs;
- system incidents;
- audit events;
- support context.

Platformdata wordt niet gemengd in een tenantpagina zonder expliciete context. Support impersonation of tenant view, indien later aanwezig, krijgt permanente banner en auditregistratie.

## 12.25 Dashboard search en command palette

Globale search vindt:

- schermen;
- playlists;
- media;
- teamleden;
- instellingen;
- helpartikelen.

Command palette biedt snelle navigatie en acties, maar geen gevaarlijke actie zonder bevestiging. Keyboard shortcut wordt in topbar getoond.

## 12.26 Notificaties

Notificaties zijn actiegericht:

- scherm offline;
- publicatie mislukt;
- media processing failed;
- uitnodiging verlopen;
- opslag bijna vol;
- integratiesync degraded.

Algemene activiteit hoort in audit/activity, niet in notificaties. Notificatiebadge toont ongelezen actiepunten, niet onbegrensde marketingupdates.

## 12.27 Responsive dashboardgedrag

### Desktop 1280+

Volledige sidebar, tables, editorpanelen, inspector.

### Compact desktop/tablet 1024-1279

Sidebar kan collapsed zijn; inspector als sheet; metrics in 2-3 kolommen; table behoudt prioriteitskolommen.

### Tablet 768-1023

Sidebar als sheet; cards en tabs; editor sequentieel; filters in sheet.

### Mobiel <768

- compacte topbar;
- één primaire actie per header;
- schermen/playlists als cards;
- tabellen transformeren;
- dialogs full-screen waar nodig;
- sticky bottom actions;
- touch targets 44-48 px;
- geen hoverafhankelijke informatie.

## 12.28 Dashboard anti-patterns

- grafiek voor data die als statuslijst duidelijker is;
- Orange als kleur van elke knop;
- Blue voor willekeurige decoratie;
- drie panelen op telefoon;
- miniatuurtabel op mobiel;
- verborgen save/publication state;
- publiceren zonder target summary;
- status alleen als gekleurde dot;
- inline technische stack trace;
- zachte pastelkleurige SaaS-cards;
- buitensporige glassmorphism;
- tenantkleur als volledige appskin;
- destructive action direct in row zonder confirmatie.


\newpage

# 13. Player- en ClubTV-canon

## 13.1 Rol van de Player

De Player is geen tweede dashboard. Hij is een zelfstandig geregistreerd device dat:

- fullscreen content afspeelt;
- media lokaal bewaart;
- zonder internet blijft spelen;
- nieuwe releases op de achtergrond downloadt;
- assets verifieert;
- pas na volledige gereedheid wisselt;
- na crash of stroomuitval herstelt;
- systeemstatus terugrapporteert.

Tijdens normale playback staat de clubcontent centraal. VeyoCast is zichtbaar
bij setup, startup, pairing en diagnostiek; daarnaast staat uitsluitend de
expliciet goedgekeurde locked VeyoCast-lock-up linksonder op 60% opacity als
vaste system mark over de content.

## 13.2 Player state model

Canonical states:

```text
UNPAIRED
READY
PLAYING
UPDATE_AVAILABLE
DOWNLOADING
VERIFYING
SWITCH_PENDING
OFFLINE_PLAYING
ERROR_RECOVERABLE
DISABLED
```

### Visueel gedrag

| State | Publiek scherm | Diagnostiek |
|---|---|---|
| UNPAIRED | pairinginstructie | code, QR, device info |
| READY | startup/voorbereiding | release beschikbaar |
| PLAYING | normale clubcontent | actieve release/item |
| UPDATE_AVAILABLE | normale content | nieuwe release gemeld |
| DOWNLOADING | oude release blijft spelen | progress, bestanden, bytes |
| VERIFYING | oude release blijft spelen | verificatiestatus |
| SWITCH_PENDING | oude release tot loopgrens | wissel gereed |
| OFFLINE_PLAYING | normale cached content | offline, last sync, cached release |
| ERROR_RECOVERABLE | normale content indien mogelijk | fout en herstelactie |
| DISABLED | neutrale beheerboodschap | intrekking/ondersteuning |

Een tijdelijk netwerkprobleem veroorzaakt geen groot foutscherm zolang een geldige lokale release beschikbaar is.

## 13.3 Startup screen

### Doel

Snel vertrouwen geven terwijl de player last-known-good content controleert. Startup duurt zo kort mogelijk.

### Anatomy

- Ink Black of Paper White achtergrond;
- exact logoasset met passend contrast of logoplaat;
- tekst `VeyoCast wordt gestart`;
- minimale progressindicator;
- optioneel subtiele appversie in diagnostische hoek;
- geen clubcontent totdat cachevalidatie veilig is.

### Regels

- logo-animatie alleen na expliciete goedkeuring van de merkeigenaar voor deze
  specifieke startup-toepassing;
- geen logo-morphing, recolouring of uitsnijden; lichte rotatie en een subtiele
  glow volgen de algemene logoregels;
- geen grote loading spinner die minutenlang draait;
- bij herstel: `Lokale playlist wordt hersteld`;
- na circa 10 seconden verschijnt begrijpelijke status in plaats van alleen spinner;
- startup gaat direct naar cached release zodra die veilig beschikbaar is.

## 13.4 Unpaired en pairing screen

### Android PWA-installatie

Wanneer de hosted Player in een Android-browser wordt geopend en nog niet als
standalone PWA draait, toont de Player een compacte installatiekaart. Een
zichtbare actie opent uitsluitend de native `beforeinstallprompt`; installatie
gebeurt nooit zonder expliciete browserbevestiging van de gebruiker. Wanneer de
browser deze API niet aanbiedt, geeft de kaart een eerlijke instructie voor
`App installeren` of `Toevoegen aan startscherm` in het browsermenu. De kaart:

- verschijnt niet in standalone/fullscreen PWA-modus;
- verdwijnt na `appinstalled`, acceptatie of bewuste sluiting;
- wordt niet getoond wanneer de Player offline is;
- gebruikt het exacte goedgekeurde compacte VeyoCast-icoon;
- belooft geen installatie wanneer browser- of devicebeleid dit blokkeert.

De door Android gegenereerde launch-splash gebruikt Ink Black als
`background_color` en `theme_color`, met het goedgekeurde maskable icoon. De
Player-shell en alle bij eerste render benodigde Next-assets worden tijdens de
service-workerinstallatie gecachet voordat die worker actief wordt.

Canonical headline:

**`Koppel dit scherm aan VeyoCast`**

Inhoud:

- exact logoasset;
- zeskaraktercode;
- QR-code;
- instructie `Open VeyoCast en voeg een scherm toe`;
- device status;
- internet status;
- appversie;
- verloopstatus/code expiry;
- optionele korte supportlink.

### Layout 16:9

Links: headline, instructie, code.  
Rechts: QR, device info en status.  
Ruime safe zone, geen dashboardachtige cardwall.

### Layout 9:16

Boven: logo en headline.  
Midden: code.  
Onder: QR, instructie, device info.  
De QR blijft minimaal groot genoeg en wordt niet verkleind om alle technische details tegelijk te tonen.

### Pairingcode

- 6 tekens;
- monospace;
- hoge tracking;
- groepen kunnen `ABC 123` vormen;
- vermijd O/0, I/1, S/5 indien codegenerator dit ondersteunt;
- Orange of White op Ink Black met voldoende contrast;
- expiry duidelijk, maar niet dominant.

## 13.5 Diagnostics

Diagnostiek is beschikbaar op tablet, beheerpagina of via een bewust geopende overlay. Het verschijnt niet automatisch over publieke content.

### Summary

- device name;
- gekoppeld scherm;
- app/build version;
- connection;
- active release;
- desired release;
- sync state;
- storage usage/quota;
- persistent storage;
- last successful sync;
- last error;
- heartbeat time.

### Sync detail

Voorbeeld:

```text
Actieve playlist: Kantineprogramma
Actieve release: versie 12
Nieuwe release: versie 13
Downloaden: 78%
14 van 18 bestanden gereed
Vorige release blijft spelen
Opslag beschikbaar: 36,4 GB
Verbinding: online
```

Progress toont zowel percentage als concrete aantallen. `Vorige release blijft spelen` is een kernboodschap.

## 13.6 Offline state

Canonical text:

**`Offline - lokale playlist wordt afgespeeld`**

Diagnostiek toont:

- last successful sync;
- cached release;
- media verified;
- automatic reconnect;
- local playback active.

Het publieke scherm blijft normale content afspelen. Tijdens normale playback
is geen technisch diagnosepaneel zichtbaar. Uitsluitend zolang de browser
offline meldt of de Player-origin aantoonbaar onbereikbaar is, verschijnt
rechtsonder een compacte chip met `Geen internetverbinding`. De chip verdwijnt
automatisch na herstelde communicatie, voegt geen extra VeyoCast-watermark toe
en vervangt of onderbreekt de last-known-good release nooit. De goedgekeurde
vaste system mark linksonder blijft ongewijzigd zichtbaar.

## 13.7 Disabled/revoked state

Een ingetrokken device kan bij volgende verbinding geen nieuwe content ophalen. Wanneer de serverstatus bekend is, toont de player:

- neutrale Ink Black/Paper White setupboodschap;
- `Dit scherm is niet meer gekoppeld`;
- korte beheerinstructie;
- supportcode.

Geen gevoelige tenant- of accountinformatie.

## 13.8 Fullscreen playback

Playback toont:

- geen browserchrome;
- geen cursor;
- geen mediacontrols;
- geen taskbar;
- geen tabs;
- geen permanente setupoverlay;
- geen schermnaam, mediatitel, playlistnaam of andere playbackmetadata;
- uitsluitend de locked VeyoCast-lock-up linksonder op 60% opacity als
  goedgekeurde vaste system mark; geen andere softwarewatermark.

De Player bewaakt aspect ratio en gebruikt `fit`, `fill` of template-native layout volgens assetinstelling. Fotografie wordt niet vervormd.

## 13.9 Contenttemplate-architectuur

Templates bestaan uit zones, tokens en contentregels. Iedere template heeft afzonderlijke landscape en portrait composities.

### Basisschema 16:9

```text
Canvas                    1920 x 1080 reference
Title-safe                5% rondom
Action/QR-safe            7,5% rondom
Primary content area      70-85% van canvas
Sponsor strip             10-16% hoogte waar van toepassing
Metadata zone             8-14% hoogte
```

### Basisschema 9:16

```text
Canvas                    1080 x 1920 reference
Title-safe                6% rondom
Action/QR-safe            8% rondom
Top title zone            18-28% hoogte
Primary media/content     40-55% hoogte
Detail/action zone        18-28% hoogte
```

Een portrait template is geen gecropte landscape slide.

## 13.10 Templatefamilie: Matchday

Canonical headline:

**`Vandaag op Sportpark Duindorp`**

### Inhoud

- club/team;
- fictieve opponent;
- kick-off time;
- pitch;
- clubkleuren;
- sponsor strip;
- sterke sportfotografie;
- optioneel countdown of match status.

### Landscape anatomy

- eyebrow `MATCHDAY` of `VANDAAG`;
- grote headline linksboven;
- teams/crests in centrale informatiezone;
- time, pitch en kit metadata;
- actiebeeld rechts of full bleed met donkere overlay;
- sponsorstrip onderaan;
- geen VeyoCast-logo in clubcontent.

### Portrait anatomy

- clubcrest en welcome boven;
- grote countdown of tijd;
- teams midden;
- sponsor onder;
- fotografie als gecontroleerde achtergrond of centrale crop.

### Copylimieten

- headline max 2-3 regels;
- teamnamen max 24-30 tekens zichtbaar;
- metadata max 3 kernitems;
- sponsorstrip max 4-6 logos afhankelijk van breedte.

## 13.11 Templatefamilie: Programma

Canonical heading:

**`Programma van vandaag`**

Kolommen/velden:

- team;
- tegenstander;
- aanvang;
- veld;
- kleedkamer.

### Regels

- 5-8 rijen per landscape slide bij 1080p;
- 4-6 rijen per portrait slide;
- overflow wordt gepagineerd;
- type wordt niet verkleind onder minimum;
- zebra rows zijn subtiel of afwezig; lijnen en spacing bepalen ritme;
- team en tijd zijn hoogste prioriteit;
- dressing room kan op smallere variant naar tweede regel.

## 13.12 Templatefamilie: Uitslagen

Canonical heading:

**`Uitslagen`**

Inhoud:

- teams;
- score;
- status of datum;
- optioneel competitie.

Score krijgt tabular figures en sterke visuele nadruk. Winst/verlies wordt niet alleen met kleur aangegeven. Geen overdreven scoreboardgraphics als de data een rustige lijst vraagt.

## 13.13 Templatefamilie: Sponsor

Canonical heading:

**`Partner van de week`**

Anatomy:

- groot sponsorgebied op effen contrasterend vlak;
- korte boodschap, maximaal 1-2 zinnen;
- QR met action label;
- optioneel product- of partnerbeeld;
- clubcontext als klein ondersteunend element.

Sponsorlogo's worden niet gerecolourerd, vervormd of met te weinig vrije ruimte geplaatst. Bekende echte merken worden alleen met toestemming gebruikt.

## 13.14 Templatefamilie: Club announcement

Voorbeeld:

**`Vrijwilligers gezocht`**

Anatomy:

- korte krachtige headline;
- maximaal 25-45 woorden;
- één call to action;
- QR of korte URL;
- echte clubfotografie;
- contact of datum indien noodzakelijk.

De slide is geen poster vol kleine details. Verdere informatie staat achter QR of op website.

## 13.15 Templatefamilie: Kantine

Canonical heading:

**`Vandaag in de kantine`**

Anatomy:

- product of aanbod;
- duidelijke prijs;
- warme, appetijtelijke fotografie;
- korte CTA;
- optioneel tijdvenster;
- optioneel discreet bronlabel.

Prijs is groot en ondubbelzinnig. Allergenen of wettelijke informatie worden waar nodig leesbaar toegevoegd, niet verstopt.

Er wordt niet beweerd dat een kassasysteem actief gekoppeld is zonder productbevestiging.

## 13.16 Templatefamilie: Agenda en welcome

### Clubagenda

- datum prominent;
- gebeurtenis;
- tijd;
- locatie;
- maximaal 4-6 items per slide.

### Welcome

- clubcrest;
- `Welkom bij ...`;
- event of team;
- datum/tijd;
- optionele wayfinding;
- sponsor ondergeschikt.

## 13.17 Template tokens

Clubtemplates erven:

- brandneutralen;
- typografische schaal;
- veilige zones;
- border- en gridlogica;
- transitionregels.

Tenant kan configureren:

- clubkleuren;
- clubcrest;
- sponsorassets;
- fonts binnen een beperkte, goedgekeurde set;
- foto/focal point;
- templatevarianten.

Tenant kan niet configureren:

- onleesbare minimale fontgroottes;
- safe zones buiten grenzen;
- willekeurige animaties;
- permanente VeyoCast-logoaanpassing;
- externe HTML/iframe in kern-MVP.

## 13.18 Sponsor strip

- hoogte 10-16% van landscape canvas;
- achtergrond effen of zeer rustig;
- logos met gelijke optische hoogte, niet gelijke bounding box;
- duidelijke tussenruimte/dividers;
- maximaal aantal op basis van leesbaarheid;
- rotatie over meerdere slides indien nodig;
- geen micro-logo's die alleen van dichtbij leesbaar zijn.

## 13.19 QR block

Canonical anatomy:

- QR;
- rustige rand;
- action label: `Scan en meld je aan`;
- korte URL als fallback;
- optionele deadline.

QR wordt niet in een hoek gepropt. Op een groot scherm wordt de fysieke scanbaarheid getest vanaf realistische afstand en kijkhoek.

## 13.20 Transities en timing

### Standaardduur per item

- eenvoudige afbeelding/announcement: 8-12 s;
- programma/uitslagen: 10-16 s;
- sponsor: 8-12 s;
- QR-actieslide: 12-20 s;
- video: de immutable gepubliceerde itemduur; de natuurlijke duur is de
  authoringstandaard, maar een vroeg native `ended`-event verkort de
  gepubliceerde slotduur niet;
- zeer korte itemduur onder 5 s is niet toegestaan voor tekstslides.

### Leesberekening

Reken grofweg minimaal 2-3 seconden voor oriëntatie plus voldoende leestijd. Als de slide meer copy nodig heeft dan de tijd toelaat, vereenvoudig of splits.

### Loopwisseling

Een nieuwe release wordt bij voorkeur aan het einde van de huidige loop of een veilig itemgrenspunt geactiveerd. Geen abrupte switch midden in video of cruciale slide.

## 13.21 Audio

- video standaard muted;
- audio per scherm expliciet inschakelbaar;
- UI toont zichtbaar of audio actief is;
- geen onverwachte autoplay-audio;
- volumeconfiguratie is device-/screengebonden;
- captions/subtitles worden ondersteund waar content dat vereist.

## 13.22 Player watchdog en fallback

Bij assetfout:

1. probeer veilige lokale variant;
2. sla corrupt item over indien release verder valide is;
3. rapporteer fout;
4. blijf loop spelen;
5. val terug op last-known-good release wanneer release-integriteit onvoldoende is.

Publieke foutfallback bevat geen stack trace. Een contentfallback kan neutrale clubkleur of Paper/Ink gebruiken met korte boodschap, maar wordt alleen getoond als geen geldige content beschikbaar is.

## 13.23 Overscan en hardwarevariatie

Templates worden getest met:

- 1920x1080;
- 3840x2160;
- 1080x1920;
- browsers met verschillende device pixel ratio;
- 3-5% overscan simulatie;
- lagere helderheid en grote kijkhoek;
- warm en fel daglicht;
- tijdelijke netwerkuitval;
- player restart.

## 13.24 Kiosk en cursor

- cursor verdwijnt na korte inactiviteit;
- fullscreen/kiosk herstelt na restart;
- geen contextmenu of selectie tijdens normale playback;
- escape/diagnostics vereist beheerpad;
- keyboard shortcuts zijn niet zichtbaar voor publiek.

## 13.25 Player anti-patterns

- andere permanente VeyoCast-watermarks dan de goedgekeurde locked lock-up
  linksonder op 60% opacity;
- browser URL bar of cursor;
- mini-dashboard tijdens normale playback;
- zwarte foutpagina bij tijdelijk internetverlies;
- portrait als crop van landscape;
- te kleine tabeltekst;
- sponsorlogo's vervormen;
- QR zonder quiet zone of fallback;
- bouncing/spinning transitions;
- actuele release vervangen vóór volledige download/verificatie;
- technische foutcode als hoofdboodschap;
- elk template verplicht in VeyoCast Orange/Blue terwijl clubkleuren logisch zijn.


\newpage

# 14. Cross-platform responsive canon

## 14.1 Responsive is herontwerp, niet schalen

Een layout wordt per viewport opnieuw geprioriteerd. De mobiele ervaring toont niet alles tegelijk, maar behoudt kerninformatie en taken.

## 14.2 Contentprioriteit

Bij ruimtegebrek blijft deze volgorde behouden:

1. paginatitel of huidige status;
2. primaire actie;
3. kerninformatie;
4. waarschuwing/fout;
5. secundaire metadata;
6. aanvullende acties.

Decoratie, extra kolommen en marketingproof verdwijnen eerder dan taakrelevante informatie.

## 14.3 Container queries

Componenten die in zijpanelen, kaarten of editors voorkomen HOORTEN container queries te gebruiken waar browserondersteuning dit toelaat. Een card mag zijn layout baseren op eigen breedte, niet alleen viewport.

## 14.4 Responsive type

Marketing gebruikt `clamp()` binnen vastgestelde minima en maxima. Dashboardtypografie schaalt beperkt; informatiearchitectuur verandert eerder dan dat tekst groot of klein wordt. Player gebruikt viewport- en referentieresoluties met harde minimumgroottes.

Voorbeeld:

```css
.vc-hero-title {
  font-size: clamp(2.5rem, 6vw, 6rem);
  line-height: .92;
  letter-spacing: -.05em;
}
```

## 14.5 Responsive navigation

- Desktop marketing: horizontale nav.
- Mobiel marketing: sheet.
- Desktop dashboard: sidebar.
- Tablet/mobile dashboard: sheet.
- Player: geen navigatie tijdens playback; setup heeft één eenvoudige flow.

## 14.6 Responsive tables

Mogelijke strategieën, in deze volgorde:

1. kolomprioriteit en verbergen van secundaire kolommen;
2. horizontale scroll met sticky eerste kolom;
3. card/list transformatie;
4. detailpagina voor volledige metadata.

Nooit tekst tot onleesbare grootte verkleinen.

## 14.7 Responsive dialogs

- 400-560 px dialog desktop voor bevestiging.
- 720-960 px voor complexe inhoud.
- Onder 640 px wordt een complex dialog full-screen sheet.
- Acties staan onderaan en blijven bereikbaar bij keyboard.

## 14.8 Touch versus pointer

Touchinterfaces:

- minimaal 44 x 44 px hit area;
- geen hover-only informatie;
- grotere drag handles;
- voldoende ruimte tussen destructieve en primaire acties;
- contextmenus worden sheets waar nodig.

Pointerinterfaces mogen compactere zichtbare controls hebben zolang hit area en focus correct blijven.

## 14.9 Landscape mobiel en tablet

Landscape wordt actief getest. Sticky headers en sheets mogen niet vrijwel het hele viewport innemen. Player setup gebruikt orientation-aware compositions.

## 14.10 Ultrawide

Op ultrawide schermen:

- marketingcopy blijft binnen maxbreedte;
- dashboardtables mogen breder, maar kolommen krijgen grenzen;
- editor gebruikt extra ruimte voor preview/inspector, niet voor enorme lege gaps;
- full-width background mag doorlopen.

\newpage

# 15. Toegankelijkheid

## 15.1 Doel

Website en Control richten zich op **WCAG 2.2 AA**. Playercontent volgt dezelfde contrast- en leesprincipes, aangevuld met afstandsleesbaarheid en fysieke schermomstandigheden.

## 15.2 Kleur en contrast

- bodytekst minimaal 4,5:1;
- grote tekst minimaal 3:1;
- UI-componentgrenzen en focus minimaal 3:1 tegen aangrenzende kleur;
- kleur nooit als enige betekenis;
- Orange button gebruikt Ink Black tekst;
- Blue op Paper White is toegestaan voor normale tekst;
- White op Orange is niet toegestaan voor standaardtekst.

## 15.3 Focus

Canonical focus:

- 2 px Signal Blue/focusvariant;
- 2 px offset;
- zichtbaar op alle surfaces;
- niet afgekapt door `overflow:hidden`;
- logische focusvolgorde;
- focus wordt na dialog sluiten teruggezet op trigger.

## 15.4 Keyboard

Alle dashboardtaken zijn keyboardbedienbaar, inclusief:

- navigatie;
- menus;
- dialogs;
- tabs;
- tableselectie;
- playlistreordering;
- upload;
- publish flow;
- pairingbeheer.

Drag-and-drop heeft een expliciet keyboardalternatief.

## 15.5 Semantiek

- één H1 per pagina;
- headings volgen hiërarchie;
- `nav`, `main`, `aside`, `footer` correct;
- table headers hebben scope;
- lists zijn echte lists;
- buttons zijn buttons, links zijn links;
- fieldsets/legends voor groepen;
- statusupdates gebruiken gecontroleerde live regions.

## 15.6 Schermlezers

Statuscopy wordt niet dubbel of extreem vaak aangekondigd. Heartbeats veroorzaken geen live-region spam. Alleen betekenisvolle wijzigingen zoals `Publicatie voltooid` of `Upload mislukt` worden aangekondigd.

## 15.7 Touch targets

Minimaal 44 x 44 px. Kleine checkboxes/icoontjes krijgen een grotere klikzone. Inline links in bodytekst hebben voldoende line-height en spacing.

## 15.8 Zoom en reflow

Website en dashboard blijven bruikbaar bij 200% zoom. Op 320 CSS-px breedte ontstaat geen horizontale scroll behalve voor functioneel toegestane datatabellen/timelines met alternatief.

## 15.9 Reduced motion

Zie motionhoofdstuk. Geen noodzakelijke informatie wordt alleen door beweging overgebracht.

## 15.10 Media

- informatieve afbeeldingen hebben alttekst;
- decoratieve afbeeldingen hebben lege alt;
- video ondersteunt captions waar gesproken informatie essentieel is;
- autoplay audio is uit;
- marketingdevice mock-ups krijgen een alt die het productdoel beschrijft, niet elk pixel detail.

## 15.11 Playerleesbaarheid

- hoge contrasten in echte clubhuisbelichting;
- minimale fontmaten op 1080p;
- korte copy;
- geen essentiële details alleen in kleine sponsorstrip;
- kleurenblindheid: teams/scores/status ook met labels, vormen of posities;
- test vanaf 3, 5 en 8 meter waar relevant.

## 15.12 Form errors

- inline fout;
- error summary bovenaan na submit;
- focus naar summary;
- links naar betreffende velden;
- fouttekst noemt herstel;
- alleen rode border is onvoldoende.

## 15.13 Taal

HTML gebruikt `lang="nl"` of toepasselijke locale. Engelse producttermen worden consistent uitgesproken of waar mogelijk vertaald.

## 15.14 Accessibility QA

Iedere release bevat:

- automatische axe/Lighthouse checks;
- keyboard smoke test;
- screenreader test van kernflows;
- contrastaudit;
- zoom/reflowtest;
- reduced-motiontest;
- fysieke playerleesbaarheidstest voor templates.

\newpage

# 16. Developerimplementatie

## 16.1 Monorepo en packages

Aanbevolen structuur:

```text
apps/
  control/
  player/
  marketing/          # mag later apart of in control-monorepo
packages/
  ui/
  tokens/
  icons/
  content-templates/
  contracts/
  auth/
  database/
  integrations/
```

De gedeelde UI-package bevat primitives en componenten. Productpatterns mogen in app-specifieke packages staan wanneer hun logica niet werkelijk gedeeld is.

## 16.2 Tokenbron

`veyocast-design-tokens.json` is de machine-readable bron. CSS variables en Tailwindpreset worden daaruit gegenereerd of synchroon beheerd. Hardcoded `#FF5C20` in willekeurige componentbestanden is niet toegestaan als `var(--vc-action)` of theme token volstaat.

## 16.3 CSS-architectuur

Aanbevolen lagen:

```css
@layer reset, tokens, base, components, utilities, overrides;
```

- tokens: CSS variables;
- base: body, headings, links, focus;
- components: gedeelde componentstyles;
- utilities: Tailwind;
- overrides: productcontext, zeer beperkt.

## 16.4 Thema

Thema wordt met `data-theme="light|dark"` of class beheerd. Componenten gebruiken semantische tokens (`background`, `surface`, `foreground`) in plaats van thema-afhankelijke directe kleuren.

## 16.5 Component-API's

Componentprops beschrijven betekenis, niet uiterlijk op pixeldetail.

**Goed:**

```tsx
<Button variant="primary" size="md" loading={isPublishing}>
  Publiceren
</Button>
```

**Niet goed:**

```tsx
<Button orange rounded="7px" shadow="0 7px 22px ...">
```

## 16.6 Variantbeheer

Gebruik gecontroleerde varianten, bijvoorbeeld met `class-variance-authority`. Combinaties worden getest in Storybook. Geen willekeurige `className`-overrides om canonical componenten lokaal te veranderen zonder design review.

## 16.7 Server- en clientgrenzen

Visuele componenten blijven zoveel mogelijk presentational. Data, permissions en servermutaties worden gescheiden. De UI verbergt niet alleen verboden acties; autorisatie wordt server-side afgedwongen.

## 16.8 Statusmodel

Statussen worden gedeeld als typed enums/contracts. UI mapt één status naar label, semantiek, icoon en kleur. Geen pagina-eigen stringvergelijkingen.

Voorbeeld:

```ts
type PlayerSyncState =
  | "ready"
  | "downloading"
  | "verifying"
  | "switch_pending"
  | "active"
  | "failed";
```

## 16.9 Internationalisatie

Ook wanneer launch Nederlands is:

- strings staan niet verspreid hardcoded;
- datums en getallen gebruiken localeformatters;
- layout verdraagt langere Engelse/Duitse labels;
- logoasset blijft ongewijzigd;
- tone of voice per taal wordt apart beheerd.

## 16.10 Content Security en embeds

Marketing en Control gebruiken strikte CSP. Playercontent ondersteunt in kern-MVP geen willekeurige externe HTML of iframes. Templates renderen gecontroleerde data en media.

## 16.11 Performancebudgets website

Richtwaarden:

- hero-afbeelding geoptimaliseerd en responsive;
- kritieke fonts beperkt en gesubset via standaardwebfontproces;
- geen zware video autoplay boven de vouw zonder noodzaak;
- layout shift minimaal;
- productvisual lazy loaded onder de vouw;
- route JS per pagina beheerst;
- respecteer data saver waar mogelijk.

## 16.12 Performance dashboard

- virtualisatie alleen bij werkelijk grote lijsten;
- optimistic UI alleen waar herstel duidelijk is;
- skeletons zonder layout shift;
- filters debounced;
- niet elke heartbeat realtime in UI animeren;
- polling/statusupdates gebundeld;
- media thumbnails responsive en gecached.

## 16.13 Performance player

- app shell en manifest lokaal;
- next item preloaded;
- video range requests correct afgehandeld;
- geen memory leak over 24-uurs soak;
- oude release blijft beschikbaar als fallback;
- asset hashes als stabiele cache keys;
- storage quota vooraf gecontroleerd;
- transitions GPU-vriendelijk en eenvoudig.

## 16.14 Storybookstructuur

```text
Foundations/
  Color
  Typography
  Spacing
  Motion
Components/
  Actions
  Forms
  Navigation
  Feedback
  Data display
Patterns/
  Marketing
  Dashboard
  Player setup
Templates/
  Website pages
  Dashboard pages
  Player content
```

Iedere story toont light/dark, responsive, states en accessibility notes.

## 16.15 Figma library

Pagina's:

- 00 Cover & changelog
- 01 Foundations
- 02 Logo assets
- 03 Components
- 04 Marketing patterns
- 05 Dashboard patterns
- 06 Player templates
- 07 Responsive examples
- 08 Deprecated

Variables volgen tokennamen. Component properties zijn beperkt en semantisch.

## 16.16 Assetpipeline

- logoassets in immutable `/brand` map;
- club/sponsor assets tenant-scoped;
- thumbnails en player variants gegenereerd;
- bestanden krijgen duidelijke metadata;
- SVG alleen uit vertrouwde, gesaniteerde bron;
- screenshots worden niet als logo-master gebruikt.

## 16.17 Tests

### Componenttests

- variant render;
- keyboard;
- focus;
- disabled/loading;
- accessible name;
- responsive snapshot waar nuttig.

### Productflows

- media upload/process;
- playlist reorder;
- publish review;
- screen pairing;
- offline status;
- permission states.

### Player

- boot offline;
- network loss during video;
- corrupt pending asset;
- restart;
- release switch at loop boundary;
- portrait/landscape;
- 24-hour soak.

## 16.18 Logging en privacy

UI-telemetry bevat geen mediainhoud of geheime tokens. Fouten krijgen supportcodes. Screenshots in supportflow worden expliciet gevraagd en veilig behandeld.

\newpage

# 17. Design governance

## 17.1 Eigenaarschap

| Rol | Verantwoordelijkheid |
|---|---|
| Brand owner | logo, merkstrategie, externe toepassing |
| Design system lead | tokens, componenten, canon, accessibility |
| Product design | flows, patterns, research, productkwaliteit |
| Frontend lead | implementatie, API's, performance, Storybook |
| Player lead | playback, templates, hardware/reliability |
| Content/marketing | copy, website, campagnes, claims |
| QA/accessibility | releasechecks en regressie |

## 17.2 Wijzigingsproces

1. Probleem of behoefte documenteren.
2. Controleren of bestaand component/pattern volstaat.
3. Voorstel met use cases, states, toegankelijkheid en productimpact.
4. Design review.
5. Engineering review.
6. Implementatie + stories/tests.
7. Canon en tokens bijwerken.
8. Changelog en migratiepad publiceren.

## 17.3 Versiebeheer

Semantic versioning:

- patch: verduidelijking of niet-brekende tokenfix;
- minor: nieuw component/pattern of backwards-compatible variant;
- major: fundamentele merk-, token- of componentwijziging.

Logo-assetwijzigingen zijn altijd expliciet en hebben migratie-inventaris.

## 17.4 Deprecated components

Deprecated items blijven tijdelijk gedocumenteerd met:

- reden;
- vervangend component;
- deadline;
- migratievoorbeeld;
- owner.

Nieuwe code mag deprecated components niet gebruiken.

## 17.5 Uitzonderingen

Een uitzondering vermeldt:

- scope;
- reden;
- risico;
- einddatum;
- owner;
- opvolgactie.

`Marketing wilde iets anders` is geen voldoende reden om logo, contrast of accessibility te doorbreken.

## 17.6 Tenant customization governance

Tenantbranding mag:

- clubkleuren in contenttemplates;
- clubcrest;
- sponsorassets;
- beperkte templatekeuzes;
- eigen fotografie.

Tenantbranding mag niet:

- Control onleesbaar maken;
- VeyoCast-logo veranderen;
- semantische statuskleuren vervangen;
- minimale fontgroottes verlagen;
- veilige zones uitschakelen;
- willekeurige scripts/HTML toevoegen.

## 17.7 Canon review cadence

- elk kwartaal lichte review;
- bij grote release volledige review;
- na pilotfeedback playerleesbaarheid opnieuw testen;
- jaarlijks logoasset- en juridische inventaris;
- toegankelijkheidsaudit minimaal jaarlijks en bij grote UI-wijziging.


\newpage

# 18. Release- en kwaliteitschecklists

## 18.1 Brand QA

- [ ] Exact goedgekeurd logoasset gebruikt.
- [ ] Geen retyping, tracing, recolour of effect.
- [ ] Logo volledig zichtbaar en niet vervormd.
- [ ] Goedgekeurd compact icoon gebruikt waar een compact asset nodig is.
- [ ] Voldoende contrast of Paper White-logoplaat.
- [ ] Orange, Blue en neutralen komen uit tokens.
- [ ] Geen generieke gradient of nieuwe monogramvariant.
- [ ] Fotografie past bij echte sportvereniging.
- [ ] Claims zijn feitelijk en goedgekeurd.
- [ ] Geen fictieve klanten/testimonials als feit gepresenteerd.

## 18.2 Website QA

- [ ] Eén H1.
- [ ] Skip link en landmarks.
- [ ] Header werkt met keyboard en mobiel sheet.
- [ ] Primary CTA gebruikt Ink tekst op Orange.
- [ ] Productvisual toont geloofwaardige UI.
- [ ] Geen onleesbare desktopminiatuur op mobiel.
- [ ] Secties volgen contentmaxima en correcte gutters.
- [ ] Images hebben alt en focal points.
- [ ] Forms hebben labels, errorsummary en privacycopy.
- [ ] Reduced motion werkt.
- [ ] 200% zoom en 320 px reflow getest.
- [ ] SEO metadata, canonical en OG aanwezig.
- [ ] Geen fake logo cloud of random analytics.

## 18.3 Dashboard QA

- [ ] Huidige tenant/platformcontext altijd zichtbaar.
- [ ] Primaire actie per pagina duidelijk.
- [ ] Loading, empty, ready en error states ontworpen.
- [ ] Rechten server-side én begrijpelijk in UI.
- [ ] Status niet alleen met kleur.
- [ ] Tabellen keyboardbedienbaar en mobiel getransformeerd.
- [ ] Publiceren toont targets, changes, bytes en gevolgen.
- [ ] Oude releasegedrag helder uitgelegd.
- [ ] Playlist reorder heeft keyboardalternatief.
- [ ] Uploadqueue toont progress, processing en retry.
- [ ] Destructieve acties vragen juiste bevestiging.
- [ ] Focusmanagement bij dialogs/sheets correct.
- [ ] Geen gevoelige tokens in diagnostiek.
- [ ] Dark en light theme gecontroleerd.

## 18.4 Player QA

- [ ] Startup gebruikt exact logoasset.
- [ ] Normale playback heeft geen browserchrome/cursor.
- [ ] Alleen de locked VeyoCast-lock-up linksonder op exact 60% opacity; geen
  schermnaam, mediatitel, playlistnaam of andere permanente overlay.
- [ ] Player start met cached release zonder netwerk.
- [ ] Pending release wordt volledig gedownload en geverifieerd.
- [ ] Switch gebeurt op veilige item/loopgrens.
- [ ] Corrupt asset activeert geen onvolledige release.
- [ ] Offline toont normale content; diagnostiek is secundair.
- [ ] 16:9 en 9:16 zijn apart ontworpen.
- [ ] Safe zones en overscan gecontroleerd.
- [ ] Tekst leesbaar vanaf realistische afstand.
- [ ] QR fysiek getest.
- [ ] Audio standaard muted.
- [ ] Reduced motion gebruikt cut/fade.
- [ ] Restart en stroomonderbreking getest.
- [ ] 24-uurs soak zonder memory buildup of zwart frame.

## 18.5 Accessibility QA

- [ ] Contrast AA.
- [ ] Focus zichtbaar en niet afgekapt.
- [ ] Volledige keyboardflow.
- [ ] Screenreaderlabels en live regions gecontroleerd.
- [ ] Touch targets minimaal 44 px.
- [ ] Error summary en veldkoppeling.
- [ ] Color-independent statuses.
- [ ] Reduced motion.
- [ ] Captions/altteksten waar relevant.
- [ ] Player content op afstand getest.

## 18.6 Content QA

- [ ] Nederlandse zinskapitalisatie.
- [ ] Eén term per concept.
- [ ] Knoppen beginnen met werkwoord.
- [ ] Fout: oorzaak, gevolg, herstel.
- [ ] Geen ongefundeerde beschikbaarheidsclaim.
- [ ] Geen overmatige uitroeptekens.
- [ ] Datums, tijden en eenheden consistent.
- [ ] Geen interne term `tenant` waar `vereniging` begrijpelijker is.

\newpage

# 19. Canonieke pagina- en stateblauwdrukken

## 19.1 Website home

```text
MarketingHeader
Hero
  HeroCopy
  HeroActions
  BenefitRow
  ProductStage
ProofStrip
UseCaseGrid
HowItWorks
ReliabilityPanel
SportsClubEditorialSection
SponsorShowcase
FeatureMatrix
PricingPreview
FinalCTA
MarketingFooter
```

## 19.2 Productpagina

```text
MarketingHeader
CompactProductHero
FullWidthProductStage
CapabilityChapter x 3-5
ReleaseReliabilityExplainer
PermissionsAndTeamSection
PlayerAndOfflineSection
ResponsiveProof
FAQ
FinalCTA
MarketingFooter
```

## 19.3 Tenant overview

```text
AppShell
  Sidebar
  Topbar
  Main
    PageHeader
    MetricGrid
    AttentionBanner optional
    ScreenFleetSummary
    PublishPanel
    RecentPlaylists
    RecentMediaOrProcessing
```

## 19.4 Media page

```text
AppShell
  PageHeader + MediaUploadButton
  MediaToolbar
  MediaGridOrList
  SelectionToolbar conditional
  UploadQueue global
  MediaInspector conditional
```

## 19.5 Playlist editor

```text
AppShell compact/editor mode
  EditorTopbar
    Breadcrumb
    SaveState
    Preview
    Publish
  AssetLibrary
  PlaylistTimeline
  ItemInspector
  PlayerPreview optional modal/panel
  PublishReview dialog/page
```

## 19.6 Screens page

```text
AppShell
  PageHeader + PairScreenButton
  ScreenFilterToolbar
  ScreenFleetTable desktop / ScreenCards mobile
  PairingFlow dialog/sheet
```

## 19.7 Screen detail

```text
AppShell
  PageHeader with ScreenStatus
  Tabs
    Overview
    Diagnostics
    Releases
    Events
    Settings
  Context actions
```

## 19.8 Player startup

```text
PlayerStage
  Background
  LockedLogoAsset
  StartupMessage
  MinimalProgress
  HiddenDiagnosticsAccess
```

## 19.9 Player unpaired

```text
PlayerStage
  LockedLogoAsset
  PairingHeadline
  PairingCode
  QRBlock
  Instruction
  DeviceStatus
  InternetStatus
  AppVersion
```

## 19.10 Player playback

```text
PlayerStage
  ActiveReleaseRenderer
    ActiveItem
    PreloadedNextItem
    TransitionLayer
  Watchdog invisible
  Telemetry invisible
  Diagnostics overlay closed
```

## 19.11 Player offline

```text
PlayerStage continues ActiveReleaseRenderer
Diagnostics state:
  OfflineStatus
  CachedRelease
  LastSuccessfulSync
  MediaVerified
  ReconnectStatus
```

\newpage

# 20. Volledige componentinventaris - samenvatting

De companion `veyocast-component-inventory.csv` bevat 128 componenten en patterns met varianten, maten, states, anatomy, responsive gedrag en accessibilityregels. De onderstaande domeinindeling is verplicht.

## 20.1 Shared primitives

- Box
- Stack
- Grid
- Container
- Divider
- AspectRatio
- VisuallyHidden

## 20.2 Actions

- Button
- IconButton
- SplitButton
- ButtonGroup
- Link
- FAB

## 20.3 Forms

- Field
- Textarea
- SearchField
- Select
- Combobox
- Checkbox
- RadioGroup
- Switch
- Slider
- DatePicker
- TimePicker
- FileUploader
- FormSection
- FormActions

## 20.4 Navigation

- TopNavigation
- Sidebar
- MobileNavigation
- Breadcrumbs
- Tabs
- SegmentedControl
- Pagination
- Stepper
- CommandPalette

## 20.5 Feedback

- Badge
- StatusDot
- Alert
- Banner
- Toast
- Tooltip
- Popover
- DropdownMenu
- Dialog
- Sheet
- ProgressBar
- Spinner
- Skeleton
- EmptyState
- ErrorState

## 20.6 Data display

- Card
- MetricCard
- MediaCard
- PlaylistCard
- ScreenCard
- PricingCard
- FeatureBlock
- Table
- DataGrid
- ListRow
- DescriptionList
- Avatar
- Thumbnail
- Timeline
- KeyValue

## 20.7 Website patterns

- MarketingHeader
- Hero
- ProductStage
- EditorialSection
- UseCaseGrid
- HowItWorks
- ReliabilityPanel
- SponsorShowcase
- FeatureMatrix
- ProofStrip
- PricingPreview
- FinalCTA
- MarketingFooter
- ArticleHeader
- ArticleBody
- DemoForm

## 20.8 Dashboard patterns

- AppShell
- PageHeader
- TenantSwitcher
- DashboardOverview
- ScreenFleetTable
- ScreenDetail
- PairingFlow
- MediaLibrary
- MediaInspector
- UploadQueue
- PlaylistList
- PlaylistEditor
- PlaylistTimeline
- PlayerPreview
- PublishPanel
- ReleaseDiff
- ReleaseStatus
- IntegrationCard
- TeamTable
- RolePicker
- AuditLog
- SettingsLayout
- StorageMeter
- OfflineIndicator
- PermissionGuard

## 20.9 Player patterns

- PlayerStage
- StartupScreen
- UnpairedScreen
- PairingCode
- PlayerDiagnostics
- OfflineState
- SyncState
- MatchdayTemplate
- FixturesTemplate
- ResultsTemplate
- SponsorTemplate
- AnnouncementTemplate
- CanteenTemplate
- AgendaTemplate
- WelcomeTemplate
- ScoreboardStrip
- SponsorStrip
- QRBlock
- PlayerTransition
- SafeZoneOverlay
- ContentFallback

\newpage

# 21. Tokenreferentie

## 21.1 Spacing

| Token | px | Typisch gebruik |
|---|---:|---|
| 0 | 0 | reset |
| 0.5 | 2 | optische microgap |
| 1 | 4 | icon detail |
| 1.5 | 6 | kleine interne gap |
| 2 | 8 | label-icon gap |
| 2.5 | 10 | compacte control |
| 3 | 12 | compacte padding |
| 4 | 16 | standaard interne padding |
| 5 | 20 | button/card padding |
| 6 | 24 | standaard gutter |
| 7 | 28 | ruime control group |
| 8 | 32 | page gutter / section group |
| 10 | 40 | grote component spacing |
| 12 | 48 | section spacing klein |
| 16 | 64 | section spacing |
| 20 | 80 | marketing section |
| 24 | 96 | marketing section groot |
| 32 | 128 | hero/major section |
| 40 | 160 | ruime desktopsectie |
| 48 | 192 | uitzonderlijke hero spacing |

## 21.2 Z-index

| Token | Waarde | Gebruik |
|---|---:|---|
| base | 0 | normale content |
| sticky | 100 | header, toolbar |
| dropdown | 300 | dropdown/popover |
| overlay | 500 | overlay/sheet backdrop |
| modal | 700 | dialog/sheet |
| toast | 900 | notificaties |
| critical | 1000 | uitzonderlijke systeembanner |

Z-indexes worden niet willekeurig met `999999` opgelost.

## 21.3 Componenthoogtes

| Component | Compact | Standaard | Touch/large |
|---|---:|---:|---:|
| Button | 32-36 | 40 | 44-48 |
| Input | 36 | 40 | 44 |
| Table row | 36-40 | 44-52 | 56-64 |
| Topbar | - | 64 | - |
| Marketingheader | 64 mobile | 72 desktop | - |
| Sidebar item | 36 | 40 | 44 |
| Tab | 36 | 40 | 44 |
| List row | 44 | 52-64 | 72-80 |

## 21.4 Focus

```text
Ring width   2 px
Ring offset  2 px
Color light #315CFF
Color dark  #6681FF
```

## 21.5 Motion

```text
instant   80 ms
fast     140 ms
standard 220 ms
slow     320 ms
scene    480 ms
```

\newpage

# 22. Verboden patronen

## 22.1 Merk

- logo reconstrueren;
- icoon aanpassen;
- logo-animatie zonder expliciete goedkeuring voor de concrete toepassing;
- logo over druk beeld zonder plaat;
- generiek nieuw appicon;
- Orange/Blue als gradientlogo;
- clubkleur op VeyoCast-logo.

## 22.2 Website

- cartoon/mascotte;
- fake customer logos;
- fake testimonial;
- meaningless dashboard metrics;
- glassmorphism overload;
- alle content in rounded cards;
- white text on Orange button;
- auto-rotating essential carousel;
- desktoppagina in smartphoneframe zonder mobiele reflow.

## 22.3 Dashboard

- status only by color;
- raw database/error text;
- lokale componentforks;
- destructive icon zonder label/confirm;
- publiceren gelijkstellen aan opslaan;
- verborgen release state;
- geplette drie-panel editor;
- onnodige graphs;
- tenantkleur als interfaceachtergrond;
- kleine 12 px primaire bodytekst.

## 22.4 Player

- browserchrome;
- permanente softwarewatermark buiten de goedgekeurde locked VeyoCast-lock-up
  linksonder op 60% opacity;
- zwart scherm bij offline;
- incomplete release activeren;
- portrait crop van landscape;
- te kleine tekst;
- QR zonder alternatief;
- strobing/gaming transitions;
- technische details publiek tonen;
- autoplay audio standaard aan.

\newpage

# 23. Companion files

Dit canon wordt geleverd met:

- `veyocast-design-tokens.json` - machine-readable tokens;
- `veyocast-design-tokens.css` - light/dark CSS variables;
- `veyocast-tailwind-preset.ts` - Tailwind mapping;
- `veyocast-component-inventory.csv` - volledige componentcatalogus;
- `veyocast-page-template-inventory.csv` - route- en stateinventaris;
- officiële locked VeyoCast SVG-masters en goedgekeurde technische afgeleiden in de centrale brandmap.

## 23.1 Gebruik

1. Importeer tokens in UI-package.
2. Bouw primitives en controls.
3. Documenteer in Storybook.
4. Bouw marketing- en dashboardpatterns.
5. Bouw player templates apart per aspect ratio.
6. Test light/dark, responsive en accessibility.
7. Gebruik QA-checklists als releasegate.

## 23.2 Definition of done voor het designsysteem

Het canon is pas volledig geïmplementeerd wanneer:

- alle kerncomponenten in Storybook staan;
- tokens de enige bron voor kleuren/spacing/radii zijn;
- website en dashboard dezelfde primitives gebruiken;
- player setup dezelfde brandtokens gebruikt;
- playercontent eigen veilige templatecomponenten heeft;
- responsive states aanwezig zijn;
- accessibilitytests groen zijn;
- componentinventaris een owner/status heeft;
- deprecated items zijn verwijderd of gemarkeerd;
- logoassets centraal en immutable zijn.

# Einde

**VeyoCast Bold** is krachtig zonder lawaai, premium zonder opsmuk en technisch zonder afstandelijk te worden. Marketing maakt de belofte zichtbaar, Control maakt de werking begrijpelijk en de Player maakt zichzelf tijdens playback onzichtbaar. Dat drieluik is de kern van het canon.
