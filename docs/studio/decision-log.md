# VeyoCast Studio — beslislog

## Vastgelegde kleine keuzes

1. **Gedeeld contract:** een nieuw `@veyocast/studio`-package bevat schema,
   motionmath, templates, fontregistry en rendercontract. Het package blijft vrij
   van React, Next, Supabase en Node-only imports.
2. **Canvas:** React Konva is alleen een interactieve adapter. Database en
   renderer kennen uitsluitend het VeyoCast-documentmodel.
3. **Systemtemplates:** versioned codefixtures. Tenanttemplates zijn tenantdata
   met RLS. Hierdoor bestaan geen nullable of globaal beschrijfbare tenantrecords.
4. **Export:** standaard PNG zonder motion en MP4 met motion. Iedere export maakt
   een nieuw media-item en bevriest eerst een revisie.
5. **Rendering:** dezelfde tijd-, easing- en transformberekeningen worden in
   preview en worker gebruikt. FFmpeg blijft de encoder.
6. **Mobiel:** overzicht, templategebruik, contentvelden, preview en renderstatus;
   geen verkleinde desktopcanvas-editor.
7. **Fonts:** V1 gebruikt uitsluitend de lokaal gebundelde Inter Variable-fonts.
   Externe fonts en runtime-fetches zijn niet toegestaan.
8. **Huisstijl:** een tenantbeheerder beheert één optionele brandkit met
   tenant-eigen ready logoasset en kleuren. Toepassen maakt een deterministische
   documentkopie; het systemtemplate blijft immutable.
9. **Herstel:** iedere tiende save maakt een checkpoint. Herstellen maakt een
   nieuwe revisie en gebruikt dezelfde optimistic-concurrencygrens.

## Invloedrijke keuzes voor de eindrapportage

- Eventuele toekomstige veilige, expliciete mediareplacement-versies.
- Horizontale workerschaal en renderquota voor brede productie-uitrol.
- Production-SLO en toegelaten documentcomplexiteit na benchmarks.

Deze keuzes blokkeren de eerste veilige versie niet en worden niet stilzwijgend
als commerciële of operationele toezegging geïmplementeerd.
