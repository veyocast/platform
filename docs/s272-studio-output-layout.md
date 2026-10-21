# S272 — Studio-uitvoer binnen het paneel

Het opgeslagen ontwerp gebruikte voor de uitvoersectie dezelfde horizontale iconenrij als een bronmelding. Titel, uitleg en twee knoppen veroorzaakten 214px horizontale overflow in het 319px desktoppaneel. Alleen de directe `section.vc-source-binding` binnen het properties-paneel krijgt een verticale indeling. Bestaande iconenrijen, tekst, handlers, disabledgrenzen, canvas en renderer blijven behouden.

Dezelfde twee native Chromiumregressies waren eerst rood: 138px overflow bij390 en214px bij1440; de overige drie tabs pasten al. Na de correctie passen alle vier tabs exact (390/390 en319/319). Beide uitvoeracties zijn44px hoog, passen binnen de sectie en komen na native scroll daadwerkelijk in de viewport. Er zijn geen commands uitgevoerd en de historische ontwerpdata bleven gelijk. De definitieve volledige retained-surface-suite sloot10/10 groen in26,700s,0skips/retries; eigen browsergroep gesloten en Rootbron/geïnstalleerde SDK gelijk. Scoped lint is afzonderlijk vastgelegd. Normale exacte-head CI blijft vereist voor integratie.

Lokaal bewijs: `/dev/shm/veyocast-s272-native-baseline-37e34b82-a57a-48a0-8c50-5efa7856d70d` (2 echte layoutfailures), `/dev/shm/veyocast-s272-full-native-candidate-60428a5e-acfd-49ae-8077-1f93b91d0da5` (10PASS). De eerste voorlopige10PASS-run en een door de idle-preflight geweigerde tweede runner blijven bewaard; de definitieve suite is met de ongewijzigde volledige spec opnieuw uitgevoerd. Eerste twee kandidaatbeelden zijn werkelijk bekeken; finale native viewportasserts bewijzen de scrollbereikbaarheid.

Dit is echte component/CSS met gecontroleerd transport. Geen nieuw Next-/Auth-/RLS-/provider-/hardware- of letterlijke Sourcepixelacceptatie. Er wordt geen volledige visuele reviewronde geclaimd.
