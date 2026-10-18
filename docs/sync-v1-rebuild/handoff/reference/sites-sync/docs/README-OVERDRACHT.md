# VeyoCast V1 · Sync — overdracht

Datum: 17 oktober 2026. Richting: **prototype 1 / Sync**. Dit pakket is het concrete voorbeeld voor de rebuild van VeyoCast: vormgeving, navigatie, toestanden, bewerkingen, playerervaring en publieke marketingwebsite.

- Werkplek: https://veyocast-v1-design-lab.dgwebserv.chatgpt.site/?design=sync
- Publieke website: https://veyocast.dgwebserv.chatgpt.site
- Overdracht in de werkplek: `?design=sync&page=handover`
- V1-verkenner: `?design=sync&page=coverage`

De vier andere ontwerprichtingen zijn vervallen. Bouw één herkenbare Sync-werkplek. FieldFlow en OnzeTrots TV zijn **contentthema’s voor schermuitvoer**; deze twee families blijven wel bestaan.

## Leesvolgorde en bronhiërarchie

1. `V1-SYNC-CANON.md`: bindende functionele en visuele afspraken en de API-/domeinmapping.
2. `CODEX-BOUWPROMPT.md`: concrete opdracht om de bestaande VeyoCast-repository te verbouwen.
3. `ACCEPTATIE.md`: scenario’s, bewijsniveaus en releasevoorwaarden.
4. `SEO-IMPLEMENTATIE.md`: publieke routes, indexering, content, aanvraagflow en productieovergang.
5. `TESTRESULTATEN.md`: het feitelijke, gedateerde bewijs van controles op deze oplevering. Alleen daarin vermelde uitgevoerde controles mogen als uitgevoerd worden beschouwd.

De broncode en meegeleverde assets bepalen de visuele referentie. De canon en acceptatiecriteria bepalen het bedoelde productiegedrag. Verschillen tussen een lokale demonstratie en een robuuste serverimplementatie moeten zichtbaar worden opgelost; neem geen mockbeperkingen ongemerkt over. Een aangevinkt scenario in de V1-verkenner is een handmatige review, geen technische testuitslag.

## Pakket en starten

De ZIP heeft `README-START.md` in de root. `source/` bevat de complete gedeelde bronbasis, waaronder `src/`, `public/`, `scripts/`, `docs/`, de app-entry en een aparte marketing-entry. De overige bronpaden in deze documenten zijn relatief aan `source/`.

```sh
npm ci
npm run dev
npm run build
npm run build:marketing
MARKETING_SITE_URL=https://veyocast.dgwebserv.chatgpt.site MARKETING_APP_URL='https://veyocast-v1-design-lab.dgwebserv.chatgpt.site/?design=sync' node scripts/prerender-marketing.mjs --dir=dist-marketing --template=marketing.html
```

Voer de opdrachten uit in `source/`. Gebruik de lockfile en de bestaande scripts. `npm run build` bouwt de werkplek. De marketing-entry heeft een afzonderlijke buildconfiguratie, zodat de publieke website niet de werkplek met mockorganisatiegegevens hoeft te laden. Volg voor het voorbereiden van statische publieke routes de scripts en beschrijving in `SEO-IMPLEMENTATIE.md` en het uiteindelijke `TESTRESULTATEN.md`.

De versiegegevens staan in `package.json`: deze prototypebron gebruikt React, TypeScript, Vite en Motion. Dat is een **referentieomgeving**, geen opdracht om de bestaande Next.js-monorepo te vervangen. Gebruik de werkende architectuur van VeyoCast, port de componenten en CSS en koppel de bestaande services aan het gewenste gedrag.

## Waar vind je wat?

