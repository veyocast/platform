# S79 — veilige mediaverwijdering

## Uitkomst

Een bevoegde beheerder kan een video of afbeelding nu rechtstreeks vanuit
Media verwijderen, ook wanneer het bestand nog in conceptplaylists voorkomt.
De bevestiging benoemt vooraf welke conceptplaatsingen verdwijnen en dat
gepubliceerde releases en actieve schermen hun immutable kopie behouden.

## Oorzaak

De bestaande interface schakelde `Media archiveren` uit wanneer
`draftCount > 0`. De databasefunctie blokkeerde dezelfde bewerking zolang een
`playlist_items`-verwijzing bestond. Omdat een geüploade video doorgaans direct
in een conceptplaylist werd gezet, bestond er vanuit Media geen bruikbare
verwijderroute.

## Implementatie

- `Uit Media verwijderen` opent een expliciete impactbevestiging.
- De client stuurt het waargenomen aantal conceptplaylists mee.
- De database vergrendelt asset en betrokken playlists in vaste volgorde.
- Bij veranderde conceptimpact wordt de opdracht met SQLSTATE `40001`
  geweigerd, zodat de beheerder eerst de actuele situatie ziet.
- Na bevestiging worden uitsluitend mutable `playlist_items` verwijderd.
- Betrokken playlists krijgen een nieuwe revisie en blijven concept.
- De media wordt als soft-delete gearchiveerd.
- `playlist_release_items`, bestanden en historie blijven onaangeraakt.
- De standaard Publisher-commandgrens maakt dezelfde opdracht idempotent.
- Zowel de media-archivering als iedere bijgewerkte playlist wordt geaudit.

## Security en tenantgrenzen

De bestaande actieve-tenant- en `media:upload`-capabilitychecks blijven
server-side verplicht. De functie selecteert en muteert uitsluitend records met
dezelfde `tenant_id`; de browser ontvangt geen service-role toegang.

## Bewijs

- Control lint, typecheck en 125 unit-tests zijn groen.
- De Control-productiebouw en workspace lint, typecheck en unit-tests zijn
  groen.
- Een volledige lokale database-reset past de migratie schoon toe.
- De volledige RLS-suite is groen: 44 bestanden en 828 assertions.
- De toegankelijkheidsrun levert 31 directe successen; de enige parallelle
  devservertimeout (de brede viewportmatrix) slaagt geïsoleerd in 2,2 minuten.
- De brede Chromiumrun levert 125 successen en 8 verwachte
  omgevingsafhankelijke skips. Dezelfde viewportmatrix en één mobiele
  navigatiefluke slagen beide geïsoleerd.
- De RLS-regressie bewijst:
  - verwijderen zonder bevestiging blijft geblokkeerd;
  - bevestigde verwijdering archiveert de video;
  - mutable conceptplaatsingen verdwijnen;
  - de conceptrevisie wordt verhoogd;
  - immutable release-items blijven bestaan;
  - audit-events worden eenmaal geschreven;
  - een idempotente replay geeft hetzelfde resultaat.
