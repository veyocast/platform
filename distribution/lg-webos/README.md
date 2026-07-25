# LG webOS Signage-distributiemap

Deze map beschrijft de neutrale HTTPS-layout voor een goedgekeurde
VeyoCast-release. Gegenereerde binaries staan in `dist/` en worden niet in Git
vastgelegd.

Publiceer steeds als één gecontroleerde set:

```text
nl.veyocast.player.webos_1.0.1_all.ipk
nl.veyocast.player.webos.smoketest_1.0.1_all.ipk
checksums.sha256
latest.json
release-notes.json
```

`latest.json` is een VeyoCast-distributiemanifest, geen verzonnen LG SI Server
manifest. De exacte SI Server-protocolvelden, signing- en certificaateisen
worden pas toegevoegd nadat het doelmodel en de officiële LG-partnerdocumentatie
zijn gecontroleerd.

De GitHub-workflow kan deze bestanden na approval met HTTPS PUT uploaden. De
ontvangende objectstorage of distributieservice moet:

- geldige publieke TLS gebruiken;
- writes alleen met de Environment-secret toestaan;
- reads volgens het gekozen distributiebeleid aanbieden;
- bestaande versies behouden voor rollback;
- correcte MIME-types leveren (`application/vnd.webos.ipk` of
  `application/octet-stream` voor IPK, `application/json` voor JSON en
  `text/plain` voor de checksum);
- geen listing of devicecredential vereisen.
