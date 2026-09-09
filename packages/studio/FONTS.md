# Studio-fontregistry

Studio gebruikt uitsluitend lokaal meegebouwde fonts. Royal Current v8 gebruikt
Roboto met afzonderlijke echte faces; historische documenten blijven hun
eerdere variabele families en registryversies behouden.

| Registryfamilie | Browserpakket | Posterrenderpakket | Gewichten | Fontlicentie |
|---|---|---|---|---|
| `Roboto` | `@fontsource/roboto@5.3.0` | `@expo-google-fonts/roboto@0.4.2` | 400, 500, 700, 900 | Apache License 2.0 |
| `Inter Variable` | `@fontsource-variable/inter@5.3.0` | `@expo-google-fonts/inter@0.4.2` | 100–900 | SIL Open Font License 1.1 |
| `Inter Tight Variable` | `@fontsource-variable/inter-tight@5.3.0` | `@expo-google-fonts/inter-tight@0.4.2` | 100–900 | SIL Open Font License 1.1 |
| `Manrope Variable` | `@fontsource-variable/manrope@5.3.0` | `@expo-google-fonts/manrope@0.4.2` | 200–800 | SIL Open Font License 1.1 |

De packages bevatten hun eigen `LICENSE` en metadata. Control importeert de
lokale WOFF2-CSS; de worker laadt de overeenkomende lokale TTF-faces rechtstreeks
in Resvg. Roboto 400/500/700/900 wordt in beide paden als hetzelfde familylabel
`Roboto` geregistreerd. Er worden geen externe font-URL’s gebruikt.
Historische documenten met gewicht 800 blijven geldig; wanneer zo’n document
Roboto gebruikt, kiest browser- en Resvg-fontmatching deterministisch de
dichtstbijzijnde meegeleverde 900-face.

De registryversie staat in ieder Studio-document. Een fontbestand of
fontpackage mag alleen samen met een expliciete registryversie- en
rendererversiewijziging worden bijgewerkt, zodat historische revisies
reproduceerbaar blijven.

Bronnen:

- <https://fontsource.org/fonts/inter/install>
- <https://fontsource.org/fonts/inter-tight/install>
- <https://fontsource.org/fonts/roboto/install>
- <https://github.com/rsms/inter/blob/master/LICENSE.txt>
- <https://github.com/sharanda/manrope/blob/master/OFL.txt>
- <https://github.com/googlefonts/roboto-2-classic/blob/main/LICENSE>
