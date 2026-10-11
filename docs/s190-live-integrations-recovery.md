# S190 — LED Scores en Sportlink herstellen

## Bewezen oorzaken

De publieke LED Scores-feed van Duindorp SV levert null-opstellingen en extra
metadata bij `scoreboard.scored`. De oude strikte parser wees deze geldige
berichten af. Na de eerste-berichttimeout herverbond de worker steeds opnieuw.
Een read-only probe met de gecorrigeerde parser verwerkte een werkelijk bericht
in 618 ms. Score, team-ID, zijde en scoredatum blijven streng gevalideerd;
`serverDate` krijgt geen goalautoriteit.

Sportlink-opslag verhoogde de bronrevisie en bouwde vervolgens binnen dezelfde
transactie alle latest-slidesnapshots én gepubliceerde databindingen. Dat maakte
bronopslag afhankelijk van rendering/projectie en kon de hele opslag terugrollen
met SQLSTATE 57014. Verjaardagen hadden daarnaast een foutieve leegtecontrole:
geldige records buiten de 21-dagenselectie werden als normalisatiefout behandeld.

Een claim-RPC-fout in Sportlink/RSS kon buiten de foutafhandeling ontsnappen en
de hele workerpool laten stoppen. Een LED-release-RPC kon een ongeobserveerde
Promise-rejection veroorzaken. Een vastgelopen shutdown wachtte onbeperkt op
alle taken. Dit zijn bewezen codepaden; de exacte eerste productie-exceptie van
10 oktober is zonder runtimebewijs niet vastgesteld.

De tenant-scoped productie-inventarisatie van 11 oktober 11:12 UTC zag zes
gebruikte publicaties, 53 databindingen en 1.217 bestaande releases. Alle gebruikte
RSS-bronnen en Sportlink waren sinds 10 oktober circa 12:03 UTC niet meer
verwerkt. Sportlink rapporteerde `sportlink_sync_complete_57014`. De inventarisatie
wijzigde geen gegevens: Actions-run `38134555701`.

## Verwerking en herstel

Provider → serverworker → genormaliseerde tenantdatabase → durable queue →
`published_dynamic_data` → geautoriseerde Player API → scherm. Slides verbinden
niet met de provider. Een succesvolle bronwaarneming zet uitsluitend binding-ID's
klaar, ook bij identieke broninhoud om datumvensters opnieuw te beoordelen.

De queue coalescet per tenant/snapshot. Een service-only workerclaim geeft een
lease; één afzonderlijke RPC bouwt één dataset vanuit de exacte gepubliceerde
slideversie. Presentatie/thema/layout blijven bevroren. Alleen een gewijzigde
contenthash verhoogt `data_revision`. Nieuwe aanvragen tijdens verwerking blijven
staan. Fouten behouden de laatste goede dataset en worden met oplopende
wachttijden opnieuw geprobeerd. De queue gebruikt dezelfde gedeelde readinesspoll
als de renderqueues; nieuwe permanente lege poll-lussen zijn niet toegevoegd.

Bronupdates maken geen nieuwe snapshots, PNG's, slideversies of playlistreleases.
Bewuste ontwerp-/themawijzigingen houden hun bestaande render/publicatieroute.
Private compatibiliteitshelpers voor oudere workers zetten alleen bronververswerk
klaar. De retired auto-publicatieketen blijft uitgeschakeld.

Workerqueues worden onafhankelijk gesuperviseerd. Tijdelijke backendfouten
stoppen de andere queues niet; verzoeken voor bronverwerking en de nieuwe
dataverwerking zijn begrensd op 30 seconden. Shutdown geeft taken maximaal 20
seconden; een vastgelopen drain verlaat het proces zodat het bestaande
Dockerrestartbeleid kan herstellen. Leaseverlies sluit de LED-socket; oude
socketberichten worden niet alsnog verwerkt.

## Status en privacy

LED `connected` volgt pas na geldige opgeslagen data. Ongeldige frames tonen een
foutstatus met veilige veldpaden, nooit payloadwaarden; volgende geldige data
herstellen direct. Sportlink haalt de laatste run per dataset op. Fouten, pauze,
onbekende status en verouderde waarnemingen gaan vóór historische successen.
Een datumvenster zonder geldige geselecteerde verjaardagen is een geldige lege
dataset; een niet-lege providerresponse zonder enig geldig record behoudt LKG.