| Bron | Verantwoordelijkheid |
|---|---|
| `src/App.tsx` | Vaste Sync-shell, primaire navigatie, beheer, account, sessiesimulatie en modals |
| `src/store.tsx` | Gedeelde demo-objecten, lokale mutaties, tenantwisseling en immutable publicatiesnapshots |
| `src/ui.tsx`, `src/icons.ts` | Gemeenschappelijke bediening, branding, feedback en QR-weergave |
| `src/styles.css` | Typografie, tokens, globale componenten, responsiviteit en reduced motion |
| `src/modules/Overview.tsx` | Operationeel overzicht en V1-verkenner |
| `src/modules/Content.tsx` | Bibliotheek, uploads, Studio, contentfamilies, paging en gedeelde slidepreview |
| `src/modules/Playlists.tsx` | Playlisteditor, plaatsinginstellingen, preview, preflight en publicatie |
| `src/modules/Players.tsx` | Schermen, planning, composities, playerreis en hersteltoestanden |
| `src/modules/Admin.tsx` | Bronnen, producten, thema’s, sponsors, Engage, team, support, platform, billing, aanvragen en mobiel beheer |
| `src/modules/Handover.tsx` | Rondleiding, ontwerpregels, bouwafspraken en handmatige reviewexport |
| `src/modules/*.css` | Layout en componentstyling per functionele module |
| `src/Marketing.tsx`, `src/marketing-main.tsx` | Publieke routes, teksten, voorbeelden, FAQ en demoaanvraag |
| `src/coverage.json` | 148 concreet beschreven V1-scenario’s; geen automatische testuitslag |
| `public/assets/` | Logo’s, 3D-hero, fonts, themabeelden en licenties |
| `scripts/` | Bouw-/controlehulpmiddelen; uitgevoerde opdrachten staan in het testverslag |

## Dezelfde hero op website en player

`public/assets/brand-hero.png` is het vaste merkbeeld. De responsieve WebP-afleidingen zijn `brand-hero-480.webp`, `brand-hero-800.webp` en `brand-hero-1254.webp`. Gebruik ditzelfde beeld voor de publieke hero en de playerstart. Behoud beeldmerk, verhoudingen en ruimte rondom het logo; snijd het woordmerk niet af. Motion zit in de presentatie eromheen: rustige lichtbeweging, fade en statusovergangen. De betekenis van een toestand moet ook zonder beweging leesbaar blijven.

`full-dark.svg`, `full-light.svg` en `brand-icon.svg` zijn transparante vectorassets. Gebruik de SVG’s, geen nagemaakt tekstlogo. `logo-pack.zip` is het losse merkpakket. Lokale fonts en hun meegeleverde licenties blijven onderdeel van de bronoverdracht.

## Wat dit prototype uitvoert

Mutaties worden lokaal in de browser bewaard. De werkplek demonstreert samenhangende content-, playlist-, planning-, publicatie- en schermacties. De demo heeft organisaties, rollen en verschillende fout-/leeg-/laadtoestanden. Publicatie toont gewenste en bevestigde versies. De player laat de start, koppeling, voorbereiding, veilige overgang, afspelen en herstel zien.

Dit is geen gekoppelde backend. Er worden geen echte e-mails, providerverzoeken, betalingen of apparaatopdrachten verstuurd. Lokale opslag is geen serverautorisatie en geen multi-userdatabase. De marketingdemo en werkplek op verschillende domeinen delen hun browseropslag niet. Een lokale QR-ervaring kan niet op een willekeurige andere telefoon dezelfde bewaarde demostaat ophalen.

Demo-code voor login/MFA: `123456`. De pairingdemonstratie gebruikt onder meer `VYO482`; volg de code en verloopstatus die het scherm zelf toont. Deze vaste codes mogen nooit onderdeel van de productie-authenticatie worden.

## Wat de rebuild moet toevoegen

Serverrechten per tenant en capability, duurzame database en objectopslag, media-/renderworkers, echte bronadapters, apparaatprotocol en acknowledgements, planningsresolutie, logging en providerbewijs. Daarnaast de werkelijke aanvraag-/e-mailketen, gecontroleerde billingvrijgave en native management-/playerbuilds waar die onderdeel zijn van de bestaande productarchitectuur.

De productie-implementatie moet de bestaande device-identiteiten, Android signing en package-identiteit, LG-adapter, pairing, cache en herstelcontracten bewaren. Een modern browserprototype bewijst geen LG- of Android-compatibiliteit. Een providernaam op een kaart bewijst geen beschikbare API-dataset.

## Oplevering en uitrol

Voer de rebuild eerst uit op staging. Migreer bestaande gegevens en relaties gecontroleerd; verwijder of reset geen productieorganisatie, publicatie, cache of pairing om de nieuwe interface passend te maken. De overstap naar productie volgt pas na de acceptatiecriteria en een expliciete productieopdracht. Bewaar een terugrolpad met de vorige werkende applicatie- en playerreleases.
