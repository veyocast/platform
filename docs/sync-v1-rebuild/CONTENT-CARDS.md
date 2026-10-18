# Contentkaarten en Studio-filmstrip — S230

De gevulde Sourcevergelijking vond concrete verschillen achter de eerder
getoetste lege toestand: statuskleuren, beeldverhouding, themaregel en ontbrekende
bestaande resourceacties. Content toont nu de echte mediaverhouding (onbekend
blijft onbekend), Source-statuskleuren en de actuele opgeslagen Studio-themafamilie.
Rawmedia volgt de playlist en krijgt geen verzonnen eigen schermthema.

Archiveren opent de bestaande Media-confirmatie vanuit de Sourcekaart. Eén
begrensde on-demand read controleert eerst asset, actuele capability, tenant en
volledige gebruikstelling; ontbrekende of afgeknotte aantallen blokkeren de actie.
De bestaande archive-/restore-RPC, receipts en tenantregels blijven leidend.
Alleen de vaste terugroute `/dashboard/content` is toegevoegd; de Media-default
blijft behouden. Er wordt niets geschreven vóór bevestiging.

Studio archiveren, herstellen en dupliceren gebruiken de bestaande CAS- en
idempotentiecommands. De browser bewaart uitsluitend de onbevestigde opdracht,
gebonden aan actor, tenant en project; de server controleert alle rechten opnieuw.
Bij een verloren bevestiging hervat dezelfde nonce/revisie/operatie. Ook na een
reeds uitgevoerde archive of restore blijft de oorspronkelijke opdracht beschikbaar.
Een nieuwe herstelopdracht krijgt een nieuwe nonce. Een gewijzigde actorscope
remount de bediening en vertraagde responses wijzigen geen andere scope.

De Source-editorfilmstrip krijgt alleen de ontbrekende wrapperselector: portrait
preview blijft 62×35 binnen de 16:9-miniatuur, in plaats van de volledige strip
uit te rekken. De 22px Source-selectieglyph houdt zijn plaats; de echte knop heeft
44px aanraakruimte volgens de hogere toegankelijkheidscanon. De gedeelde Source-CSS
is niet gewijzigd.

## Werkelijk uitgevoerd

De lokale echte AAL2/UI/PostgREST/Storageproef maakte één eigen PNG en één eigen
Sourceontwerp. Upload201 → usagepreview → archive303 → Archief → restore303
behield exact hetzelfde asset en de private bytes. Een opzettelijk verloren
antwoord na duplicatecommit leverde bij herladen en identiek herhalen exact één
kopie. Archivecommit met verloren antwoord hervatte in Archief dezelfde opdracht;
daarna werkte restore met nieuwe nonce. Alle drie eigen testitems zijn herstelbaar
gearchiveerd. De oude acht tabelbaselines bleven bytegelijk; nul browserfouten.

De eerste lokale poging werd door een Next-dev-geheugenrestart onderbroken; een
tweede harnespoging controleerde de intercept te vroeg. Beide pogingen blijven
bewaard. Alleen de afgeronde poging bewijst de genoemde keten. Een aparte negatieve
actorswitch-browserfixture is niet uitgevoerd; die grens is in code gereviewd.
Bewijs: `execution/evidence/s230-content-runtime.json` met hashes van de afzonderlijk
bewaarde echte rapporten. De bestaande CI- en releasegates volgen vóór uitrol.

## Expliciete resterende Sourcegrens

Rawmedia Bewerken opent nog de bestaande Media-inspector. De generieke Source-
MediaFrame-editor met globale crop/fit/focus/trim/audio en een afzonderlijke
contentkopie heeft nog geen gelijkwaardige persistente contentautoriteit.
Playlistplaatsingen hebben al hun eigen echte presentatiecontract; dat bewijst
deze globale editor niet. Een rawmedia-UUID als Studio-ID doorgeven of een
30seconden-Studio-render als willekeurig lang videobestand behandelen is geen
correcte implementatie. Deze grens is open en geen door de gebruiker uitgestelde
dienst. Dit document claimt daarom geen volledige V1- of pixelacceptatie.
