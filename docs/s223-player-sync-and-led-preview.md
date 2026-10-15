# S223 — Synchronisatiebevestiging, LG-videostart en LED-voorbeeld

Scherm ‘Prijslijst Kantine’ bleef fysiek de oude prijslijst tonen. De online LG
meldde runtime 04d5a55f, actieve release e0c35318 en gewenste release 2e6eda9b.
De nieuwe publicatie bevatte alleen de gereed verwerkte video ‘Narrow’.
Voorbereiding en wisselgrens waren geregistreerd, maar firstFrameAt ontbrak.
Een geslaagde download of status ‘active’ bewees hier geen zichtbaar nieuw beeld.
Dit bewijst nog niet welke decodergebeurtenis op de fysieke LG ontbrak.

De LG-startbewaking keek alleen naar paused/readyState. Een video die volgens
het element speelde, maar nooit playing meldde, viel buiten zowel start- als
voortgangsbewaking: de tweede begon pas na commit. De Player bevestigt nu ook
werkelijke tijdsvoortgang met gedecodeerde dimensies. Een onvoltooide start
loopt altijd begrensd af; de oude zichtbare laag blijft tijdens herstel staan.
Afspeelfouten en herstel gaan via de bestaande gesaniteerde heartbeatdiagnostiek.
Een release wordt pas actief gemeld na de nieuwe zichtbare laag en twee paintframes.

De vorige sync-knop schreef een timestamp die de eerstvolgende heartbeat blind
verwijderde. Geen van beide Players las die opdracht. De v3-heartbeat levert de
bestaande tenant-/devicegebonden timestamp en accepteert alleen een exacte
ontvangstbevestiging. Oude heartbeats blijven compatibel, maar wissen geen
ongezien verzoek. Een te late bevestiging kan een nieuwer verzoek niet wissen.
Browser en ES5-LG resetten ETag/backoff en halen opnieuw het manifest op.
De bestaande assetverificatie, natuurlijke wisselgrens en geverifieerde cache
blijven leidend. Een correct spelende video wordt niet opnieuw gestart.
‘Nu synchroniseren’ staat bovenaan Schermdetail en bij Gezondheid/bulk; de
serveractie keert terug naar het bestaande Gezondheid-tabblad.

Het LED Scores-voorbeeld gebruikte vaste native markup zonder meetbare schaling.
Beide LED-editors gebruiken nu dezelfde gemeten presentatiecomponent als andere
previews, binnen een viewportafhankelijk begrensd vak. Het volledige 9:16- of
16:9-canvas past zonder uitsnijden of horizontale pagina-overflow.

Validatie: foundation lint/typecheck/unit; geïsoleerde verse reset met 167
migraties, volledige RLS 110 bestanden/3.086 assertions en security-advisors
zonder fouten. Nieuwe browserproeven bewijzen ontvangstbevestiging zonder
herdownload/herstart, ontbrekend playing-event, begrensde vastgelopen start,
behoud van het oude menu en herstel. Acht viewportcombinaties controleren het
werkelijke LED-editorcomponent. Achttien publicatie-/sync-regressies en zeven
offlineproeven plus vier Player-a11yproeven op de productiebuild slagen. Volledige exacte CI en beschermde uitrol moeten
voor de definitieve livebevestiging slagen. Lokale eerste ontwikkelserverproeven
raakten bestandslimieten/compilatiebelasting; die fouten blijven in het lokale
bewijs staan en worden afzonderlijk met een productiebuild gecontroleerd.

Forwardmigratie: v2 behoudt zijn UUID-contract; v3 voegt een JSON-ontvangstbewijs
toe met dezelfde devicecredentialcontrole en expliciete uitvoerrechten.
Rollback van applicatiecode blijft veilig via v2; verwijder v3 pas nadat alle
v3-clients zijn teruggedraaid. Er worden geen playlists/slides, media, credentials
of bestaande releases gewijzigd door deze migratie.
