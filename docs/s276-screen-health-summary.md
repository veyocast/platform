# S276 — Synchronisatiestatus op mobiel

De echte AAL2-pagina `?tab=health` brak lange publicatienamen, opslag en
PLAYING af in vier mobiele kolommen van77–78px. Alleen de lokale
schermdetail-CSS zet deze strook op mobiel in twee kolommen van156px. De
waarden gebruiken16px in plaats van21,6px; desktop behoudt vier kolommen.
De strook en opeenvolgende retained secties krijgen20px tussenruimte. Hun
koppen gebruiken de bestaande semantische teksttoken, zodat ze ook op de
bestaande donkere oppervlakken leesbaar zijn. Gegevens, labels, statussen,
formulieren, URL’s, permissions, Source en Player veranderen niet.

## Native bewijs

De bevroren echte Control8e03-build met AAL2 is vergeleken met de exact
getransformeerde lokale CSS. Dit is een CSS-tegenproef en geen nieuwe
appbuild. Finale proof:
`/dev/shm/veyocast-s244-separate-aux-runs/c2beb7ab-03bb-4b23-beff-608a06dc72d1`.
Alle8gevallen (twee schermen ×390/1440 ×licht/donker) slagen. Mobiele
strookhoogte356/380→218,75px; desktop142/166→116,375px. Geen horizontale
documentoverflow, alle waarden volledig aanwezig. De gemeten sectiekoppen
hebben16,643:1 op het lichte en14,278:1 op het donkere bestaande oppervlak.
Dat is een gerichte contrastmeting, geen algemene AA-claim.

Volledige tekst/links en de oorspronkelijke afmetingen/stijlen na verwijderen
van de tijdelijke CSS zijn exact gecontroleerd. Er zijn16 native PNG’s;
de finale lichte mobiele, donkere mobiele en donkere desktopkandidaat zijn
daadwerkelijk bekeken. Alle162 QA-tenanttabellen, historie, Storage, Auth,
Source en SDK blijven gelijk. Geen non-GET of command uitgevoerd, geen
browser-/request-/transportfouten en eigen browsers werkelijk gesloten:
wrapper `s276-summary-owned-focus-d5c54edc-3bcd-41a4-99fa-2a5b3195ecce`
sloot0 zonder resterende eigen processen.

De eerste tegenproef `acd2d446-575e-49c5-8881-23f852251ac3` bleef terecht
rood: de oude mobiele strook was flex; alleen gridkolommen instellen had
geen effect. `display:grid` is daarna expliciet gescopeerd toegevoegd, zonder
assertie-/timeout-/tolerantieverruiming. De tussenkandidaat
`62ad6b0f-9c98-4a43-a38a-69ab31207dad` sloot8gevallen groen vóór de
aanvullende sectiekop-/afstandscorrectie. Geen bewijs wordt overschreven.

`git diff --check` is groen. De normale volledige exacte CI en uiteindelijke
gezamenlijke build/uitrol volgen via S244; geen nieuwe provider-, hardware-,
vijf-ronden- of deploymentacceptatie uit deze tegenproef.
