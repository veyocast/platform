# Studio-templatekiezer en v17-opslagherstel

## Oorzaak

De Control-code en de gedeelde contracten kenden het Sites v17-paar
`sites-v17` / `6800bc858436ba0843eaea89b682cd5b43c3521d`. De blijvende
databasevalidatie stond echter nog uitsluitend het oudere v11-paar toe. De
serveractie stuurde daardoor een geldig OnzeTrots-template naar
`create_studio_series_v1`, waarna `private.assert_sites_studio_v1` PostgreSQL
code `23514` teruggaf. Control vertaalde die code naar de algemene melding dat
de ontwerpgegevens ongeldig waren.

Dezelfde achterstand zat in de validatie van dynamische/plaatsingsconfiguratie,
de batchbewerking van playlists, het immutable releaseconstraint, de
authoring-pauzedetectie en de allowlist voor de zes v17-brushassets. Alleen de
eerste grens was direct zichtbaar in Studio; de overige grenzen hadden een
v17-ontwerp later opnieuw kunnen weigeren.

## Oplossing

Eén private helper accepteert nu uitsluitend twee exacte renderer/source-paren:

- `sites-v11` met `b1cae899af19fc39908217253094c5240d7359fc`;
- `sites-v17` met `6800bc858436ba0843eaea89b682cd5b43c3521d`.

Alle betrokken databasegrenzen gebruiken diezelfde koppeling. De helper is niet
uitvoerbaar voor Data API-rollen. V17 valideert daarnaast één van de zestien
bekende unified families en wordt als één canvas getimed; de historische
v11-paginering blijft intact. Publicaties blijven immutable en providerrefreshes
maken nog steeds geen ontwerp-, playlist- of releaseversie.

De Studio-shell bevat voortaan de enige paginakop. In de contentruimte zijn de
dubbele kop en onderregel verwijderd. Het aanmaakvenster toont een compacte
radio-keuzelijst met categorie en één geselecteerde live-preview. Daardoor
worden niet alle canvassen tegelijk gerenderd en blijft de dialoog leesbaar. Op
mobiel staat de geselecteerde preview boven de begrensd scrollende lijst; op
desktop staan lijst en preview naast elkaar. Liggende previews gebruiken de
beschikbare breedte en staande previews een begrensde contain-breedte.

## Veiligheid en rollback

De migratie is forward-only en verruimt alleen de exacte, brongebonden v17-
identiteit en de reeds gecontroleerde assetchecksums. Onbekende families en
gemengde renderer/source-paren blijven foutcode `23514` geven. Terugrollen van
de applicatie is veilig voor bestaande v11-data; een database-rollback zou een
nieuwe migratie vereisen en zou reeds opgeslagen v17-ontwerpen opnieuw
onbruikbaar maken.

## Verificatie

- verse lokale database-reset met alle migraties;
- gerichte pgTAP: 12 controles voor identiteit, configuratie, assets, ACL,
  releaseconstraint en een echte geauthenticeerde Studio-RPC;
- volledige RLS-suite: 105 bestanden en 3.004 controles groen;
- Studio-interactiematrix: 25/25 groen op 390×844 en 1440×900, inclusief één
  preview, v17-selectie, toetsenbordbediening en ontbreken van `Jouw Studio`;
- workspace lint, typecheck en unit-tests: elk 30/30 packages groen;
- productiebuild: 18/18 taken groen;
- toegankelijkheid: 36 uitvoerbare checks groen en 1 expliciete live-skip;
- Chromium: alle 853 Control-/E2E-cases doorlopen; runner- en cachefluctuaties
  zijn geïsoleerd opnieuw groen. De Player-/offlinegroep is 230 groen met 15
  expliciete productie-/referentieskips; 9 visual-evidencechecks blijven
  expliciet opt-in;
- de modale schermonboardingstest controleert nu één aanwezige pagina-`h1` en
  het toegankelijke dialoogkopje afzonderlijk, omdat een open modal de
  achtergrond terecht uit de accessibility tree haalt.
