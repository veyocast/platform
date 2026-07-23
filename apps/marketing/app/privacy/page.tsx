import type { Metadata } from "next";

import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://veyocast.nl/privacy"
  },
  description:
    "Lees welke persoonsgegevens en technische gegevens VeyoCast verwerkt, waarom dat gebeurt en welke keuzes en rechten u heeft.",
  openGraph: {
    description:
      "Welke persoonsgegevens en technische gegevens VeyoCast verwerkt en waarom.",
    locale: "nl_NL",
    title: "Privacyverklaring | VeyoCast",
    type: "article",
    url: "https://veyocast.nl/privacy"
  },
  robots: {
    follow: true,
    index: true
  },
  title: "Privacyverklaring | VeyoCast"
};

const contents = [
  ["verantwoordelijkheid", "1. Verantwoordelijkheid"],
  ["gegevens", "2. Gegevens die wij verwerken"],
  ["lokale-opslag", "3. Lokale opslag en cookies"],
  ["doeleinden", "4. Doeleinden en grondslagen"],
  ["delen", "5. Ontvangers en leveranciers"],
  ["bewaren", "6. Bewaren en verwijderen"],
  ["beveiliging", "7. Beveiliging"],
  ["rechten", "8. Uw rechten"],
  ["contact", "9. Contact"]
] as const;

