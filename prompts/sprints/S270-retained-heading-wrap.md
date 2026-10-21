# S270 — Lange publieke koppen blijven volledig leesbaar

De echte mobiele S244-capture0946 op390px toont dat de lange kop op
`/verwerkersovereenkomst` rechts buiten beeld loopt en ook de introductie
verbreedt. Herstel de woordafbreking binnen de bestaande behouden publieke
hero. De geselecteerde negen Source-pagina’s en originele copy blijven gelijk.

Root is de enige writer. Eén eigen branch/worktree/PR op S244, basis0f5a7397.
Exclusieve ownership: `apps/marketing/app/_sync/retained.css` (alleen
woordafbreking met `hyphens:auto` en `overflow-wrap:anywhere` bij de bestaande h1-regel); dit prompt, `docs/s270-retained-heading-wrap.md`, eigen ledgerregel.

Behoud fonts, maten, kleuren, copy, prijzen, juridische status, providers,
commands, routes en locked assets. Geen dependency- of Source-wijziging.
Controleer echte tekstregels en de intro binnen hun container/viewport; alleen
documentoverflow0 volstaat niet. Bewaar het oude afgekapt beeld en roodbewijs.
Gebruik gerichte native/CI-gates; geen nieuwe repositorytest voor deze kleine
reversibele CSS-correctie. De afzonderlijke browsercontrole meet echte
tekstregels vóór en na de exacte stijl, geen herhaling van de declaratie.
Volledige vijf vergelijkingsronden en uitrol blijven bij S244.
