# OnzeTrots TV thema

Aanvullend schermthema `onzetrots-tv` uit het door de gebruiker aangeleverde OnzeTrots-TV-Narrowcasting-Overdracht.zip. Het thema wijzigt geen bestaande ontwerpkeuzes automatisch.

## Composities

Acht bewerkbare Studio-startpunten: wedstrijddag, programma, uitslagen, competitiestand, kantine, clubnieuws, partners en welkom. De bijgeleverde fonts, logo’s, Clubmuur-beelden en aparte composities voor 1920×1080 en 1080×1920 zijn overgenomen. Voor bestaande clubberichten, opstellingen, LED-momenten en videofallbacks zijn aanvullende weergaven aanwezig.

## Integratie

- `screen-themes.ts`: optionele thema-ID en gedeeld inhoudsmodel.
- `onzetrots-tv.tsx` en CSS: één renderer voor Studio, dynamische Studio’s, playlists en publicatievoorbeelden; stijlen staan binnen `.onzetrots-tv`.
- `onzetrots-tv-adapter.ts`: bestaande opgeslagen LED Scores-, Sportlink- en menurijen naar themavelden, zonder ze door de voorbeeldgegevens te vervangen.
- `onzetrots-tv-templates.ts` en editor: bewerkbare startgegevens uit de overdracht. Dit zijn voorbeelden, geen live clubgegevens.
- Thema en inhoud worden met bestaande Studio- en playlistsnapshots opgeslagen. Toepassen kan op één slide, een selectie of het volledige ontwerp/de playlist.
- Automatische gegevenspagina’s houden rekening met de afspeelduur per pagina. Publicaties blijven snapshots.
- Bestaande ontwerpen zonder thema-ID blijven hun oorspronkelijke renderer gebruiken. De eerdere blauwe/witte LED-stijlen en landmark-achtergronden blijven beschikbaar.

## Grenzen

De bestaande Sites-omgeving blijft een prototype met opslag in de browser. Deze wijziging activeert geen echte Sportlink-, LED Scores-, player- of YouTube-koppeling. Het YouTube-thema geldt voor de fallbackkaart; er wordt geen nieuwe video-afspeelfunctie geclaimd.

## Bron

Originele ontwerpinstructies, technische overdracht, bronversie en fontmetadata staan in `docs/onzetrots-tv-source`. Afbeeldingen en fonts staan onder `public/onzetrots-tv`. Ze zijn uit het aangeleverde pakket gekopieerd; de bestaande browserafbeeldingsopslag blijft via `media-assets.tsx` toegankelijk.

## Controle

TypeScript, productiebuild en server-rendercontroles voor beide oriëntaties; daarnaast gerichte controles op inhoudsmapping en behoud van brongegevens. Visuele browser- en fysieke apparaatcontrole zijn niet uitgevoerd in deze werkomgeving.
