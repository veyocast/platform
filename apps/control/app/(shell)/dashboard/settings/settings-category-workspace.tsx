"use client";

import { ArrowRight, Building2, ChevronRight, Clock3, CreditCard, Monitor, Palette, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import styles from "./sites-settings.module.css";

const categories = [
  { id: "clubprofiel", label: "Profiel", icon: Building2 },
  { id: "huisstijl", label: "Huisstijl", icon: Palette },
  { id: "tijdzone", label: "Tijd en planning", icon: Clock3 },
  { id: "afspelen", label: "Afspelen", icon: Monitor },
  { id: "schermen", label: "Schermen", icon: Monitor },
  { id: "abonnement", label: "Abonnement & facturatie", icon: CreditCard },
  { id: "beveiliging", label: "Beveiliging", icon: ShieldCheck }
] as const;
type CategoryId = (typeof categories)[number]["id"];
export function SettingsCategoryWorkspace({ children }: { children: ReactNode }) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("clubprofiel");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    const requested = window.location.hash.slice(1);
    if (categories.some((category) => category.id === requested)) setActiveCategory(requested as CategoryId);
  }, []);
  function selectCategory(category: CategoryId) {
    setActiveCategory(category);
    window.history.replaceState(null, "", `#${category}`);
  }
  return <div className={styles.workspace} data-settings-workspace="true" data-hydrated={hydrated ? "true" : "false"}>
    <nav aria-label="Instellingencategorieën" className={styles.categories}>
      {categories.map(({ id, label, icon: Icon }) => <button aria-current={activeCategory === id ? "page" : undefined} className={activeCategory === id ? styles.active : undefined} key={id} onClick={() => selectCategory(id)} type="button"><Icon aria-hidden="true" size={18} />{label}<ChevronRight aria-hidden="true" size={15} /></button>)}
      <div className={styles.related}><span>OOK BEHEREN</span>{[["Team en rollen", "/dashboard/team"], ["Mijn account", "/dashboard/account"], ["Activiteit", "/dashboard/activity"]].map(([label, href]) => <Link href={href!} key={href}>{label}<ArrowRight aria-hidden="true" size={14} /></Link>)}</div>
    </nav>

    <div className={styles.categoryPanels} data-active={activeCategory}>{children}</div>
  </div>;
}
