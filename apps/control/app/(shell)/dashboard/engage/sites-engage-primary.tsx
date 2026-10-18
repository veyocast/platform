"use client";
import { useState } from "react";
import { BarChart3, Pencil, Plus, QrCode, Search, Trophy } from "lucide-react";
import { StatusPill } from "@veyocast/ui";
import { SitesEngageEditor, type SitesEngageSaveAction } from "./sites-engage-editor";
export type SitesEngagePoll = { id: string; publicId: string; title: string; question: string; status: string; revision: number; kind: string; resultVisibility: string; startsAt: string | null; endsAt: string | null; totalVotes: number | null; options: { id: string; label: string; voteCount: number | null }[]; resultsVisible: boolean };
const labels: Record<string, string> = { draft: "Concept", scheduled: "Gepland", live: "Open", closed: "Gesloten", archived: "Gearchiveerd" };
export function SitesEngagePrimary({ polls, enabled, canWrite, saveAction }: { polls: SitesEngagePoll[]; enabled: boolean; canWrite: boolean; saveAction: SitesEngageSaveAction }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SitesEngagePoll | null | undefined>(undefined);
  const visible = polls.filter(poll => `${poll.title} ${poll.question}`.toLocaleLowerCase("nl").includes(query.toLocaleLowerCase("nl")));
  function manage(id: string) { const target = document.getElementById(`engage-campaign-${id}`)?.closest("details"); if (target instanceof HTMLDetailsElement) target.open = true; }
  return <div className="admin-page">
    <header className="section-header"><div><div className="eyebrow">BEHEER / INTERACTIE</div><h1>Laat de club meedoen.</h1><p>Een kleine vraag, een groot clubgevoel. Breng je publiek in beweging.</p></div><div className="header-actions"><button className="btn btn-primary" type="button" disabled={!enabled || !canWrite} onClick={() => setSelected(null)}><Plus size={18} />Nieuwe interactie</button></div></header>
    {!enabled ? <p className="notice notice--warning" role="status">Publieksinteractie is voor deze organisatie nog niet vrijgegeven. Een platformbeheerder kan de tenantfeature activeren.</p> : <>
      <label className="ad-search"><Search size={18} /><input aria-label="Zoek een poll" placeholder="Zoek een poll…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="ad-engage-grid">{visible.map(poll => <article className="card ad-padding stack" key={poll.id}>
        <div className="row between"><span className="ad-square">{poll.kind === "poll" ? <BarChart3 size={18} /> : <Trophy size={18} />}</span><StatusPill label={labels[poll.status] ?? "Status onbekend"} tone={poll.status === "live" ? "success" : poll.status === "scheduled" ? "info" : poll.status === "draft" ? "warning" : "neutral"} /></div><small className="ad-overline">{poll.kind === "poll" ? "CLUBPOLL" : "SPELER VAN DE WEDSTRIJD"}</small><h2>{poll.title}</h2>{poll.question ? <p className="muted">{poll.question}</p> : null}
        <div className="ad-poll-results">{poll.options.map(option => {
          const known = poll.resultsVisible && option.voteCount !== null && poll.totalVotes !== null;
          const percentage = known && poll.totalVotes! > 0 ? Math.min(100, Math.max(0, option.voteCount! / poll.totalVotes! * 100)) : 0;
          return <div key={option.id}><div className="row between"><span>{option.label}</span><strong>{known ? option.voteCount : "—"}</strong></div><div className="ad-progress"><span style={{ width: `${percentage}%` }} /></div></div>;
        })}</div>{!poll.resultsVisible ? <p className="muted">Resultaten worden volgens de zichtbaarheid van deze poll getoond.</p> : null}
        <div className="row between"><span className="muted">{poll.totalVotes === null ? "Aantal stemmen onbekend" : `${poll.totalVotes} stemmen`} · {poll.resultVisibility === "live" ? "Live resultaat" : poll.resultVisibility === "after_vote" ? "Na stemmen" : "Na sluiten"}</span>{canWrite && poll.status === "draft" ? <button className="btn btn-ghost" type="button" onClick={() => setSelected(poll)} aria-label={`${poll.title} bewerken`}><Pencil size={18} />Bewerken</button> : canWrite ? <a className="btn btn-ghost" href={`#engage-campaign-${poll.id}`} onClick={() => manage(poll.id)} aria-label={`${poll.title} beheren`}><Pencil size={18} />Beheren</a> : null}</div>
        <div className="row">{["live", "closed"].includes(poll.status) ? <a className="btn btn-secondary" href={`/engage/${poll.publicId}`}><QrCode size={18} />Stemomgeving</a> : <a className="btn btn-secondary" href={`#engage-campaign-${poll.id}`} onClick={() => manage(poll.id)}>Campagne beheren</a>}</div>
      </article>)}</div>
      {!visible.length ? <div className="empty"><BarChart3 size={36} /><h2>{polls.length ? "Geen polls gevonden" : "Nog geen interacties"}</h2><p>{polls.length ? "Pas je zoekopdracht aan." : "Maak een concept en start het wanneer je vraag klaarstaat."}</p></div> : null}
    </>}
    {selected !== undefined ? <SitesEngageEditor campaign={selected} saveAction={saveAction} onClose={() => setSelected(undefined)} /> : null}
  </div>;
}
