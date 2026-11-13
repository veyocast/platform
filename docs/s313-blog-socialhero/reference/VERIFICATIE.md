# Verificatie in het prototype

- Repo-baseline `4f44bbdd68d22ca2aca42f01a8d68dbe1a120770`. De basissynchronisatie controleerde 1.686 bronbestanden, waarvan 1.683 bytegelijk en drie aangepast voor de geïsoleerde demosessie. De blogwijziging heeft daarna eigen navigatie en routes toegevoegd.
- TipTap-schema en strikte TypeScript-controles voor editor, blogbeheer en publieke componenten geslaagd. De round-trip dekte koppen, links, checklists, afbeeldingsafmetingen, tabellen en YouTube.
- Server-side weergavetests geslaagd voor de drie voorbeeldartikelen, categorieën, alt-tekst, focuspunt en veilige weergave van onbetrouwbare inhoud. De drie voorbeelddeelbeelden zijn 1200 × 630 px.
- De SQLite-proef bevestigde dat een conceptwijziging de live-slug bewaart en een gepubliceerde slugwijziging een gereserveerde redirect oplevert. Schema-invoer met ongeldige rich text of een externe hero-URL wordt geweigerd.
- De productieverificatie uit ACCEPTATIE.md vraagt een geïsoleerde VeyoCast-testbestemming en de echte SocialHero-implementatie. Het Sites-prototype bevat een gemarkeerde SocialHero-simulatie.
- Het privéprototype is gepubliceerd als Sites-versie 2, broncommit `68cadfd0e997a32169dc40c2c9290eb0657f3b77`. De marketingpagina, het blogoverzicht, de sitemap en alle drie voorbeeldartikelen gaven HTTP 200. Op de drie details zijn absolute canonical URLs, Open Graph-deelbeelden en Article/BlogPosting-gegevens gecontroleerd.
- De browser toonde de bestaande privéaanmelding. De ingelogde redacteursflow is aanvullend lokaal getest op de opslagadapter, inclusief aanmaken, publiceren, conceptisolatie, verouderde revisies, slugconflicten en redirects. Een echte SocialHero-campagne is onderdeel van de productieacceptatie.
