"use client";

import type { ReactNode } from "react";
import { useState } from "react";

const tabs = [
  { id: "members", label: "Leden" },
  { id: "roles", label: "Rollen" },
  { id: "invitations", label: "Uitnodigingen" }
] as const;

type TeamTab = (typeof tabs)[number]["id"];

export function TeamTabs({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TeamTab>("members");
  return (
    <div className="team-tabs">
      <div aria-label="Teamonderdelen" className="team-tabs__list" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="team-tab-panels" data-active={activeTab}>
        {children}
      </div>
    </div>
  );
}
