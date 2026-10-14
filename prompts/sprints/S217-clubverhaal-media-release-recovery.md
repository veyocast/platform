# S217 — Clubverhaal-media, uploadbevestiging en release-assets herstellen

Onderzoek en herstel de gemelde lege media-/slidebibliotheek in de nieuwe
Clubverhaal-editor, niet bevestigde uploads en RELEASE_ASSETS_UNAVAILABLE op
Player. Bewijs de echte productieoorzaken voordat je gegevens herstelt.

Ownership: Control playlist/Clubverhaal-data, bibliotheek, upload-, opslag- en
publicatieacties/helpers; Player manifest/assetresolutie; bijbehorende media-
workerpaden indien noodzakelijk; gerichte contracts en regressietests; één
forwardmigratie en RLS-tests indien de databaseoorzaak dat vereist; gedeelde
content-template servermarkup en menu-projectie (productiebuild reproduceert
een clientcomponent in de serverrenderer); bewijsdocs,
PLANS en TASK_LEDGER. Geen dependency/lockfile/workflow of locked asset-wijziging.

Tenantpermissions/RLS, controle van werkelijk opgeslagen bytes, immutable
releases en volledig geverifieerde offline-LKG blijven harde grenzen. Bestaande
uploads/slides blijven behouden. Geen providerfetch in slides, geen automatische
nieuwe versies bij iedere bronupdate. Uploadbevestiging vereist echte server-
acknowledgement. Niet renderbaar/ontbrekend is een zichtbare fout, geen lege
bibliotheek of gefingeerd succes.

Test een echte image/video-upload, bestaande media + dynamische/Studio-slides
in de bibliotheek, save/reopen/publish en de device-geautoriseerde release-
assets, naast foundation-, DB/RLS indien nodig, a11y/browser/Player/offlinegates.
Bestaande toestemming omvat commit, push, PR, merge en staging/production-uitrol.
