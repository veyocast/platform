import { Activity } from "lucide-react";

export default function DashboardLoading() {
  return <div className="ov-page ov-sync">
    <header className="ov-page-header"><div><span className="ov-eyebrow">Jouw werkplek</span><h1>Overzicht</h1><p>De actuele scherm-, publicatie- en bronstatus wordt veilig opgehaald.</p></div></header>
    <section className="ov-panel" aria-busy="true" aria-labelledby="operational-loading-title" data-state="loading">
      <Activity aria-hidden="true" /><h2 id="operational-loading-title">Status wordt geladen</h2>
      <p>Waarden verschijnen pas nadat de tenantgebonden bronnen zijn bevestigd.</p>
    </section>
  </div>;
}
