"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

const categories = [
  { id: "clubprofiel", label: "Profiel" },
  { id: "huisstijl", label: "Huisstijl" },
  { id: "tijdzone", label: "Tijd en planning" },
  { id: "afspelen", label: "Afspelen" },
  { id: "schermen", label: "Schermen" },
  { id: "beveiliging", label: "Beveiliging" }
] as const;

type CategoryId = (typeof categories)[number]["id"];

export function SettingsCategoryWorkspace({ children }: { children: ReactNode }) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("clubprofiel");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const requested = window.location.hash.slice(1);
    if (categories.some((category) => category.id === requested)) {
      setActiveCategory(requested as CategoryId);
    }
  }, []);

  function selectCategory(category: CategoryId) {
    setActiveCategory(category);
    window.history.replaceState(null, "", `#${category}`);
  }

  return (
    <div className="settings-category-workspace" data-hydrated={hydrated ? "true" : "false"}>
      <nav aria-label="Instellingencategorieën" className="settings-category-nav">
        {categories.map((category) => (
          <button
            aria-current={activeCategory === category.id ? "page" : undefined}
            key={category.id}
            onClick={() => selectCategory(category.id)}
            type="button"
          >
            {category.label}
          </button>
        ))}
      </nav>
      <label className="settings-category-select">
        <span>Categorie</span>
        <select
          onChange={(event) => selectCategory(event.target.value as CategoryId)}
          value={activeCategory}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.label}</option>
          ))}
        </select>
      </label>
      <div className="settings-category-panels" data-active={activeCategory}>
        {children}
      </div>
    </div>
  );
}
