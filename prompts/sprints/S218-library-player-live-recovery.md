# S218 — Werkelijke bibliotheek- en Playerinhoud herstellen

De gebruiker bevestigt dat S217 het probleem niet heeft opgelost, ook niet voor
de zojuist opgeslagen prijslijst. Volg echte opgeslagen inhoud tot bibliotheek,
publicatie, gedownloade bytes en Playeractivatie. Healthchecks zijn geen bewijs
van zichtbare inhoud.

Ownership: Control Clubverhaal-/playlistbibliotheek, editor, media-/slidekeuze en
bijbehorende APIs/helpers; Studio/Menu Studio-aanmaak, navigatie en opslagflow
(expliciete aanvullende gebruikersopdracht: één playlistflow, menu's uitsluitend
via Menu Studio, HTML/CSS met motion als primaire slideweergave);
Player manifest/assetresolutie/cache/renderer;
media-worker dynamische en Studio-renderketen; gedeelde content-templateprojectie
en servermarkup; gerichte regressies/browserproeven; bewijsdocs, PLANS en ledger.
Een noodzakelijke schemafix krijgt een eigen forwardmigratie met RLS-regressie.
Geen dependency/lockfile/workflow of locked asset-wijziging.

Behoud tenantpermissions/RLS, immutable publicaties, checksumverificatie en
offline last-known-good. Geen gefingeerde ready-status, lege fallback als succes,
autopublicatie of nieuwe authoringversies bij bronrefresh. Bestaande toestemming
omvat commit, push, PR, merge en staging/production. Scope-uitbreiding eerst
expliciet rapporteren. Bewijs werkelijk bibliotheekresultaat en afspeelbare
inhoud; rapporteer fysieke devicebevestiging afzonderlijk.
