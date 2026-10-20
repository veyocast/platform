# S270 — Volledige lange publieke koppen

De echte S244-capture0946 op390px toont dat “Verwerkersovereenkomst” rechts
buiten de hero en viewport valt. De documentbreedtecontrole alleen ontdekte dat
niet. De bestaande lokale h1-regel voor behouden publieke pagina’s laat lange
woorden nu binnen de beschikbare ruimte afbreken. De introductie kan daardoor
ook binnen haar oorspronkelijke kolom blijven.

De tekst, juridische conceptstatus, fonts, maten, kleuren, prijzen, routes,
geselecteerde negen Source-pagina’s en locked assets blijven behouden.
Er is geen nieuwe test geschreven die de reversibele CSS-declaratie spiegelt.
Gerichte native controle van de echte tekstregelgeometrie op390/1440: de oude
gebouwde pagina heeft op390 drie tekstregels buiten haar310px-kolom (native
exit1); desktop heeft geen afkapping. De exacte stijlinjectie met Nederlandse
woordafbreking en veilige lange-woordfallback heeft op beide breedtes nul
buitenliggende tekstregels (native exit0). Root heeft de volledige mobiele en
de twee viewportbeelden bekeken: “Verwerkers-overeenkomst” breekt natuurlijk
in twee regels, de volledige intro past. Nul non-GET, browserfouten en cookies;
beide browsers gesloten, bron/SDK gelijk. Bewijs: lokale S270-baselinee5dd60cb,
finalecandidate636039d6; de eerste kandidaat met alleen noodafbrekingaf8592b8
blijft apart behouden. Normale exacte-head CI volgt vóór integratie. Oude beelden en eventueel rood blijven bewaard;
een afzonderlijke stijlinjectie is geen nieuwe productionbuild of algemene
pixel-/V1-/vijfrondenacceptatie. Definitieve integratie en uitrol via S244.
