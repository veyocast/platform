"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import s from "../settings/sites-settings.module.css";

const tabs = [
  { id: "members", label: "Leden" },
  { id: "roles", label: "Rollen & rechten" },
  { id: "activity", label: "Activiteit" }
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

export function TeamTabs({ children, canReadActivity = false }: { children: ReactNode; canReadActivity?: boolean }) {
  const [activeTab, setActiveTab] = useState<TeamTab>("members");
  const [query,setQuery]=useState("");
  const panels=useRef<HTMLDivElement>(null);
  useEffect(()=>{for(const row of panels.current?.querySelectorAll<HTMLTableRowElement>(`[data-team-panel="${activeTab}"] tbody tr`)??[])row.hidden=!row.textContent?.toLocaleLowerCase("nl-NL").includes(query.trim().toLocaleLowerCase("nl-NL"));},[activeTab,query]);
  return (
    <TeamSearchContext.Provider value={{ query, setQuery }}>
    <div className="team-tabs">
      <div aria-label="Teamonderdelen" className="ad-tabs" role="group">
        {tabs.map((tab) => (
          <button
            aria-pressed={activeTab === tab.id}
            disabled={tab.id === "activity" && !canReadActivity}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
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