De protected `probe-live-integrations.yml`-workflow leest uitsluitend de gekozen
tenant binnen de exact gedeployde worker. De diagnose bevat tellers, revisions,
timestamps en veilige foutcodes. De optionele verjaardagenprobe houdt de
Client ID en providerpayload binnen de bestaande workergrens en toont uitsluitend
normalisatietellers. Geen persoonsgegevens, tokens of provider-URL's komen in
artefacten. De huidige Playerheartbeat bevestigt configuratie/target, maar heeft
geen per-binding datarevision-ack; een DB-readback is geen bewijs van een fysiek
zichtbaar frame.

## Oude versies verwijderen

Een nieuwe publicatie of gepubliceerde slideversie en een daadwerkelijke
Playeractive-ack zetten tenantgebonden opruimwerk klaar. De service-only queue
verwerkt begrensde batches. Ook na het vrijgeven van een laatste pin worden
oude kandidaten periodiek opnieuw beoordeeld.

Releases blijven zolang actuele publicaties, alle scherm-/groepdefaults, actieve
of gewenste devices, bestaande planningen, sponsorbewijs, levende targets of
retrybare themarollouts ze gebruiken. Snapshots/ontwerpversies blijven zolang
huidige slides, concept/pinned playlistitems, behouden releases, renderjobs of
rollouts ze gebruiken. Ook lang offline devices behouden hun release; er is
geen leeftijdsexceptie die hun LKG verwijdert.

Opruiming bewaart het hoogste versienummer, verifieert referenties opnieuw onder
locks en schrijft een technische audit voordat de transactie commit. Alleen
obsolete provenancewijzers worden binnen een eigenaargeschreven kandidaatcontext
ontkoppeld. Een nieuw FK of concurrerende referentie rolt de hele kandidaat terug.
Gedeelde media, uploads en Storagebytes worden niet verwijderd door deze
versieopruiming. De migratie zelf verwijdert geen historische inhoud.

## Uitrol en bewijs

Lokale verificatie op de gecombineerde S189/S190-code: workspace lint,
typecheck en unit-tests elk 30/30; integrations 147, worker 237 en Control 419
unit-tests; verse geïsoleerde DB-reset en 87 RLS-bestanden met 2.293 assertions.
De productiebuild van de apps is 18/18 groen; de definitieve worker en zijn
dependencies zijn opnieuw gebouwd, 7/7 groen. De twee-verbindingenproef toont dat
een verlopen maar nog verwerkte databinding door prune wordt overgeslagen terwijl
bronopslag en een nieuwe generation doorgaan. Bij vrijgave verwijdert prune
exact één oude kandidaat en blijven actuele payloads intact.

Toegankelijkheid: 35 controles groen en één opt-in skip. Eén dev-serverherstart
onderbrak vier controles; die zijn afzonderlijk opnieuw groen met meer
testserverheap. De volledige Chromium-run en hosted CI/readbacks volgen in de PR.
De nieuwe workflow, deploymentbeveiligingsvalidators en VPS-definities zijn
gecontroleerd. Een bestaande `fieldflow-royal-theme-reset.yml` laat de lokale
ShellCheck-combinatie vastlopen; de afzonderlijke nieuwe workflow valideert direct.
Dit is geen bewijs dat de hosted workflowgate groen is; die blijft vereist.

1. Verse geïsoleerde DB-reset, volledige RLS, workspace lint/typecheck/test/build
   en verplichte Control-browsergates.
2. Exact-SHA stagingdeployment, protected readback en eventuele canarysync via
   de bestaande `current-publication-maintenance.yml`-operatie `refresh`.
3. Productie pas na staging. Controleer workergezondheid, nieuwe LED-valid-message,
   laatste Sportlinkruns, queuevoortgang en inhoudshashes. Laat de huidige
   publicatie-IDs, configuratierevisies en schermtargets gelijk tijdens bronrefresh.
4. Vergelijk render-/snapshot-/releaseaantallen vóór/na bronrefresh; alleen veilige
   versieprune mag die aantallen verlagen. Nieuwe providerinhoud verhoogt uitsluitend
   de databindingrevision. Fysiek/offline schermbewijs blijft afzonderlijk gemeld.

Geen absolute garantie dat externe providers nooit uitvallen. Regressies,
begrensde onafhankelijke retries, veilige statussen en readback maken bekende
foutpaden herstelbaar en zichtbaar.
