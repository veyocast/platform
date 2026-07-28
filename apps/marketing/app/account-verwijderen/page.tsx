import type { Metadata } from "next";

import DataRemovalPage from "../data-verwijderen/page";
import { isPublicIndexEnvironment } from "../_lib/site-config";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://veyocast.nl/account-verwijderen"
  },
  description:
    "Vraag verwijdering van uw VeyoCast-account en persoonsgegevens aan en volg het verzoek veilig op.",
  robots: {
    follow: isPublicIndexEnvironment(),
    index: isPublicIndexEnvironment()
  },
  title: "Account verwijderen | VeyoCast"
};

export default DataRemovalPage;
