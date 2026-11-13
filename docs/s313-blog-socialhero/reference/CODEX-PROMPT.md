# Codex-opdracht voor VeyoCast en SocialHero

Gebruik deze opdracht in de VeyoCast-repository voor deel A en vervolgens in de SocialHero-repository voor deel B. Gebruik het overdrachtspakket als ontwerp- en acceptatiereferentie. Lees eerst CANON.md, BRONBASIS.md, SOCIALHERO-CONTRACT.md en ACCEPTATIE.md. De bijgevoegde oorspronkelijke briefing is context voor de generieke voorbeelden. Gebruik voor deze uitrol VeyoCast.

## Eerst verifiëren

1. Lees `AGENTS.md`, de repository- en deploydocumentatie en de relevante workflows. Leg branch, commit en doelomgeving vast. Verifieer de actuele bron en inspecteer routes, componenten, media, autorisatie, datamodel, bestaande content en CI/CD. Zoek in beide repositories naar het al bestaande SocialHero-contract en leg compatibiliteit of de benodigde adapter vast.
2. Hergebruik `/blog` en `/blog/[slug]` in `apps/marketing`. Bevestig de werkelijke VeyoCast-URL’s per omgeving in configuratie. Gebruik de marketinghome op `/` in VeyoCast. De Sites-demo kan dezelfde home naast Control aanbieden op `/website`. Gebruik `nl-NL` en VeyoCast als standaardwaarden als bestaande configuratie ontbreekt.
3. Maak screenshots van de bestaande toepassingsshell en neem de prototypeschermen over met dezelfde tokens en componenten. Gebruik dezelfde dataset als het prototype om verschillen in de implementatie te controleren. Bewaar links en navigatie die de bestaande shell al aanbiedt.

## A · VeyoCast

- Bouw de afgeschermde platformredactie in `apps/control`, met TipTap en media volgens het canon. Bouw overzicht, detail en metadata in `apps/marketing`. Gebruik de bestaande server-side autorisatie en een capability voor de platformredactie. Maak forward-only migraties onderdeel van het bestaande releasepad en hergebruik bestaande mediaopslag waar de toegangsgrenzen passen. Zie BRONBASIS.md voor precieze paden.
- Scheid stabiele artikelidentiteit, bewerkbare revisie en gepubliceerde revisie. Borg slugs, redirecthistorie en externe ID's transactioneel. Voltooi publicatie en verificatie ook wanneer een proces na een succesvolle databasewrite herstart. Maak een artikel op de openbare URL beschikbaar zodra een publicatie is bevestigd. Verifieer dat de bloglijst, detailpagina en sitemap de gepubliceerde inhoud tonen.
- Bouw een SocialHero-adapter bij het bestaande contract wanneer dat geschikt is. Implementeer anders het fallbackcontract. Neem authenticatie, scope, rate limits, media, gevalideerde inhoud en duurzame idempotentie mee. Test de API naast de beheerflow met een afgescheiden testcredential.

## B · SocialHero

- Breid het bestaande websitebeheer uit met de verbindingswizard uit het canon. Beveilig servercredentials in de bestaande server-side secretopslag. Houd tokengegevens uit campagneconfiguratie die naar de browser gaat. Koppel genereren en goedkeuren aan de bestaande contentrevisies. Gebruik de bestaande AI-configuratie.
- Gebruik de bestaande scheduler en werkvoorraad. Veranker taken aan bestemming, artikel en goedgekeurde revisie. Sla uitgaande operaties en hun idempotentiesleutels duurzaam op vóór dispatch. Houd time-out, status, retries en herstart door dezelfde codepaden consistent.
- Controleer na publicatie het domein, de canonieke URL en een expliciet kenmerk van de verwachte publicatie voordat afhankelijke posts doorgaan. Pas de bestaande socialplanning aan met deze afhankelijkheid. Laat herstel dezelfde publicatie hervatten.

## Opleveren

Voer ACCEPTATIE.md uit op de lokale of afgescheiden stagingbestemming. Leg per repo vast welke bronversie, routes, API-versie, configuratievelden, migraties, omgevingsnamen en test-URL’s zijn gebruikt. Noteer commandoregel en uitkomst per uitgevoerde test. Benoem de testadapter of de feitelijk gekoppelde testwebsite. Markeer openstaande controles. Bewaar uitsluitend voorbeeldwaarden in het pakket. Lever de wijziging op via de bestaande Git- en deployflow voor de afgesproken omgeving.

## Referenties

- [TipTap Editor-documentatie](https://tiptap.dev/docs/editor/getting-started/overview)
- [Google Search Central over artikelgegevens](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google Search Central over sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Next.js revalidatePath indien passend bij de gebruikte versie](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
