import { Activity } from "lucide-react";

import { PageHeader, StatusPill } from "@veyocast/ui";

import styles from "./publisher-overview.module.css";

export default function DashboardLoading() {
  return (
    <>
      <PageHeader
        description="De actuele scherm-, publicatie- en bronstatus wordt veilig opgehaald."
        eyebrow="VeyoCast"
        title="Overzicht"
      />
      <section
        aria-busy="true"
        aria-labelledby="operational-loading-title"
        className={styles.systemPulse}
        data-state="loading"
      >
        <div className={styles.systemPulseHeading}>
          <span className={styles.systemPulseIcon} aria-hidden="true">
            <Activity />
          </span>
          <div>
            <p>Actuele status</p>
            <h2 id="operational-loading-title">Status wordt geladen</h2>
            <span>Waarden verschijnen pas nadat de tenantgebonden bronnen zijn bevestigd.</span>
          </div>
          <StatusPill label="Laden" tone="info" />
        </div>
      </section>
    </>
  );
}
