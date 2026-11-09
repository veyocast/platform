import type { SponsorReport } from "@veyocast/contracts";
import { Button } from "@veyocast/ui";
import { formatTenantDateTime } from "../../../../lib/tenant-time";
import { setSponsorReportGoal } from "./actions";
import { formatSponsorCount, formatSponsorDuration, sponsorReportQuery, type SponsorReportFilter } from "./sponsor-report";
import styles from "./sponsor-hub.module.css";

export function SponsorReportView({ report, filter, canReport, canWrite, invalid }: {
  report: SponsorReport | null; filter: SponsorReportFilter; canReport: boolean; canWrite: boolean; invalid: boolean;
}) {
  if (!canReport) return <section><h2>Afspeelregistratie</h2><p>Je rol heeft geen toegang tot sponsorrapportage of export.</p></section>;
  if (!report) return <section><h2>Afspeelregistratie</h2><p role="alert">{invalid ? "De rapportfilters zijn ongeldig. Kies een geldige campagne, scherm en periode van maximaal tien jaar." : "De rapportage kon niet worden geladen. Bestaande afspeelregistraties blijven behouden. Vernieuw de pagina om opnieuw te proberen."}</p><a className="btn btn-secondary" href="/dashboard/sponsors?report=1#rapporten">Rapportfilters herstellen</a></section>;
  const date = (value: string | null) => value ? formatTenantDateTime(value, report.timezone) : "Nog geen gegevens";
  const next = report.details.at(-1);
  const freshFilter = { ...filter, asOf: null, beforeAt: null, beforeId: null };
  const newQuery = sponsorReportQuery(freshFilter);
  return <section className={styles.report} aria-labelledby="sponsor-report-title">
    <div><h2 id="sponsor-report-title">Afspeelregistratie</h2><p>Door de Player gemelde en geaccepteerde afspeelbeurten en speeltijd. Dit is geen meting van publiek, bereik of volledig afgespeelde uitingen.</p></div>
    <form action="/dashboard/sponsors#rapporten" method="get" className={styles.form}>
      <input type="hidden" name="report" value="1" />
      <div className={styles.formGrid}>
        <label className={styles.field}><span>Campagne</span><select name="reportCampaign" defaultValue={filter.campaignId ?? ""}><option value="">Alle campagnes</option>{report.filterOptions.campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
        <label className={styles.field}><span>Scherm</span><select name="reportScreen" defaultValue={filter.screenId ?? ""}><option value="">Alle schermen</option>{report.filterOptions.screens.map(screen => <option key={screen.id} value={screen.id}>{screen.name}{screen.deleted ? " (verwijderd)" : ""}</option>)}</select></label>
        <label className={styles.field}><span>Van (inclusief)</span><input name="reportFrom" type="date" defaultValue={filter.fromDate} required /></label>
        <label className={styles.field}><span>Tot (exclusief)</span><input name="reportUntil" type="date" defaultValue={filter.untilDate} required /></label>
      </div>
      <div className={styles.actions}><Button type="submit" variant="secondary">Rapport tonen</Button><a className="btn btn-secondary" href={`/api/sponsors/report/export?${sponsorReportQuery(filter, report.asOf)}`}>CSV downloaden</a><a href={`/dashboard/sponsors?${newQuery}#rapporten`}>Nieuwe peildatum</a></div>
    </form>
    <dl className={styles.summary} aria-label="Volledige rapporttotalen"><dt>Geaccepteerde afspeelbeurten</dt><dd data-testid="sponsor-report-count">{formatSponsorCount(report.totals.acceptedEvents)}</dd><dt>Gemelde speeltijd</dt><dd data-testid="sponsor-report-duration">{formatSponsorDuration(report.totals.playedMs)}</dd><dt>QR-scans</dt><dd>Niet beschikbaar</dd></dl>
    <div className={styles.reportNote}>
      <strong>{report.coverage.status === "partial" ? "Onvolledige registratie" : "Volledigheid niet bevestigd"}</strong>
      <p>De totalen omvatten alle bewaarde geaccepteerde events binnen de filters, ontvangen tot {date(report.asOf)} ({report.timezone}). Een laat ontvangen offline event telt volgens de afspeeltijd mee bij een nieuwe peildatum.</p>
      <p>Bewaarde gebeurtenistijden voor deze campagne- en schermselectie: {date(report.coverage.firstEventAt)} tot {date(report.coverage.lastEventAt)}. Laatste ontvangst: {date(report.coverage.lastReceivedAt)}. Buiten deze waarnemingen is registratie niet aangetoond. Er is geen automatische bewaartermijn ingesteld; de toelating van maximaal 30 dagen vertraagde events is geen bewaartermijn.</p>
      {report.coverage.gaps.map((gap, index) => <p key={`${gap.from}:${index}`}>{gap.reason === "retention" ? "Bekend retentiegat" : "Bekend registratiegat"}: {date(gap.from)} tot {date(gap.until)}.</p>)}
      <p>Scherm- en campagnenamen zijn de huidige namen. De planversie bewaart de historische publicatiecontext. Historische schermgroepen en QR-scans zijn niet geregistreerd.</p>
    </div>
    <section aria-labelledby="sponsor-report-goals"><h3 id="sponsor-report-goals">Afspraak voor deze periode</h3><p>Een expliciet afgesproken aantal afspeelbeurten per campagne, voor alle schermen. Rotatiegewicht en schermtoewijzingen zijn geen afspraak.</p>
      {report.goals.length ? <ul className={styles.list}>{report.goals.map(goal => <li key={goal.campaignId}><span>{goal.campaignName}</span><strong>{formatSponsorCount(goal.targetPlays)} afspeelbeurten · alle schermen</strong></li>)}</ul> : <p>Geen afspraak vastgelegd.</p>}
      {canWrite && report.filterOptions.campaigns.length ? <details><summary>Afspraak vastleggen of verwijderen</summary><form action={setSponsorReportGoal} className={styles.form}>
        <input type="hidden" name="reportFrom" value={filter.fromDate} /><input type="hidden" name="reportUntil" value={filter.untilDate} /><input type="hidden" name="reportScreen" value={filter.screenId ?? ""} />
        <label className={styles.field}><span>Campagne voor de afspraak</span><select name="reportCampaign" defaultValue={filter.campaignId ?? report.filterOptions.campaigns[0]!.id}>{report.filterOptions.campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
        <label className={styles.field}><span>Afgesproken afspeelbeurten (leeg verwijdert de afspraak)</span><input name="targetPlays" type="number" min="0" max="9007199254740991" step="1" /></label>
        <Button type="submit" variant="secondary">Afspraak opslaan</Button>
      </form></details> : null}
    </section>
    <section aria-labelledby="sponsor-report-details"><h3 id="sponsor-report-details">Recente afspeelbeurten</h3><p>Nieuwste eerst; maximaal 50 per pagina. De volledige totalen veranderen niet wanneer je bladert.</p>
      {report.details.length ? <div className={styles.tableScroll}><table className="sync-data-table"><thead><tr><th>Campagne</th><th>Scherm</th><th>Speeltijd</th><th>Afgespeeld</th><th>Ontvangen</th><th>Planversie</th></tr></thead><tbody>{report.details.map(event => <tr key={event.eventId}><td data-label="Campagne">{event.campaignName}</td><td data-label="Scherm">{event.screenName}{event.screenDeleted ? " (verwijderd)" : ""}</td><td data-label="Speeltijd">{formatSponsorDuration(String(event.playedMs))}</td><td data-label="Afgespeeld">{date(event.happenedAt)}</td><td data-label="Ontvangen">{date(event.receivedAt)}</td><td data-label="Planversie">{event.planVersion}</td></tr>)}</tbody></table></div> : <p>Geen afspeelbeurten binnen deze filters en peildatum.</p>}
      <nav className={styles.actions} aria-label="Afspeelregistratiepagina’s">{filter.beforeId ? <a href={`/dashboard/sponsors?${sponsorReportQuery(filter, report.asOf)}#rapporten`}>Nieuwste afspeelbeurten</a> : null}{report.hasMore && next ? <a href={`/dashboard/sponsors?${sponsorReportQuery(filter, report.asOf, next)}#rapporten`}>Oudere afspeelbeurten</a> : null}</nav>
    </section>
  </section>;
}
