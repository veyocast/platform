# S269 — Tabelscroll zonder verschuivende hoofdruimte

De daadwerkelijke S244-nativecontrole op390px heeft buiten de tabel horizontale
scroll gevonden: Activiteit66px, Team57px, Platformsysteem89px en het eigen
tenantdetail36px. Tegelijk meldt `document` nul overflow. De opgeslagen Team-
vervolgafbeelding toont daardoor een naar links geschoven paginatitel. Alleen een
documentbreedtecontrole of een lege tabel is voor dit defect onvoldoende.

De drie bestaande Sync-tabelscrollframes krijgen een lokale positioneringsbasis.
Hun absoluut gepositioneerde, geclipte toegankelijke labels blijven daardoor
binnen de bestaande scroller. Er wordt geen extra overflow verborgen en geen
zichtbare breedte, tekst, rij, kolom of actie verwijderd. De oorspronkelijke
tabelscroll blijft beschikbaar; Player en sliderenderers gebruiken deze Sync-
beheerselectors niet.

De bestaande Team-workflowtest blijft bytegelijk als prefix behouden. Twee
aanvullende gevallen gebruiken dezelfde echte Team-pagina en bestaande gevulde
gecontroleerde leesmodellen. Zij controleren hoofdruimtebreedte op390/1440,
daadwerkelijke afzonderlijke tabelscroll, dezelfde titelpositie en drie volledige
leden, zonder writes of browserfouten. De beschermde adapterhash in de bestaande
platformlayoutfixture wordt uitsluitend voor deze exacte CSS-delta bijgewerkt.

Oorspronkelijke baselinebeelden: A0030/A0031, A0151/A0152/A0153, A0184/A0185
en A0435/A0436, gebouwd op `8e03f2b36b0c9f82852a1531c72074a552d18412`.
De originele captures, ook de horizontaal verplaatste beelden, blijven behouden.
Native rood-groen, causale controle op de vier echte routes, de bestaande
platformlayoutgevallen en normale CI worden afzonderlijk geregistreerd. Er is
hier nog geen nieuwe volledige of fysieke acceptatieclaim; vijf reviewpassen en
staging/productie blijven onderdeel van S244.
