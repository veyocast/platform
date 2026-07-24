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

## Invloedrijke keuzes voor de eindrapportage

- Definitieve fontset en distributielicenties.
- Eventuele toekomstige veilige, expliciete mediareplacement-versies.
- Eventuele organisatiebrede brandkit- of systeemtemplatebeheerroute.
- Horizontale workerschaal en renderquota voor brede productie-uitrol.

Deze keuzes blokkeren de eerste veilige versie niet en worden niet stilzwijgend
als commerciële of operationele toezegging geïmplementeerd.
