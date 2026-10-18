# Exact Sites-logo → Android en Expo

Deze kit exporteert het actuele Sync V1-logo uit Sites naar platformformaten. `source/brand-icon.svg` en `source/full-light.svg` zijn byte-identieke kopieën van de Sites-bronnen. De paden, kleuren en woordmerkgeometrie zijn onveranderd. Padding, effen achtergrond `#0D1725`, schaal en platformmasker zijn exportinstellingen, geen nieuw merkontwerp.

## Integratie Player

Kopieer de kitinhoud onder `android/res/` naar `apps/android-tv/app/src/main/res/`, na het inspecteren van eventuele gelijke resourcenamen. De TV-module deelt dit pad. De bestaande manifestverwijzingen blijven werken:

| Resource in bestaande manifest | Levering |
|---|---|
| `@drawable/veyocast_launcher_icon` | 512px PNG onder `drawable-nodpi`; adaptive variant met dezelfde naam onder `drawable-anydpi-v26` |
| `@drawable/veyocast_tv_banner` | 320×180 PNG, exact licht Sites-woordmerk op donker canvas |
| Optioneel `android:roundIcon` | `@drawable/veyocast_launcher_icon_round`, legacy en adaptive variant |

De adaptive XML verwijst naar `@drawable/veyocast_icon_foreground` (Android VectorDrawable met ongewijzigde SVG-pathdata) en `@color/veyocast_icon_background`. De vectors behouden de even-odd uitsparing van het voorste scherm. De extra `mipmap-*` en `mipmap-anydpi-v26` exports zijn beschikbaar voor een bestaande mipmapconventie; voeg geen tweede onnodige iconhiërarchie toe als de drawablemapping wordt gebruikt.

Legacy-iconen: mdpi48, hdpi72, xhdpi96, xxhdpi144, xxxhdpi192. Adaptive voorgrondrasters: 108, 162, 216, 324, 432. De foreground staat op 56% van de canvasbreedte met de bestaande verhouding 280:190. De merkgeometrie valt daarmee binnen de centrale veilige cirkel van het 108dp-adaptive canvas. Android kiest het uiteindelijke masker; geen rastermasker op de adaptive foreground aanbrengen.

## Integratie Native Control

Kopieer `expo/icon-1024.png` en `expo/adaptive-foreground-1024.png` naar een stabiel assetpad in `assets/brand/`. In `apps/control-mobile/app.config.ts`:

```ts
icon: "../../assets/brand/veyocast-sync-launcher-1024.png",
android: {
  // Bestaande package, versionCode, permissions, app links en overige config behouden.
  adaptiveIcon: {
    foregroundImage: "../../assets/brand/veyocast-sync-adaptive-1024.png",
    backgroundColor: "#0D1725"
  }
}
```

De voorbeelddoelnamen corresponderen met de twee bestanden hierboven; kopieer ze onder die namen of pas alleen de paden aan. Gebruik `icon-1024.png` voor het niet-adaptive launchericon. De adaptive-foreground bevat transparante padding en is alleen voor het masker bedoeld. Behoud het bestaande Expo-signingplugin en neem gegenereerde Android-projectwijzigingen op via de huidige prebuild/CI-route. Dit is geen complete vervangende app.config.

## Hero-opstartscherm

Gebruik het originele `public/assets/brand-hero.png` uit de meegeleverde Sites-bron en de bestaande WebP-varianten. Deze kit verandert de hero niet. Neem de originele bytes over, bundle/precache voor offline boot, behoud compositie en zet op `contain`/`fitCenter`. Het volledige in-app hero-opstartscherm volgt exact de Sites-playerreferentie. Het systeemicon tijdens Android-launch is een afzonderlijke platformlaag; voer geen crop van de hero uit om die in een klein iconmasker te persen.

## Reproduceerbaar exporteren

`generate-icons.cjs` gebruikt Node.js en `sharp`. Installeer een bij de geregistreerde versie passende sharp dependency in een tijdelijke toolomgeving of gebruik de bestaande runtime. Vervolgens:

```bash
node generate-icons.cjs
```

`asset-manifest.json` bevat de exacte gebruikte Node/sharp/librsvg-versies, bestanden en SHA-256-hashes. De generator voert geen netwerkverkeer uit en leest uitsluitend de twee bijgeleverde SVG-bronnen. Afgeleide bronbestanden worden bij herhaling deterministisch overschreven; het manifest omvat de gegenereerde assets en bronbestanden, niet deze README. Rasterbytes kunnen verschillen bij een andere rendererversie; brongeometrie en visuele uitvoer moeten gelijk blijven.

De exports zijn visueel gecontroleerd en bestandsgrootten/dimensies zijn gevalideerd. Een Android-build, Play-upload, installatieupgrade of inspectie van een echt launchermasker is nog niet uitgevoerd. Dat bewijs hoort bij de uitvoering van het Android-updatecontract.
