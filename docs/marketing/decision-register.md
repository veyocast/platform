# VeyoCast marketingwebsite — beslisregister

Laatste controle: 24 juli 2026  
Sprint: S38  
Canon: VeyoCast Marketingwebsite Pixelperfect SEO Canon v1.0

## Doorgevoerde keuzes

| Onderwerp | Besluit | Reden en gevolg |
|---|---|---|
| Visuele richting | De laatste zwarte, oranje en gebroken-witte mock-up is leidend. De oude blauwe/paarse marketingrichting is volledig vervallen. | Marketing vormt één herkenbare familie met de goedgekeurde VeyoCast-lock-up en de huidige Publisher. |
| Productbeelden | Alleen echte screenshots uit `docs/screenshots` worden gebruikt. | Productclaims blijven controleerbaar en beelden vervormen de werkelijke UI niet. |
| Social proof | De testimonialsectie is vervangen door drie aantoonbare productbewijzen. | Er zijn geen goedgekeurde klantcitaten, portretten of klantlogo’s. Fictieve namen of resultaten zijn verboden. |
| Integraties | Alleen een transparante overzichtspagina is indexeerbaar. Individuele providerpagina’s zijn nog niet gepubliceerd. | Sportlink, KNVB en Twelve hebben nog geen aantoonbaar goedgekeurde productstatus. |
| Prijzen | De pagina toont schaalrichtingen zonder bedragen en verwijst naar een bevestigd voorstel. | Definitieve prijsbedragen, contractinhoud en pakketgrenzen zijn niet goedgekeurd. |
| Cases en blog | Schaalbare detailroutes bestaan, maar de gepubliceerde registers zijn leeg. De indexroutes blijven `noindex`. | Er zijn nog geen goedgekeurde cases of blogpublicaties. Onbekende slugs geven een branded 404. |
| Formulieren | Invoer wordt server-side gevalideerd, maar niet opgeslagen of als verzonden voorgesteld. De gebruiker krijgt een directe mailroute. | Er is nog geen goedgekeurde e-maildeliveryprovider geconfigureerd. |
| Fotografie | De locatiesectie gebruikt een code-native ClubTV-schermwand. | Er is geen goedgekeurde venuefotografie en beeldgeneratie is niet automatisch toegestaan. |
| Indexatie | Alleen `VEYOCAST_ENVIRONMENT=production` mag indexeren. Canonicals blijven altijd op `https://veyocast.nl`. | Staging en development mogen nooit in zoekmachines terechtkomen. |
| Motion | Motion is beperkt tot 140–220 ms micro-interacties, menu/dialogtransities en een rustige productfloat. Content is zonder animatieafhankelijkheid direct zichtbaar. | Geen layout shift, lege offscreen captures of toegankelijkheidsverlies; `prefers-reduced-motion` blijft leidend. |
| Analytics | Geen marketingtracking of analytics toegevoegd. | De pagina’s, privacytekst en performance blijven zonder tracking bruikbaar. |

## Open goedkeuringsbesluiten

1. Lever goedgekeurde echte klantlogo’s, citaten, rollen en toestemming voordat testimonials of logo’s worden gepubliceerd.
2. Keur definitieve prijzen, pakketgrenzen en contracttekst goed voordat bedragen of vergelijkende commerciële claims verschijnen.
3. Keur per provider de integratiestatus en woordkeuze goed voordat een detailroute in sitemap of navigatie komt.
4. Kies en contracteer een e-mailprovider voordat demo- en contactformulieren gegevens afleveren.
5. Lever of keur venuefotografie goed wanneer de code-native schermwand door fotografie moet worden vervangen.
6. Laat algemene voorwaarden en verwerkersovereenkomst juridisch goedkeuren; de voorbereidende routes blijven tot die tijd `noindex`.
7. Lever een goedgekeurde 1200×630 social-share master. Tot die tijd gebruikt metadata de bestaande goedgekeurde vierkante social-avatar.

## Publicatieregel

Een open besluit wordt niet met aannames opgelost. De bijbehorende route of claim
blijft expliciet begrensd totdat bron, eigenaar en goedkeuring aantoonbaar zijn.
