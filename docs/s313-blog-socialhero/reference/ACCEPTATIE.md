# Acceptatie en testbewijs

Gebruik lokale of afgescheiden stagingbestemmingen. Schrijf in de oplevering per test of deze slaagde, faalde, of openstaat. Noteer branch, commit, omgeving, URL, gebruikte testadapter, commando en zichtbaar resultaat. Verwijder of markeer gebruikte testcontent volgens de omgevingsafspraken. Sluit testcontent op een publieke bestemming uit van indexering.

| Controle | Uitvoering en verwacht resultaat |
|---|---|
| Bronbasis | Leg het VeyoCast-broncommit, het vergeleken prototypecommit en de finale versie vast. Controleer bestaande routes, visuele basis en hoofdfunctionaliteit. |
| UI-overname | Gebruik dezelfde inhoud, fonts en schermbreedtes in Sites en implementatie. Vergelijk publiek overzicht/detail en beheer op desktop en mobiel. Test toetsenbord, focus, long-form content, reflow en dialogen. |
| TipTap | Schrijf en plak content, voeg koppen, lijst, link, quote, tabel en beeld toe, doe undo/redo en heropen het concept. Vergelijk het document, de editor en publieke rendering. Controleer de geplakte schadelijke HTML en onveilige links. |
| Redactie | Maak handmatig een concept met hero, focuspunt, alt, SEO en deelbeeld. Controleer conceptstatus, voorvertoning, publicatie en heropening. Anonieme bezoeker krijgt geen concept of preview. |
| SEO en sociale metadata | Inspecteer de ruwe HTML en sitemap. Controleer H1, headings, canoniek domein en schone URL, publicatiegegevens, auteur, meta, JSON-LD, OG, absoluut en bereikbaar beeld en fallback. Controleer portretuitsnede en alt op desktop en mobiel. |
| Bevoegdheid | Test read-only capabilities voor de juiste site en omgeving. Test ontbrekende, verkeerde, verlopen, ingetrokken en verkeerd gescopete credentials. Resultaten tonen status en code zonder credentialgegevens. |
| Upload | Upload een werkelijke afbeelding, controleer type en echte afmetingen. Weiger te grote, beschadigde en vermomde bestanden en assets uit een andere omgeving. Controleer rate-limitrespons. |
| End-to-end | Keur een campagne goed met site, datum en beeld. Volg media → concept → planning → publicatie → verifieerbare publieke URL. Controleer dat socialposts pas daarna verdergaan. |
| Idempotentie | Herhaal media, concept en publicatie met dezelfde key en payload. Simuleer time-out ná geslaagde write, ook met een herstart. Controleer dat er één logisch resultaat, één artikel en één asset per operatie overblijven. Dezelfde sleutel met andere inhoud geeft conflict. |
| Gelijktijdigheid | Geef twee artikelen dezelfde slug en voer concurrerende revisiewrites uit. Eén slug krijgt voorrang en de andere operatie meldt conflict. Een oude job kan geen nieuwere revisie overschrijven. |
| Revisie en URL | Maak een revisie van een live artikel. Controleer dat de oude openbare inhoud live blijft en een titelwijziging de URL vasthoudt. Publiceer vervolgens een bewuste slugwijziging en volg de permanente redirect vanaf elke oude route. |
| Herstel | Pauzeer de verbinding of maak de openbare URL tijdelijk onbereikbaar. Controleer wachtstatus, retries en hervatting. Geen afhankelijke socialpost zonder geverifieerde websitepublicatie. |
| Cache en deploy | Controleer actuele lijst, detail en sitemap na publicatie, herstart en cacheverversing. Voer bestaande buildchecks uit en verifieer de migraties in het gewone releasetraject. |

## Configuratie en bewijs per repository

- Vermeld website-ID, omgeving, blogpad, basis-URL en contractversie. Beschrijf ook de voor test gebruikte adapter.
- Vermeld migratiepaden, toegepaste databaseversies, relevante queuejobs en cacheverversing.
- Beschrijf benodigde configuratievelden en credentialscopes met placeholders. Noteer alleen veilige request-ID’s.
- Voeg de resultaten van de integratieproef toe. Markeer duidelijk of het gaat om browserdemonstratie, testadapter of echte websitekoppeling.
