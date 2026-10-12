"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import s from "../settings/sites-settings.module.css";

const tabs = [
  { id: "members", label: "Teamleden" },
  { id: "invitations", label: "Uitnodigingen" },
  { id: "roles", label: "Rollen en rechten" }
] as const;

type TeamTab = (typeof tabs)[number]["id"];

const TeamSearchContext = createContext<{
  query: string;
  setQuery: (value: string) => void;
} | null>(null);

export function TeamSearch({ panel }: { panel: "members" | "invitations" }) {
  const search = useContext(TeamSearchContext);
  if (!search) {
    throw new Error("TeamSearch must be rendered inside TeamTabs.");
  }

  return (
    <label className={s.search}>
      <Search aria-hidden="true" size={18} />
      <input
        aria-label={panel === "members" ? "Zoek teamleden" : "Zoek uitnodigingen"}
        value={search.query}
        onChange={(event) => search.setQuery(event.target.value)}
        placeholder="Zoek op naam of e-mail"
      />
    </label>
  );
}

export function TeamTabs({ children, memberCount }: { children: ReactNode; memberCount: number }) {
  const [activeTab, setActiveTab] = useState<TeamTab>("members");
  const [query,setQuery]=useState("");
  const panels=useRef<HTMLDivElement>(null);
  useEffect(()=>{for(const row of panels.current?.querySelectorAll<HTMLTableRowElement>(`[data-team-panel="${activeTab}"] tbody tr`)??[])row.hidden=!row.textContent?.toLocaleLowerCase("nl-NL").includes(query.trim().toLocaleLowerCase("nl-NL"));},[activeTab,query]);
  return (
    <TeamSearchContext.Provider value={{ query, setQuery }}>
    <div className="team-tabs">
      <div aria-label="Teamonderdelen" className={s.tabs} role="tablist">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={activeTab===tab.id?s.selected:undefined}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
            {tab.id==="members"?<span>{memberCount}</span>:null}
          </button>
        ))}
      </div>
      <div className="team-tab-panels" data-active={activeTab} ref={panels}>
        {children}
      </div>
    </div>
    </TeamSearchContext.Provider>
  );
}
