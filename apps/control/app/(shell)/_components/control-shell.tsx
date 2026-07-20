"use client";

import { hasCapability } from "@veyocast/auth";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronDown,
  FileImage,
  LayoutDashboard,
  ListVideo,
  LoaderCircle,
  Menu,
  MonitorSmartphone,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
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
import type { ControlSearchResult } from "../../../lib/control-search";
import { switchTenantContext } from "../context/actions";

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
  Platformgebruikers: Users,
  Playlists: ListVideo,
  Releases: PackageCheck,
  Schermen: MonitorSmartphone,
  Team: Users,
  Tenants: Building2
};
const sidebarStorageKey = "veyocast-control-sidebar-collapsed";
const previousSidebarStorageKey = `${String.fromCharCode(99, 97, 115, 116, 105, 118, 111)}-control-sidebar-collapsed`;

export function ControlShell({
  children,
  navigationGroups,
  session
}: ControlShellProps) {
  const pathname = usePathname();
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [resourceResults, setResourceResults] = useState<ControlSearchResult[]>([]);
  const [isResourceSearchPending, setResourceSearchPending] = useState(false);

  useEffect(() => {
    const currentPreference = window.localStorage.getItem(sidebarStorageKey);
    const previousPreference = window.localStorage.getItem(previousSidebarStorageKey);
    if (currentPreference === null && previousPreference !== null) {
      window.localStorage.setItem(sidebarStorageKey, previousPreference);
    }
    if (previousPreference !== null) {
      window.localStorage.removeItem(previousSidebarStorageKey);
    }
    setSidebarCollapsed(
      (currentPreference ?? previousPreference) === "true"
    );

    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }

      if (event.key === "Escape") {
        setMobileNavOpen(false);
        setSearchOpen(false);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!isSearchOpen || !session.isLive || query.length < 2) {
      setResourceResults([]);
      setResourceSearchPending(false);
      return;
    }

    const controller = new AbortController();
    setResourceResults([]);
    const timeout = window.setTimeout(async () => {
      setResourceSearchPending(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const body = (await response.json()) as { results?: ControlSearchResult[] };
        setResourceResults(response.ok && Array.isArray(body.results) ? body.results : []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setResourceResults([]);
      } finally {
        if (!controller.signal.aborted) setResourceSearchPending(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [isSearchOpen, searchQuery, session.isLive]);

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
      window.localStorage.setItem(sidebarStorageKey, String(next));
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
        id="control-sidebar-navigation"
      >
        <div className="control-sidebar__top">
          <div className="control-brand">
            <Image
              alt="VeyoCast"
              className="control-brand__icon"
              height={28}
              priority
              src="/brand/veyocast-icon-primary.svg"
              width={28}
            />
            <div className="control-brand__wordmark">
              <Image
                alt="VeyoCast"
                className="control-brand__logo"
                height={28}
                priority
                src="/brand/veyocast-logo-primary.svg"
                width={120}
              />
              <p className="control-brand__meta">Control</p>
            </div>
            <button
              aria-controls="control-sidebar-navigation"
              aria-expanded={!isSidebarCollapsed}
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

          <details className="tenant-switcher">
            <summary
              aria-label={isSidebarCollapsed ? `Actieve context: ${session.tenant}` : undefined}
              title={isSidebarCollapsed ? session.tenant : undefined}
            >
              <span className="tenant-switcher__mark" aria-hidden="true">
                {session.tenant.slice(0, 1)}
              </span>
              <span className="tenant-switcher__copy">
                <span className="tenant-switcher__label">
                  {session.tenantId || !session.isLive ? "Actieve vereniging" : "Platformcontext"}
                </span>
                <span className="tenant-switcher__value">{session.tenant}</span>
              </span>
              <ChevronDown aria-hidden="true" className="tenant-switcher__chevron" />
            </summary>
            <div
              aria-label="Werkcontext wisselen"
              className="tenant-switcher__menu"
              role="group"
            >
              {session.tenantMemberships.map((membership) => (
                <form action={switchTenantContext} key={membership.id}>
                  <input name="tenantSlug" type="hidden" value={membership.slug} />
                  <input name="returnTo" type="hidden" value={pathname} />
                  <button
                    aria-current={membership.id === session.tenantId ? "true" : undefined}
                    disabled={membership.status === "archived"}
                    type="submit"
                  >
                    <span>{membership.name}</span>
                    <small>{tenantStatusLabel[membership.status]}</small>
                  </button>
                </form>
              ))}
              {hasCapability(session.roles, "platform.system.read") ? (
                <form action={switchTenantContext}>
                  <input name="tenantSlug" type="hidden" value="" />
                  <button type="submit">
                    <span>VeyoCast platform</span>
                    <small>Platformcontext</small>
                  </button>
                </form>
              ) : null}
              <Link href="/context" onClick={() => setMobileNavOpen(false)}>
                Alle contexten beheren
              </Link>
            </div>
          </details>
        </div>

        <nav className="control-nav" aria-label="Hoofdnavigatie">
          {navigationGroups.map((group, index) => (
            <section
              aria-labelledby={`control-nav-${group.id}`}
              className="control-nav__group"
              data-scope={group.scope}
              key={group.id}
            >
              {index === 0 || navigationGroups[index - 1]?.scope !== group.scope ? (
                <div className="control-nav__context">
                  <span>{group.contextLabel}</span>
                  <small>{group.description}</small>
                </div>
              ) : null}
              <h2 className="control-nav__heading" id={`control-nav-${group.id}`}>
                {group.title}
              </h2>
              <ul className="control-nav__list">
                {group.items.map((item) => {
                  const Icon = navigationIcons[item.label] ?? LayoutDashboard;
                  const active = isActive(pathname, item);

                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={active ? "page" : undefined}
                        aria-label={isSidebarCollapsed ? item.label : undefined}
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
              <p className="topbar-context__scope">
                {session.tenantId || !session.isLive ? "Vereniging" : "Platform"}
              </p>
              <p className="topbar-context__label">
                {session.tenantId || !session.isLive ? session.tenant : session.organization}
              </p>
              <p className="topbar-context__status">
                <span className="status-dot status-dot--success" aria-hidden="true" />
                {session.isLive
                  ? session.tenantStatus === "paused"
                    ? "Vereniging gepauzeerd · alleen lezen"
                    : `Beveiligde sessie · ${session.assuranceLevel.toUpperCase()}`
                  : "Lokale demomodus"}
              </p>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              aria-label="Snel naar een onderdeel"
              aria-haspopup="dialog"
              aria-keyshortcuts="Control+K Meta+K"
              className="command-search"
              onClick={() => setSearchOpen(true)}
              type="button"
            >
              <Search aria-hidden="true" />
              <span>Snel naar</span>
              <kbd>Ctrl K</kbd>
            </button>
            {session.isLive ? <Link
              aria-label="Accountbeveiliging openen"
              className="icon-button topbar-help"
              href="/auth/mfa"
              title="Accountbeveiliging"
            >
              <ShieldCheck aria-hidden="true" />
            </Link> : null}
          </div>
        </header>
        <div className="control-content" id="control-content" tabIndex={-1}>
          {children}
        </div>
      </main>

      {isSearchOpen ? (
        <div className="command-palette-backdrop" role="presentation">
          <section aria-label="Snel naar een onderdeel" aria-modal="true" className="command-palette" role="dialog">
            <div className="command-palette__search">
              <Search aria-hidden="true" />
              <input
                autoFocus
                aria-label="Zoek navigatie en resources"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Zoek schermen, media, playlists of releases"
                type="search"
                value={searchQuery}
              />
              <button
                aria-label="Snel naar sluiten"
                className="icon-button"
                onClick={() => setSearchOpen(false)}
                title="Snel naar sluiten"
                type="button"
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="command-palette__results">
              <p className="command-palette__group-label">Navigatie</p>
              {searchResults.length > 0 ? searchResults.map((item) => {
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
                }) : <p className="command-palette__empty">Geen passend onderdeel.</p>}
              {searchQuery.trim().length >= 2 && session.isLive ? (
                <>
                  <p className="command-palette__group-label">Resources in {session.tenantId ? session.tenant : "het platform"}</p>
                  {isResourceSearchPending ? (
                    <p className="command-palette__loading" role="status"><LoaderCircle aria-hidden="true" /> Zoeken…</p>
                  ) : resourceResults.length ? resourceResults.map((result) => (
                    <Link
                      className="command-result"
                      href={result.href}
                      key={result.id}
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <Search aria-hidden="true" />
                      <span><strong>{result.label}</strong><small>{resourceKindLabel[result.kind]} · {result.description}</small></span>
                    </Link>
                  )) : <p className="command-palette__empty">Geen toegankelijke resources gevonden.</p>}
                </>
              ) : null}
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

const tenantStatusLabel = {
  active: "Actief",
  archived: "Gearchiveerd",
  paused: "Gepauzeerd · alleen lezen"
} as const;

const resourceKindLabel: Record<ControlSearchResult["kind"], string> = {
  media: "Media",
  playlist: "Playlist",
  release: "Release",
  screen: "Scherm",
  tenant: "Vereniging"
};
