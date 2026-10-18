"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity, ArrowUpRight, BadgeCheck, CreditCard, FileImage, FileStack,
  Handshake, Layers3, LifeBuoy, MessageCircle, PackageCheck, Palette, Plug,
  Settings, ShoppingBasket, Users, WandSparkles, X,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@veyocast/ui";
import styles from "./sync-management-dialog.module.css";

export type SyncManagementItem = {
  href: string;
  label: string;
  active: boolean;
};

const labels: Readonly<Record<string, string>> = {
  "Sponsor Hub": "Sponsors", Engage: "Interactie", Team: "Team & rechten", "Thema's": "Thema’s",
};
const icons: Readonly<Record<string, LucideIcon>> = {
  Bronnen: Plug, Producten: ShoppingBasket, "Thema’s": Palette, Sponsors: Handshake,
  Interactie: MessageCircle, "Team & rechten": Users, Support: LifeBuoy,
  Abonnement: CreditCard, Studio: WandSparkles, "Menu Studio": ShoppingBasket,
  Media: FileImage, "Slides & formats": Layers3, "Playlist-sjablonen": FileStack,
  Publicaties: PackageCheck, Activiteit: Activity, Instellingen: Settings, Account: BadgeCheck,
};
const sourceOrder = ["/dashboard/sources", "/dashboard/products", "/dashboard/themes", "/dashboard/sponsors", "/dashboard/engage", "/dashboard/team", "/dashboard/support", "/dashboard/settings/billing"];

/** Presentation only: callers supply the existing capability-filtered items. */
export function SyncManagementDialog({ children, items, open, onOpenChange, onNavigate }: {
  children: ReactNode;
  items: readonly SyncManagementItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
}) {
  const orderedItems = [
    ...sourceOrder.flatMap(href => items.filter(item => item.href === href)),
    ...items.filter(item => !sourceOrder.includes(item.href)),
  ];
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger asChild>{children}</DialogTrigger>
    <DialogContent size="wide" showClose={false} className={styles.dialog}>
      <header className={styles.header}>
        <DialogTitle className={styles.title}>Beheer je werkplek</DialogTitle>
        <DialogClose className={`icon-button ${styles.close}`} aria-label="Sluiten"><X size={18} /></DialogClose>
      </header>
      <DialogBody className={styles.body}>
        <DialogDescription className={styles.description}>Onderdelen die je met je huidige rol kunt openen.</DialogDescription>
        <nav className={`management-grid ${styles.grid}`} aria-label="Meer beheeronderdelen">
          {orderedItems.map(item => {
            const label = labels[item.label] ?? item.label;
            const Icon = icons[label] ?? Layers3;
            return <Link className={styles.card} aria-current={item.active ? "page" : undefined} href={item.href} key={item.href} onClick={() => { onNavigate(); onOpenChange(false); }}>
              <span className={styles.icon}><Icon size={24} aria-hidden="true" /></span>
              <strong>{label}</strong>
              <ArrowUpRight size={17} aria-hidden="true" className={styles.arrow} />
            </Link>;
          })}
        </nav>
      </DialogBody>
    </DialogContent>
  </Dialog>;
}
