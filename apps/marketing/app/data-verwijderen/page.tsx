import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "../_components/legal-page";
import { isPublicIndexEnvironment } from "../_lib/site-config";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://veyocast.nl/data-verwijderen"
  },
  description:
    "Zo vraagt u verwijdering van een VeyoCast-account, organisatiegegevens of lokale Android Player-data aan.",
  openGraph: {
    description:
      "Stappen voor het verwijderen van een VeyoCast-account, organisatiegegevens en Player-data.",
    locale: "nl_NL",
    title: "Data verwijderen | VeyoCast",
    type: "article",
    url: "https://veyocast.nl/data-verwijderen"
  },
  robots: {
    follow: isPublicIndexEnvironment(),
    index: isPublicIndexEnvironment()
  },
  title: "Data verwijderen | VeyoCast"
};

export default function DataRemovalPage() {
  return (
    <LegalPage
      description="Op deze pagina vraagt u verwijdering van een account of gegevens aan en leest u hoe u een Player ontkoppelt en lokale appdata wist."
      eyebrow="Privacyverzoek"
      title="Data verwijderen"
      updated="23 juli 2026"
    >
      <article className="legal-article legal-article--single">
        <section aria-labelledby="request">
          <h2 id="request">Een verzoek indienen</h2>
          <p>
            Stuur een e-mail naar{" "}
            <a
              href="mailto:privacy@veyocast.nl?subject=Verzoek%20data%20verwijderen"
            >
              privacy@veyocast.nl
            </a>{" "}
            met als onderwerp <strong>Verzoek data verwijderen</strong>.
          </p>
          <p>Vermeld alleen wat nodig is om uw verzoek te vinden en beoordelen:</p>
          <ul>
            <li>het e-mailadres van uw VeyoCast-account;</li>
            <li>de naam van de betreffende organisatie of vereniging;</li>
            <li>of het gaat om uw account, een tenant, een scherm of andere data;</li>
            <li>welke gegevens u wilt laten verwijderen.</li>
          </ul>
          <p>
            Stuur geen wachtwoord, pairingcode, device-token, kopie van een
            identiteitsbewijs of andere gevoelige gegevens mee tenzij wij later
            gemotiveerd en via een passende route om aanvullende verificatie
            vragen.
          </p>
          <a
            className="button button--primary legal-primary-action"
            href="mailto:privacy@veyocast.nl?subject=Verzoek%20data%20verwijderen"
          >
            Verwijderverzoek e-mailen
          </a>
        </section>

        <section aria-labelledby="account">
          <h2 id="account">Persoonlijk account en tenantaccounts</h2>
          <p>
            Een individueel lid kan verwijdering van zijn eigen account en
            profielgegevens vragen. Het verwijderen van een lid verwijdert niet
            automatisch de zakelijke tenant, media of playlists van de
            organisatie.
          </p>
          <p>
            Een verzoek om een volledige tenantomgeving te verwijderen moet
            komen van een bevoegde tenantowner of een aantoonbaar bevoegde
            vertegenwoordiger. Voor uitvoering controleren wij bevoegdheid,
            gevolgen voor andere gebruikers, openstaande administratie en welke
            gegevens DG Webservices namens de organisatie verwerkt. Waar de
            organisatie verwerkingsverantwoordelijke is, kan zij eerst eigen
            export-, communicatie- of wettelijke stappen moeten uitvoeren.
          </p>
          <p>
            Het huidige platform heeft nog geen directe selfserviceknop die een
            volledig account of een volledige tenant fysiek wist. Een
            geverifieerd verzoek wordt daarom gecontroleerd afgehandeld.
          </p>
        </section>

        <section aria-labelledby="unpair">
          <h2 id="unpair">Een Player ontkoppelen</h2>
          <ol>
            <li>Open in VeyoCast Control het betreffende scherm.</li>
            <li>
              Trek de actieve devicesessie in of deactiveer het scherm, zodat de
              Player geen nieuwe content meer ontvangt.
            </li>
            <li>
              Verwijder het gedeactiveerde scherm wanneer ook de zichtbare
              schermregistratie uit de actieve vloot moet verdwijnen.
            </li>
          </ol>
          <p>
            De devicesessie wordt bij een volgende verbinding geweigerd. Een
            Player die volledig offline is kan niet onmiddellijk op afstand
            worden gewist en kan de laatst geldige lokale release blijven
            tonen. Wis daarom ook de lokale appdata als het apparaat wordt
            overgedragen, buiten gebruik gaat of direct leeg moet zijn.
          </p>
        </section>

        <section aria-labelledby="android">
          <h2 id="android">Lokale Android-appdata verwijderen</h2>
          <ol>
            <li>Open <strong>Instellingen</strong> op het Android-apparaat.</li>
            <li>
              Ga naar <strong>Apps</strong> en kies <strong>VeyoCast Player</strong>.
            </li>
            <li>
              Open <strong>Opslag en cache</strong> en kies{" "}
              <strong>Opslag wissen</strong> of <strong>Gegevens wissen</strong>.
            </li>
            <li>
              Verwijder de app volledig wanneer deze niet meer op het apparaat
              gebruikt wordt.
            </li>
          </ol>
          <p>
            Hiermee worden de lokale WebView-cookies, localStorage, IndexedDB,
            gecachete media en native appvoorkeuren op dat apparaat verwijderd.
            Dit verwijdert niet automatisch de serverregistratie; ontkoppel de
            Player daarom ook in Control.
          </p>
        </section>

        <section aria-labelledby="exceptions">
          <h2 id="exceptions">Wat kan langer bewaard blijven?</h2>
          <p>
            Wij verwijderen of anonimiseren wat op het verzoek van toepassing is,
            behalve wanneer bewaring nog nodig is voor:
          </p>
          <ul>
            <li>fiscale of andere wettelijke administratie;</li>
            <li>beveiliging, misbruikpreventie of incidentonderzoek;</li>
            <li>het instellen, uitoefenen of onderbouwen van een rechtsvordering;</li>
            <li>
              tenantbrede gegevens waarvoor een andere organisatie
              verwerkingsverantwoordelijke is;
            </li>
            <li>
              onveranderlijke release- of auditregistraties die voor integriteit
              nodig blijven en waar mogelijk worden beperkt of geanonimiseerd;
            </li>
            <li>
              tijdelijke aanwezigheid in bestaande databaseback-ups tot die
              volgens het actuele leverancierplan vervallen.
            </li>
          </ul>
          <p>
            Een logisch verwijderd mediaobject of scherm is niet in alle gevallen
            direct fysiek uit alle historie en opslag verwijderd. Wij beoordelen
            daarom bij ieder verzoek ook gekoppelde objecten, releases en
            back-ups.
          </p>
        </section>

        <section aria-labelledby="process">
          <h2 id="process">Wat kunt u verwachten?</h2>
          <ol>
            <li>Wij bevestigen de ontvangst en bepalen welke rol VeyoCast heeft.</li>
            <li>
              Wij controleren uw identiteit en, bij een tenantverzoek, uw
              bevoegdheid met zo min mogelijk aanvullende gegevens.
            </li>
            <li>
              Wij leggen uit wat wordt verwijderd, beperkt, geanonimiseerd of
              gemotiveerd bewaard.
            </li>
            <li>
              Wij reageren in beginsel binnen één maand na ontvangst. Bij een
              complex verzoek kan de wettelijke termijn met maximaal twee
              maanden worden verlengd; u ontvangt daarvan binnen de eerste maand
              bericht met de reden.
            </li>
          </ol>
          <p>
            Bent u het niet eens met de afhandeling, dan kunt u een klacht
            indienen bij de Autoriteit Persoonsgegevens. Lees ook de volledige{" "}
            <Link href="/privacy">privacyverklaring van VeyoCast</Link>.
          </p>
        </section>
      </article>
    </LegalPage>
  );
}
