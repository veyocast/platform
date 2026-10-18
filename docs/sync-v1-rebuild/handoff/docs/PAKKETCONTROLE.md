# Controle van dit overdrachtspakket

Datum: 17 oktober 2026. Scope: het nieuwe complete Codex-handoverpakket, de herkomst van meegeleverde bronnen en de consistentie van de instructies.

| Controle | Feitelijk resultaat |
|---|---|
| Actuele Sites-versies | Sync versie 2 en marketing versie 1 opnieuw via Sites opgehaald; broncommits gelijk aan de schone lokale checkouts. |
| Exacte source-export | Alle 60 Sync-bestanden en 31 marketingpublicatiebestanden byte voor byte vergeleken met Git-objecten op de vastgepinde commits: gelijk. |
| Originele analyse | Originele 17-pagina V1-PDF meegeleverd; tekstextract gebruikt bij het samenvoegen van de canon. |
| GitHub-baseline | Main-head vastgelegd; volledige 178-branchinventaris en niet-afgeknotte tree met 4.180 entries opgehaald. Geen branchinhoud als geheel overtollig verklaard. |
| Deploymentbron | 50 geselecteerde bestanden inclusief alle 25 workflows gecontroleerd tegen Git-blobhashes. |
| Androidbron | 26 geselecteerde bestanden gecontroleerd tegen Git-blobhashes; Player general/TV delen package, Control heeft eigen package. |
| Iconexports | Sites-SVG-bronnen byte-identiek; pathgeometrie en kleuren behouden. Expo 1024×1024, TV-banner 320×180 en adaptive safezone gecontroleerd; export visueel bekeken. |
| Volledige scope | Alle 148 scenario-ID's exact en uniek aanwezig in matrix en CSV; 36 aanvullende domeincontracten met bewijsniveau. |
| Nieuwe afspraken | Onafhankelijke inhoudelijke review op cleanup, development/staging, workflows/secrets/vars, Androididentiteiten, brongezag en uitvoeringsclaims. Gevonden formuleringen gecorrigeerd. |
| Demo versus productie | Prototypecriteria expliciet gelabeld; CSV koppelt ieder ID aan echte domeincontracten. Gerichte copy-uitzondering voor onjuist geworden demo-/omgevingclaims vastgelegd. |
| Bestandsintegriteit | Offline verifier controleert pakket-, Sites-, asset- en legacyhashes, verwachte bestanden, scenario-ID's en workflow-/branchaantallen. Controle geslaagd. |
| Meegeleverde oudere ZIPs | CRC en veilige relatieve entrypaden gecontroleerd; geen beschadigde ZIP gevonden. Historische handover-ZIP expliciet ondergeschikt aan nieuwe rootprompt. |
| Gevoelige materialen | Geen secretwaarden opgevraagd. Selectie bevat bronconfiguratie en secretnamen, geen keystores of private keys. Aanvullende patrooncontrole vond geen private-key-/GitHub-token-/OpenAI-keymateriaal. |

De nieuwe Androidexports zijn resourcebestanden, geen geteste Androidrelease. Geen Gradlebuild, Play-upload, apparaatinstallatie, signingwijziging of fysieke upgrade is in deze overdrachtsronde uitgevoerd.

De exacte Sites-bron is niet aangepast; de bestaande prototypechecks zijn daarom als afzonderlijk historisch verslag meegeleverd. In deze overdrachtsronde zijn geen nieuwe frontend-/backendimplementatie, providerintegratie, visuele browseracceptatie, fysieke LG/Androidduurproef, serveropruiming of GitHubmutatie uitgevoerd. De registers voor die uitvoering staan bewust open.

Na uitpakken kan de ontvanger `python3 scripts/verify-package.py` uitvoeren. De controle is bedoeld voor het ongewijzigde ontvangen pakket; na het invullen van uitvoeringsregisters zullen hun hashes terecht verschillen. Bewaar daarom een originele kopie naast de werkversie.