export default function PrivacyPage() {
  return (
    <LegalPage
      description="Deze verklaring beschrijft hoe DG Webservices persoonsgegevens en technische gegevens verwerkt voor de VeyoCast-website, Control, de webplayer/PWA, de Android Player en de bijbehorende infrastructuur."
      eyebrow="Privacy bij VeyoCast"
      title="Privacyverklaring"
      updated="23 juli 2026"
    >
      <nav aria-label="Inhoudsopgave" className="legal-toc">
        <p>Op deze pagina</p>
        <ol>
          {contents.map(([href, label]) => (
            <li key={href}>
              <a href={`#${href}`}>{label}</a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="legal-article">
        <section aria-labelledby="organisatie">
          <h2 id="organisatie">VeyoCast en DG Webservices</h2>
          <address className="legal-address">
            <strong>DG Webservices – VeyoCast</strong>
            <span>Markenseplein 1</span>
            <span>2583 KR Den Haag</span>
            <span>Nederland</span>
            <span>KvK-nummer: 88135713</span>
            <a href="mailto:privacy@veyocast.nl">privacy@veyocast.nl</a>
            <a href="mailto:support@veyocast.nl">support@veyocast.nl</a>
          </address>
          <p>
            VeyoCast is een zakelijke narrowcasting- en schermbeheerdienst. De
            dienst is niet ontworpen als consumentenapp voor kinderen. Personen
            die naar een beheerd scherm kijken worden door de Player niet
            geïdentificeerd. De Player gebruikt geen camera, microfoon,
            gezichtsherkenning of advertentie-ID.
          </p>
        </section>

        <section aria-labelledby="verantwoordelijkheid">
          <h2 id="verantwoordelijkheid">1. Wie is verantwoordelijk?</h2>
          <p>
            DG Webservices is verwerkingsverantwoordelijke wanneer wij zelf het
            doel en de middelen bepalen, bijvoorbeeld voor accountbeheer,
            contractadministratie, support, toegangsbeveiliging en de veilige
            werking van VeyoCast.
          </p>
          <p>
            Voor media, playlists en andere gegevens die een klant in zijn eigen
            VeyoCast-omgeving verwerkt, is die klant doorgaans
            verwerkingsverantwoordelijke en handelt DG Webservices als verwerker.
            Afspraken in een toepasselijke verwerkersovereenkomst gaan voor die
            verwerking voor op deze algemene verklaring.
          </p>
        </section>

        <section aria-labelledby="gegevens">
          <h2 id="gegevens">2. Welke gegevens verwerken wij?</h2>

          <h3>Accounts, organisaties en uitnodigingen</h3>
          <ul>
            <li>naam, e-mailadres en optionele profielfoto;</li>
            <li>organisatie, lidmaatschap, rol, rechten en accountstatus;</li>
            <li>uitnodigings-, registratie-, aanmeld- en sessiegegevens;</li>
            <li>
              organisatie-, contact-, contract- en administratieve gegevens die
              nodig zijn om de zakelijke dienst te leveren.
            </li>
          </ul>
          <p>
            Authenticatie wordt via Supabase Auth afgehandeld. Wachtwoorden
            worden niet als leesbare tekst in VeyoCast opgeslagen.
          </p>

          <h3>Schermen, Players en pairing</h3>
          <ul>
            <li>
              door VeyoCast gegenereerde screen-, device-, release- en
              playlist-ID’s;
            </li>
            <li>
              apparaatnaam, platform, appversie, beperkte user-agentinformatie,
              schermresolutie en capabilities;
            </li>
            <li>
              pairingstatus, versleuteld gehashte pairinggegevens, aanmaak- en
              vervaltijden en mislukte pogingen;
            </li>
            <li>
              actieve en gewenste release, huidig playlistitem, runtime- en
              synchronisatiestatus;
            </li>
            <li>
              netwerkstatus, beschikbare en gebruikte lokale opslag,
              heartbeattijden en begrensde technische foutcodes;
            </li>
            <li>
              IP-adres en user-agent voor netwerkafhandeling, beveiliging en
              serverlogs. Bij pairing wordt hiervan een gehashte
              beveiligingsvingerafdruk afgeleid.
            </li>
          </ul>
          <p>
            Een device-token wordt via een beveiligde verbinding verzonden en
            gehasht in de database bewaard. VeyoCast gebruikt geen IMEI, IMSI,
            simkaartnummer of Android-advertentie-ID voor pairing.
          </p>

          <h3>Media, playlists en klantcontent</h3>
          <ul>
            <li>afbeeldingen, video’s, logo’s en andere geüploade content;</li>
            <li>
              titel, oorspronkelijke bestandsnaam, MIME-type, bestandsgrootte,
              checksum, afmetingen, videoduur en verwerkingsstatus;
            </li>
            <li>
              playlistvolgorde, speelduur, schermtoewijzingen, concepten en
              onveranderlijke gepubliceerde releases;
            </li>
            <li>
              validatie- en verwerkingsfouten die nodig zijn om een upload veilig
              af te handelen.
            </li>
          </ul>
          <p>
            De klant bepaalt welke content wordt geplaatst en blijft
            verantwoordelijk voor de rechtmatigheid, persoonsgegevens en
            intellectuele-eigendomsrechten daarin.
          </p>

          <h3>Audit, support en websiteverkeer</h3>
          <ul>
            <li>
              kritieke beheeracties, actor, tenantcontext, uitkomst en tijdstip;
            </li>
            <li>
              naam, contactgegevens, berichtinhoud, bijlagen en technische
              supportinformatie wanneer iemand contact opneemt;
            </li>
            <li>
              IP-adres, tijdstip, route, browser- of apparaatcategorie,
              antwoordstatus en foutcode in technische toegangs- en serverlogs.
            </li>
          </ul>
          <p>
            De publieke marketingpagina’s bevatten momenteel geen advertentie-,
            analyse- of trackingcode. VeyoCast heeft geen eigen betaalprovider,
            analytics-SDK of crashrapportage-SDK in de Android-app.
          </p>
        </section>

        <section aria-labelledby="lokale-opslag">
          <h2 id="lokale-opslag">3. Lokale opslag en cookies</h2>

          <h3>VeyoCast Control</h3>
          <p>
            Control gebruikt noodzakelijke Supabase-authenticatiecookies en
            beveiligde contextcookies om een sessie, organisatiecontext en
            uitnodiging te verwerken. De organisatiecontextcookie kan maximaal
            30 dagen geldig zijn; uitnodigingscookies maximaal één uur.
            Functionele voorkeuren voor thema, navigatie, tabelweergave en de
            uploadtray worden lokaal in de browser opgeslagen. Bij een
            hervatbare upload kan ook niet-inhoudelijke bestandsmetadata lokaal
            worden onthouden.
          </p>

          <h3>VeyoCast Player en Android-app</h3>
          <p>
            De Player gebruikt localStorage, IndexedDB en Cache Storage voor de
            devicesessie, pairingstatus, de actieve en vorige geldige release,
            media en herstelinformatie. Dat maakt last-known-good en tijdelijk
            offline afspelen mogelijk. De Android-shell gebruikt daarnaast
            lokale appinstellingen voor autostart en de laatste bootpoging.
          </p>
          <p>
            Deze gegevens blijven op het apparaat aanwezig tot VeyoCast ze
            vervangt of opruimt, de beheerder de appopslag wist, de app
            verwijdert of het apparaat reset. Alleen ontkoppelen op afstand wist
            een volledig offline apparaat niet onmiddellijk. Lees de stappen op{" "}
            <a href="/data-verwijderen">Data verwijderen</a>.
          </p>
        </section>

        <section aria-labelledby="doeleinden">
          <h2 id="doeleinden">4. Doeleinden en grondslagen</h2>
          <div className="legal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Doel</th>
                  <th>Voorbeelden</th>
                  <th>Grondslag</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Dienst leveren</td>
                  <td>
                    Accounts, media, schermen, pairing, releases, synchronisatie
                    en offline playback
                  </td>
                  <td>Uitvoering overeenkomst</td>
                </tr>
                <tr>
                  <td>Beveiliging en betrouwbaarheid</td>
                  <td>
                    Toegangscontrole, rate limiting, audit, heartbeats,
                    foutanalyse en incidentherstel
                  </td>
                  <td>Gerechtvaardigd belang en uitvoering overeenkomst</td>
                </tr>
                <tr>
                  <td>Support en servicecommunicatie</td>
                  <td>Vragen beantwoorden en noodzakelijke serviceberichten</td>
                  <td>Overeenkomst of gerechtvaardigd belang</td>
                </tr>
                <tr>
                  <td>Administratie</td>
                  <td>Contracten, facturen en wettelijke administratie</td>
                  <td>Overeenkomst en wettelijke verplichting</td>
                </tr>
                <tr>
                  <td>Optionele verwerking</td>
                  <td>
                    Alleen als later bijvoorbeeld niet-noodzakelijke cookies
                    worden ingevoerd
                  </td>
                  <td>Toestemming waar vereist</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            VeyoCast verkoopt geen persoonsgegevens, bouwt geen individuele
            kijkersprofielen en gebruikt geen advertentienetwerk om content op
            kijkgedrag te personaliseren. Technische automatische beslissingen,
            zoals het blokkeren van een verlopen pairingcode of een incomplete
            release, hebben geen juridische of vergelijkbaar ingrijpende
            persoonsgerichte gevolgen.
          </p>
        </section>

        <section aria-labelledby="delen">
          <h2 id="delen">5. Met wie delen wij gegevens?</h2>
          <p>
            Alleen bevoegde gebruikers van de betreffende organisatie krijgen
            toegang tot gegevens die voor hun rol nodig zijn. Voor de technische
            dienst worden daarnaast de volgende leveranciers gebruikt:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> voor database, authenticatie en private
              mediaopslag. Supabase werkt met eigen subverwerkers zoals
              beschreven in zijn actuele verwerkersvoorwaarden.
            </li>
            <li>
              <strong>Hetzner</strong> voor de VPS waarop de publieke
              VeyoCast-webapplicaties en reverse proxy draaien.
            </li>
            <li>
              <strong>Hostnet</strong> voor de e-mailroutering van het
              veyocast.nl-domein en correspondentie die via die mailboxen wordt
              afgehandeld.
            </li>
            <li>
              <strong>GitHub</strong> voor broncodebeheer en geautomatiseerde
              build- en deploymentworkflows. Secrets worden niet in de broncode
              opgeslagen.
            </li>
            <li>
              <strong>Google Play</strong> voor distributie van de Android-app.
              Google is zelfstandig verantwoordelijk voor gegevens rond het
              Google-account, apparaat en Play Store-gebruik.
            </li>
          </ul>
          <p>
            Gegevens kunnen ook worden verstrekt aan professionele adviseurs of
            bevoegde instanties wanneer dat noodzakelijk of wettelijk verplicht
            is. Wij verkopen geen persoonsgegevens.
          </p>

          <h3>Verwerking buiten de EER</h3>
          <p>
            Sommige leveranciers of hun subverwerkers kunnen buiten de Europese
            Economische Ruimte gevestigd zijn. Waar nodig worden daarvoor een
            adequaatheidsbesluit, Europese standaardcontractbepalingen en
            aanvullende maatregelen gebruikt. De exacte primaire
            Supabase-projectregio en het gecontracteerde back-upniveau worden
            beheerd in de productieconfiguratie en kunnen op verzoek worden
            bevestigd.
          </p>
        </section>

        <section aria-labelledby="bewaren">
          <h2 id="bewaren">6. Hoe lang bewaren wij gegevens?</h2>
          <p>
            Wij bewaren persoonsgegevens niet langer dan nodig voor het doel,
            de uitvoering van de overeenkomst, beveiliging, een geschil of een
            wettelijke verplichting. Waar nog geen automatische verwijderjob
            bestaat, beoordelen en verwijderen of anonimiseren wij gegevens bij
            een geverifieerd verzoek. De huidige technische uitgangspunten zijn:
          </p>
          <div className="legal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Categorie</th>
                  <th>Huidige bewaarmethode of criterium</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Accounts en organisaties</td>
                  <td>
                    Zolang toegang of dienstverlening nodig is; daarna tot
                    beëindiging en een geverifieerd verwijderverzoek zijn
                    afgehandeld, met langere bewaring waar wet, beveiliging of
                    rechtsvorderingen dat vereisen.
                  </td>
                </tr>
                <tr>
                  <td>Openstaande pairing</td>
                  <td>
                    De code verloopt na 10 minuten. Niet-geclaimde, verlopen of
                    geannuleerde sessies komen vanaf 15 minuten in aanmerking
                    voor opruiming bij een volgende pairingactie. Begrensde
                    rate-limitpogingen worden na één dag opgeruimd.
                  </td>
                </tr>
                <tr>
                  <td>Gekoppelde Players en schermen</td>
                  <td>
                    Zolang het scherm actief is. Verwijderen deactiveert en
                    anonimiseert de mutable schermregistratie, maar
                    beveiligings-, device-, audit- en releasehistorie kan
                    behouden blijven zolang die operationeel of juridisch nodig
                    is.
                  </td>
                </tr>
                <tr>
                  <td>Media en playlists</td>
                  <td>
                    Zolang de klant die gebruikt. Verwijderen is momenteel eerst
                    logisch; gepubliceerde releases blijven onveranderlijk en
                    kunnen metadata of verwijzingen behouden. Een verzoek om
                    fysieke verwijdering wordt daarom afzonderlijk beoordeeld en
                    uitgevoerd.
                  </td>
                </tr>
                <tr>
                  <td>Heartbeats, synchronisatie, audit en diagnostiek</td>
                  <td>
                    Zolang nodig voor schermbeheer, beveiliging, support en
                    bewijs. Er geldt nog geen algemeen technisch afgedwongen
                    kalendertermijn voor alle bestaande tabellen.
                  </td>
                </tr>
                <tr>
                  <td>Serverlogs</td>
                  <td>
                    Applicatiecontainerlogs worden op opslagomvang geroteerd.
                    Bewaring kan langer zijn wanneer een incident of wettelijke
                    aanspraak onderzoek vereist.
                  </td>
                </tr>
                <tr>
                  <td>Supportcorrespondentie</td>
                  <td>
                    Zolang nodig voor beantwoording, opvolging, beveiliging,
                    administratie en mogelijke rechtsvorderingen; er is nog geen
                    vaste automatische 24-maandentermijn.
                  </td>
                </tr>
                <tr>
                  <td>Back-ups</td>
                  <td>
                    Databaseback-ups volgen het actuele Supabase-abonnement en
                    kunnen verwijderde records bewaren tot de betreffende
                    back-up vervalt. Supabase-databaseback-ups bevatten geen
                    opgeslagen mediaobjecten.
                  </td>
                </tr>
                <tr>
                  <td>Fiscale administratie</td>
                  <td>
                    Voor zover van toepassing volgens de wettelijke fiscale
                    bewaarplicht, doorgaans zeven jaar voor basisgegevens.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Een verwijderverzoek en de praktische gevolgen staan op{" "}
            <a href="/data-verwijderen">veyocast.nl/data-verwijderen</a>.
          </p>
        </section>

        <section aria-labelledby="beveiliging">
          <h2 id="beveiliging">7. Hoe beveiligen wij gegevens?</h2>
          <p>
            Afhankelijk van het onderdeel gebruikt VeyoCast HTTPS/TLS,
            rolgebaseerde toegang, multi-tenant Row Level Security,
            intrekbare devicesessies, hashing van pairingcodes en device-tokens,
            private mediaopslag, beperkte serviceaccountrechten, auditregistratie,
            gescheiden omgevingen en herstelprocedures. De Android-app
            weigert certificaatfouten, mixed content, bestandstoegang en
            willekeurige externe navigatie.
          </p>
          <p>
            Geen enkel systeem is volledig risicovrij. Wij onderzoeken
            incidenten en informeren betrokkenen en toezichthouders wanneer dat
            wettelijk vereist is.
          </p>
        </section>

        <section aria-labelledby="rechten">
          <h2 id="rechten">8. Uw privacyrechten</h2>
          <p>Afhankelijk van uw situatie kunt u verzoeken om:</p>
          <ul>
            <li>inzage, correctie of verwijdering;</li>
            <li>beperking van de verwerking of bezwaar;</li>
            <li>overdraagbaarheid van gegevens;</li>
            <li>intrekking van toestemming, zonder terugwerkende kracht;</li>
            <li>een klacht bij de Autoriteit Persoonsgegevens.</li>
          </ul>
          <p>
            Stuur uw verzoek naar{" "}
            <a href="mailto:privacy@veyocast.nl">privacy@veyocast.nl</a>. Wij
            vragen alleen aanvullende informatie wanneer dat nodig is om uw
            identiteit en bevoegdheid te controleren. Als een klant
            verwerkingsverantwoordelijke is, sturen wij het verzoek zo nodig
            door of helpen wij die organisatie bij de afhandeling.
          </p>
        </section>

        <section aria-labelledby="contact">
          <h2 id="contact">9. Contact en wijzigingen</h2>
          <p>
            Vragen of klachten kunt u sturen naar{" "}
            <a href="mailto:privacy@veyocast.nl">privacy@veyocast.nl</a>.
            Technische support is bereikbaar via{" "}
            <a href="mailto:support@veyocast.nl">support@veyocast.nl</a>.
          </p>
          <p>
            Wij kunnen deze verklaring aanpassen bij veranderingen in functies,
            infrastructuur, leveranciers, bewaarbeleid of wetgeving. De actuele
            versie en wijzigingsdatum staan altijd op deze pagina. Belangrijke
            wijzigingen kunnen aanvullend via VeyoCast of e-mail worden gemeld.
          </p>
        </section>
      </article>
    </LegalPage>
  );
}
