"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  ChevronDown,
  CircleHelp,
  FileImage,
  LayoutDashboard,
  ListVideo,
  Menu,
  MonitorSmartphone,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type {
  ControlNavigationGroup,
  ControlNavigationItem,
  ControlSession
} from "../_lib/control-navigation";

type ControlShellProps = {
  children: ReactNode;
  navigationGroups: ControlNavigationGroup[];
  session: ControlSession;
};

const navigationIcons: Record<string, LucideIcon> = {
  Auditlog: ShieldCheck,
  Dashboard: LayoutDashboard,
  Instellingen: Settings2,
  Media: FileImage,
  Platform: MonitorSmartphone,
  Pilotflow: Rocket,
  Playlists: ListVideo,
  Schermen: MonitorSmartphone,
  Team: Users,
  Tenants: Building2
};

export function ControlShell({
  children,
  navigationGroups,
  session
}: ControlShellProps) {
  const pathname = usePathname();
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setSidebarCollapsed(
      window.localStorage.getItem("castivo-control-sidebar-collapsed") === "true"
    );

    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }

      if (event.key === "Escape") {
        setMobileNavOpen(false);
        setNotificationsOpen(false);
        setSearchOpen(false);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("nl-NL");
    const items = navigationGroups.flatMap((group) => group.items);

    return query.length === 0
      ? items
      : items.filter((item) =>
          `${item.label} ${item.description}`.toLocaleLowerCase("nl-NL").includes(query)
        );
  }, [navigationGroups, searchQuery]);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("castivo-control-sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <div
      className={`control-shell${isSidebarCollapsed ? " control-shell--collapsed" : ""}`}
    >
      <a className="skip-link" href="#control-content">
        Naar inhoud
      </a>
      <button
        aria-label="Navigatie sluiten"
        className={`control-nav-backdrop${isMobileNavOpen ? " control-nav-backdrop--visible" : ""}`}
        onClick={() => setMobileNavOpen(false)}
        type="button"
      />
      <aside
        aria-label="Control navigatie"
        className={`control-sidebar${isMobileNavOpen ? " control-sidebar--open" : ""}`}
      >
        <div className="control-sidebar__top">
          <div className="control-brand">
            <Image
              alt="Castivo"
              className="control-brand__icon"
              height={28}
              priority
              src="/brand/castivo-official-icon.png"
              width={28}
            />
            <div className="control-brand__wordmark">
              <p className="control-brand__title">Castivo</p>
              <p className="control-brand__meta">Control</p>
            </div>
            <button
              aria-label={isSidebarCollapsed ? "Navigatie uitklappen" : "Navigatie inklappen"}
              className="icon-button control-sidebar__collapse"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Navigatie uitklappen" : "Navigatie inklappen"}
              type="button"
            >
              {isSidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            </button>
            <button
              aria-label="Navigatie sluiten"
              className="icon-button control-sidebar__close"
              onClick={() => setMobileNavOpen(false)}
              title="Navigatie sluiten"
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <button className="tenant-switcher" type="button">
            <span className="tenant-switcher__mark" aria-hidden="true">
              {session.tenant.slice(0, 1)}
            </span>
            <span className="tenant-switcher__copy">
              <span className="tenant-switcher__label">Actieve vereniging</span>
              <span className="tenant-switcher__value">{session.tenant}</span>
            </span>
            <ChevronDown aria-hidden="true" className="tenant-switcher__chevron" />
          </button>
        </div>

        <nav className="control-nav" aria-label="Hoofdnavigatie">
          {navigationGroups.map((group) => (
            <section className="control-nav__group" key={group.scope}>
              <h2 className="control-nav__heading">{group.title}</h2>
              <ul className="control-nav__list">
                {group.items.map((item) => {
                  const Icon = navigationIcons[item.label] ?? LayoutDashboard;
                  const active = isActive(pathname, item);

                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={active ? "page" : undefined}
                        className="control-nav__link"
                        href={item.href}
                        onClick={() => setMobileNavOpen(false)}
                        title={isSidebarCollapsed ? item.label : undefined}
                      >
                        <Icon aria-hidden="true" className="control-nav__icon" />
                        <span className="control-nav__copy">
                          <span className="control-nav__label">{item.label}</span>
                          <span className="control-nav__description">{item.description}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        <div className="control-user">
          <div className="control-user__avatar" aria-hidden="true">
            {initials(session.userName)}
          </div>
          <div className="control-user__copy">
            <p className="control-user__name">{session.userName}</p>
            <p className="control-user__meta">
              {session.roles[0] ? roleLabel[session.roles[0]] : "Geen rol toegewezen"}
            </p>
          </div>
          <Link
            aria-label="Sessie wisselen"
            className="icon-button"
            href="/login"
            title="Sessie wisselen"
          >
            <ChevronDown aria-hidden="true" />
          </Link>
        </div>
      </aside>

      <main className="control-main">
        <header className="control-topbar" aria-label="Control status">
          <div className="topbar-context">
            <button
              aria-label="Navigatie openen"
              className="icon-button control-menu-trigger"
              onClick={() => setMobileNavOpen(true)}
              title="Navigatie openen"
              type="button"
            >
              <Menu aria-hidden="true" />
            </button>
            <div>
              <p className="topbar-context__label">{session.organization}</p>
              <p className="topbar-context__status">
                <span className="status-dot status-dot--success" aria-hidden="true" />
                Alle systemen operationeel
              </p>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              aria-label="Zoeken in Control"
              aria-haspopup="dialog"
              aria-keyshortcuts="Control+K Meta+K"
              className="command-search"
              onClick={() => setSearchOpen(true)}
              type="button"
            >
              <Search aria-hidden="true" />
              <span>Zoeken in Control</span>
              <kbd>Ctrl K</kbd>
            </button>
            <div className="notification-control">
              <button
                aria-expanded={isNotificationsOpen}
                aria-label="Open actiepunten"
                className="icon-button icon-button--badge"
                onClick={() => setNotificationsOpen((current) => !current)}
                title="Open actiepunten"
                type="button"
              >
                <Bell aria-hidden="true" />
                <span className="icon-button__badge">3</span>
              </button>
              {isNotificationsOpen ? (
                <section className="notification-popover" aria-label="Actiepunten">
                  <p className="notification-popover__title">Actiepunten</p>
                  <ul>
                    <li>1 publicatie wacht op media.</li>
                    <li>1 scherm heeft aandacht nodig.</li>
                    <li>1 uitnodiging verloopt vandaag.</li>
                  </ul>
                </section>
              ) : null}
            </div>
            <button
              aria-label="Hulp openen"
              className="icon-button topbar-help"
              title="Hulp openen"
              type="button"
            >
              <CircleHelp aria-hidden="true" />
            </button>
            <Link
              aria-label="Nieuwe playlist"
              className="button-link button-link--primary topbar-primary-action"
              href="/dashboard/playlists"
              title="Nieuwe playlist"
            >
              <Plus aria-hidden="true" />
              <span>Nieuwe playlist</span>
            </Link>
          </div>
        </header>
        <div className="control-content" id="control-content" tabIndex={-1}>
          {children}
        </div>
      </main>

      {isSearchOpen ? (
        <div className="command-palette-backdrop" role="presentation">
          <section aria-label="Zoeken in Control" aria-modal="true" className="command-palette" role="dialog">
            <div className="command-palette__search">
              <Search aria-hidden="true" />
              <input
                autoFocus
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Zoek schermen, playlists, media of instellingen"
                type="search"
                value={searchQuery}
              />
              <button
                aria-label="Zoeken sluiten"
                className="icon-button"
                onClick={() => setSearchOpen(false)}
                title="Zoeken sluiten"
                type="button"
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="command-palette__results">
              {searchResults.length > 0 ? (
                searchResults.map((item) => {
                  const Icon = navigationIcons[item.label] ?? LayoutDashboard;
                  return (
                    <Link
                      className="command-result"
                      href={item.href}
                      key={item.href}
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <Icon aria-hidden="true" />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </Link>
                  );
                })
              ) : (
                <p className="command-palette__empty">Geen resultaten gevonden.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function isActive(pathname: string, item: ControlNavigationItem) {
  if (item.href === "/dashboard" || item.href === "/platform") {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join("");
}

const roleLabel = {
  platform_owner: "Platformeigenaar",
  platform_admin: "Platformbeheerder",
  platform_support: "Platformsupport",
  platform_viewer: "Platformkijker",
  tenant_owner: "Eigenaar",
  tenant_admin: "Beheerder",
  tenant_editor: "Editor",
  tenant_viewer: "Kijker"
} satisfies Record<ControlSession["roles"][number], string>;
