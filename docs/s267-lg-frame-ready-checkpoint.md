# S267 — LG-kandidaat vóór framecontrole

De echte CI op geïntegreerde 8e03 stopte in de nulhoogtetest na de normale
5sassertiegrens. De bewaarde trace toont tot de laatste DOMsnapshot nul
`.lg-sites-canvas`-elementen en een nog lopende download van een goedgekeurde
OnzeTrots-achtergrond. De framecontrole was daardoor nog niet gestart.

De test wacht nu eerst op precies één echte kandidaatcanvas (maximaal 60s voor
de voorafgaande assetverificatie). De bestaande diagnostiek-, zichtbaarheid-,
first-frameack- en geverifieerde fallbackasserties blijven exact behouden,
evenals de oorspronkelijke 15100ms-klokstap. Playercode en assets wijzigen niet.

Lokale validatie: de oorspronkelijke LG-test faalt native op dezelfde
5sdiagnostiekassertie bij één verklaarde 6000ms-assetvertraging. De kandidaat
slaagt met dezelfde vertraging én met normale assetlevering, zonder retries/skips.
De originele ES5-GET-route en goedgekeurde assets zijn gebruikt via een
verklaarde beperkte HTTP-testserver; dit is geen nieuwe Next-build- of
fysieke LG-acceptatie. Twee echte ControlShell-SSR-cases en één volledige
gecontroleerde component/keyboardcase slagen; de laatste controleert de native
contextknop, Enter, paneel, linkfocus en de bestaande navigatiecallback.
Volledige App Router-routeacceptatie blijft de gewone CI-controle.

Lint en strikte typecheck van beide gewijzigde specs: exit0. De eerdere volledige
lint/typecheck/unittests op 8e03 blijven afzonderlijk groen. Beide tijdelijke
SDK-aliases zijn exact bewaakt verwijderd en de oorspronkelijke Root-SDK is gelijk.
Originele CI-rood en volledige trace blijven bewaard.
De geïntegreerde visuele vergelijking en staging/productie blijven onder S244 open.

De tweede geobserveerde CI-race betreft de contextselectietest: die roept focus()
aan zodra de dashboardheading zichtbaar is, terwijl de SSR-knop nog disabled is.
Eén readinessassertie wacht op bedienbaarheid vóór dezelfde native focus- en
toetsenbordcontroles. Productcode, layout, tokens en alle Sourcebestanden blijven gelijk.

Bewijs: `/dev/shm/veyocast-s267-native-preparation-378b5630-8a0f-401c-9dcf-4a7c01479f15`. Gewone feature-/integratie-CI blijft vereist.
