# Studio-fontregistry

Studio gebruikt uitsluitend de lokaal meegebouwde variabele fonts:

| Registryfamilie | npm-package | Bereik | Licentie |
|---|---|---|---|
| `Inter Variable` | `@fontsource-variable/inter@5.3.0` | 100–900 | SIL Open Font License 1.1 |
| `Inter Tight Variable` | `@fontsource-variable/inter-tight@5.3.0` | 100–900 | SIL Open Font License 1.1 |

De packages bevatten hun eigen `LICENSE` en metadata. Control importeert de
lokale `wght.css`; de worker laadt de Latin WOFF2-buffer rechtstreeks in
Resvg. Er worden geen externe font-URL’s gebruikt.

De registryversie staat in ieder Studio-document. Een fontbestand of
fontpackage mag alleen samen met een expliciete registryversie- en
rendererversiewijziging worden bijgewerkt, zodat historische revisies
reproduceerbaar blijven.

Bronnen:

- <https://fontsource.org/fonts/inter/install>
- <https://fontsource.org/fonts/inter-tight/install>
- <https://github.com/rsms/inter/blob/master/LICENSE.txt>
