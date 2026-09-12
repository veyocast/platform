"use client";

import { hasCapability } from "@veyocast/auth";
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  IconButton,
  StatusDot
} from "@veyocast/ui";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  BadgeCheck,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  FileImage,
  FileStack,
  Layers3,
  Handshake,
  Home,
  LayoutDashboard,
  ListVideo,
  LoaderCircle,
  Menu,
  Monitor,
  MonitorSmartphone,
  MoreHorizontal,
  PackageCheck,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sparkles,
  ServerCog,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  WandSparkles,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type {
  ControlNavigationGroup,
  ControlNavigationItem,
  ControlSession
} from "../_lib/control-navigation";
import {
  getControlRoutePresentation,
  getNavigationGroupsForPathname,
  isImmersiveEditorPath
} from "../_lib/control-navigation";
import type { ControlSearchResult } from "../_lib/control-search-contract";
import { clearTenantScopedLocalData } from "../_lib/tenant-local-data";
import { switchTenantContext } from "../context/actions";
import { signOut } from "../../login/actions";
import {
  ControlThemeBootstrap,
  ControlThemeSwitcher
} from "./control-theme-switcher";
import {
  GlobalUploadTray,
  type GlobalUploadTrayItem
} from "./global-upload-tray";
import { FloatingPanel } from "./floating-panel";

type ControlShellProps = {
  children: ReactNode;
  navigationGroups: ControlNavigationGroup[];
  session: ControlSession;
  uploadQueue: GlobalUploadTrayItem[];
  visualQaEnabled: boolean;
};

const navigationIcons: Record<string, LucideIcon> = {
  Account: BadgeCheck,
  Activiteit: Activity,
  Bronnen: ServerCog,
  Instellingen: Settings,
  Media: FileImage,
  Overzicht: LayoutDashboard,
  Vandaag: Home,
  Platform: MonitorSmartphone,
  Platformgebruikers: Users,
  Planning: CalendarDays,
  Playlists: ListVideo,
  Publicaties: PackageCheck,
  Schermen: Monitor,
  Studio: WandSparkles,
  Systeem: ServerCog,
  Team: Users,
  "Playlist-sjablonen": FileStack,
  Renderformats: FileStack,
  Databronnen: ServerCog,
  "Slides & formats": Layers3,
  "Thema's": Palette,
  "Sponsor Hub": Handshake,
  Engage: Sparkles,
  Klanten: Building2
};
const sidebarStorageKey = "veyocast-control-sidebar-collapsed";
const managementStorageKey = "veyocast-control-management-open";
const previousSidebarStorageKey = `${String.fromCharCode(99, 97, 115, 116, 105, 118, 111)}-control-sidebar-collapsed`;
const mobilePrimaryLabels = [
  "Vandaag",
  "Schermen",
  "Studio",
  "Planning"
] as const;

export function ControlShell({
  children,
  navigationGroups,
  session,
  uploadQueue,
  visualQaEnabled
}: ControlShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isInteractive, setInteractive] = useState(false);
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isManagementOpen, setManagementOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [resourceResults, setResourceResults] = useState<ControlSearchResult[]>([]);
  const [isResourceSearchPending, setResourceSearchPending] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);
  const visibleNavigationGroups = useMemo(
    () =>
      getNavigationGroupsForPathname(
        navigationGroups,
        pathname,
        session.tenantId || !session.isLive ? "tenant" : "platform"
    ),
    [navigationGroups, pathname, session.isLive, session.tenantId]
  );
  const fallbackScope =
    session.tenantId || !session.isLive ? "tenant" : "platform";
  const activeNavigationScope =
    visibleNavigationGroups[0]?.scope ?? fallbackScope;
  const hasTenantNavigationContext = activeNavigationScope === "tenant";
  const activeNavigationItem = useMemo(
    () =>
      visibleNavigationGroups
        .flatMap((group) => group.items)
        .filter((item) => isActive(pathname, item))
        .sort((left, right) => right.href.length - left.href.length)[0],
    [pathname, visibleNavigationGroups]
  );
  const activeContextName = hasTenantNavigationContext
    ? session.tenant
    : session.organization;
  const visualReference = visualQaEnabled && (
    searchParams.get("visual") === "reference" ||
    searchParams.get("visualState") === "healthy"
  );
  const displayContextName = visualReference && hasTenantNavigationContext
    ? "Duindorp SV"
    : activeContextName;
  const displayUserName = visualReference ? "Danny Groen" : session.userName;
  const isImmersiveEditor = isImmersiveEditorPath(pathname);
  const shellOwnsHeading = [
    "/dashboard",
    "/dashboard/planning",
    "/dashboard/playlists",
    "/dashboard/screens",
    "/dashboard/studio"
  ].includes(pathname) || (
    isImmersiveEditor && pathname.startsWith("/dashboard/studio/")
  );
  const tenantSettingsItem = useMemo(
    () => visibleNavigationGroups.flatMap((group) => group.items).find((item) => item.label === "Instellingen"),
    [visibleNavigationGroups]
  );
  const pagePresentation = getControlRoutePresentation(
    pathname,
    activeNavigationItem?.label,
    displayContextName,
    displayUserName
  );
  const topbarStatusTone = visualReference
    ? "success"
    : !session.isLive
    ? "info"
    : hasTenantNavigationContext && session.tenantStatus === "paused"
      ? "warning"
      : "info";

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
    setManagementOpen(
      window.localStorage.getItem(managementStorageKey) === "true"
    );
    setInteractive(true);

    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
        setResourceResults([]);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) return;

    const sidebar = sidebarRef.current;
    const firstFocusable = Array.from(
      sidebar?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])'
      ) ?? []
    ).find((element) => element.offsetParent !== null);
    firstFocusable?.focus();

    function handleDrawerKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileNavOpen(false);
        window.requestAnimationFrame(() =>
          previousFocusedElementRef.current?.focus()
        );
        return;
      }

      if (event.key !== "Tab" || !sidebar) return;
      const focusable = Array.from(
        sidebar.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDrawerKeyDown);
    return () => document.removeEventListener("keydown", handleDrawerKeyDown);
  }, [isMobileNavOpen]);

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
    const items = visibleNavigationGroups.flatMap((group) => group.items);

    return query.length === 0
      ? items
      : items.filter((item) =>
          `${item.label} ${item.description}`.toLocaleLowerCase("nl-NL").includes(query)
        );
  }, [searchQuery, visibleNavigationGroups]);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(sidebarStorageKey, String(next));
      return next;
    });
  }

  function openMobileNavigation() {
    if (!isInteractive) return;
    previousFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setMobileNavOpen(true);
  }

  function closeMobileNavigation(restoreFocus = true) {
    setMobileNavOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => previousFocusedElementRef.current?.focus());
    }
  }

  function handleSearchOpenChange(nextOpen: boolean) {
    setSearchOpen(nextOpen);
    if (!nextOpen) {
      setSearchQuery("");
      setResourceResults([]);
    }
  }

  function toggleManagement() {
    setManagementOpen((current) => {
      const next = !current;
      window.localStorage.setItem(managementStorageKey, String(next));
      return next;
    });
  }

  function navigateFromCommandPalette(href: string) {
    router.push(href);
    setSearchOpen(false);
    setSearchQuery("");
    setResourceResults([]);
  }

  return (
    <Dialog onOpenChange={handleSearchOpenChange} open={isSearchOpen}>
      <ControlThemeBootstrap />
      <div
        className={`control-shell control-shell--motion${isSidebarCollapsed ? " control-shell--collapsed" : ""}`}
        data-fieldflow="v3"
        data-navigation-scope={activeNavigationScope}
        data-route-family={pagePresentation.family}
        data-route-layout={pagePresentation.layout}
        data-shell-heading={shellOwnsHeading ? "true" : "false"}
        data-shell-mode={isImmersiveEditor ? "immersive" : "standard"}
      >
      <a className="skip-link" href="#control-content">
        Naar inhoud
      </a>
      <button
        aria-label="Navigatie sluiten"
        className={`control-nav-backdrop${isMobileNavOpen ? " control-nav-backdrop--visible" : ""}`}
        onClick={() => closeMobileNavigation()}
        type="button"
      />
      <aside
        aria-label="Control navigatie"
        className={`control-sidebar${isMobileNavOpen ? " control-sidebar--open" : ""}`}
        data-scope={activeNavigationScope}
        id="control-sidebar-navigation"
        ref={sidebarRef}
      >
        <div className="control-mobile-menu-header">
          <p className="control-mobile-menu-title">Meer</p>
          <IconButton
            aria-label="Meer-menu sluiten"
            className="control-mobile-sheet-close"
            disabled={!isInteractive}
            onClick={() => closeMobileNavigation()}
            title="Meer-menu sluiten"
          >
            <X aria-hidden="true" />
          </IconButton>
        </div>
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
                className="control-brand__logo control-brand__logo--primary"
                height={28}
                priority
                src="/brand/veyocast-logo-primary.svg"
                width={120}
              />
              <Image
                alt=""
                aria-hidden="true"
                className="control-brand__logo control-brand__logo--inverse"
                height={28}
                priority
                src="/brand/veyocast-logo-monochrome-white.svg"
                width={120}
              />
              <p className="control-brand__meta">
                {hasTenantNavigationContext ? "Fieldflow" : "Control"}
              </p>
            </div>
            <IconButton
              aria-controls="control-sidebar-navigation"
              aria-expanded={!isSidebarCollapsed}
              aria-label={isSidebarCollapsed ? "Navigatie uitklappen" : "Navigatie inklappen"}
              className="control-sidebar__collapse"
              disabled={!isInteractive}
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Navigatie uitklappen" : "Navigatie inklappen"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            </IconButton>
            <IconButton
              aria-label="Navigatie sluiten"
              className="control-sidebar__close"
              disabled={!isInteractive}
              onClick={() => closeMobileNavigation()}
              title="Navigatie sluiten"
            >
              <X aria-hidden="true" />
            </IconButton>
          </div>

          <FloatingPanel
            align="start"
            className="tenant-switcher"
            contentClassName={`tenant-switcher__menu${
              hasTenantNavigationContext ? " tenant-switcher__menu--tenant" : ""
            }`}
            contentLabel="Werkcontext wisselen"
            disabled={!isInteractive}
            role="group"
            trigger={
              <>
              <span className="tenant-switcher__mark" aria-hidden="true">
                {initials(displayContextName)}
              </span>
              <span className="tenant-switcher__copy">
                <span className="tenant-switcher__label">
                  {hasTenantNavigationContext
                    ? "Actieve vereniging"
                    : "Platformcontext"}
                </span>
                <span className="tenant-switcher__value">{displayContextName}</span>
              </span>
              <ChevronDown aria-hidden="true" className="tenant-switcher__chevron" />
              </>
            }
            triggerAriaLabel={`Actieve context: ${displayContextName}`}
            triggerClassName="tenant-switcher__trigger"
            triggerTitle={isSidebarCollapsed ? displayContextName : undefined}
          >
            <>
              {session.tenantMemberships.map((membership) => (
                <form
                  action={switchTenantContext}
                  key={membership.id}
                  onSubmit={() => clearTenantScopedLocalData(window.localStorage)}
                >
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
              {hasCapability(session.capabilities, "platform.system.read") ? (
                <form
                  action={switchTenantContext}
                  onSubmit={() => clearTenantScopedLocalData(window.localStorage)}
                >
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
            </>
          </FloatingPanel>
        </div>

        <nav className="control-navigation-landmark" aria-label="Hoofdnavigatie">
          <div className="control-nav">
          {visibleNavigationGroups.map((group, index, renderedGroups) => (
            <section
              aria-labelledby={`control-nav-${group.id}`}
              className="control-nav__group"
              data-collapsed={
                group.section === "organization" &&
                !isManagementOpen &&
                !group.items.some((item) => isActive(pathname, item))
                  ? "true"
                  : undefined
              }
              data-scope={group.scope}
              key={group.id}
            >
              {index === 0 || renderedGroups[index - 1]?.scope !== group.scope ? (
                <div className="control-nav__context">
                  <span>{group.contextLabel}</span>
                  <small>{group.description}</small>
                </div>
              ) : null}
              <div className="control-nav__group-heading">
                <h2 className="control-nav__heading" id={`control-nav-${group.id}`}>
                  {group.title}
                </h2>
                {group.section === "organization" ? (
                  <button
                    aria-controls={`control-nav-list-${group.id}`}
                    aria-expanded={
                      isManagementOpen ||
                      group.items.some((item) => isActive(pathname, item))
                    }
                    aria-label={`${group.title} ${
                      isManagementOpen ||
                      group.items.some((item) => isActive(pathname, item))
                        ? "inklappen"
                        : "uitklappen"
                    }`}
                    className="control-nav__group-toggle"
                    onClick={toggleManagement}
                    type="button"
                  >
                    <ChevronDown aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <ul
                className="control-nav__list"
                id={`control-nav-list-${group.id}`}
              >
                {group.items.map((item) => {
                  const visibleLabel = item.label === "Vandaag" ? "Overzicht" : item.label;
                  const Icon = navigationIcons[visibleLabel] ?? LayoutDashboard;
                  const active = isActive(pathname, item);

                  return (
                    <li
                      data-mobile-primary={
                        mobilePrimaryLabels.includes(
                          item.label as (typeof mobilePrimaryLabels)[number]
                        )
                          ? "true"
                          : undefined
                      }
                      key={item.href}
                    >
                      <Link
                        aria-current={active ? "page" : undefined}
                        aria-label={isSidebarCollapsed ? visibleLabel : undefined}
                        className="control-nav__link"
                        href={item.href}
                        onClick={() => closeMobileNavigation(false)}
                        title={isSidebarCollapsed ? visibleLabel : undefined}
                      >
                        <Icon aria-hidden="true" className="control-nav__icon" />
                        <span className="control-nav__copy">
                          <span className="control-nav__label">{visibleLabel}</span>
                          <span className="control-nav__description">{item.description}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          </div>
        </nav>

        <div className="control-sidebar__footer">
          {hasTenantNavigationContext && tenantSettingsItem ? (
            <Link
              aria-current={isActive(pathname, tenantSettingsItem) ? "page" : undefined}
              className="control-legal-link control-settings-link"
              href={tenantSettingsItem.href}
            >
              <Settings aria-hidden="true" />
              <span>Instellingen</span>
            </Link>
          ) : null}
          <div className="control-organization-card" aria-label={`Actieve vereniging: ${displayContextName}`}>
            <span className="control-organization-card__mark" aria-hidden="true">
              {initials(displayContextName)}
            </span>
            <span>
              <strong>{displayContextName}</strong>
              <small>{session.tenantRoleLabel ?? "Beheerder"}</small>
            </span>
            <ChevronDown aria-hidden="true" />
          </div>
          <a className="control-legal-link control-website-link" href="https://veyocast.nl">
            <ChevronLeft aria-hidden="true" />
            <span>Terug naar website</span>
          </a>
        </div>
      </aside>

      <main
        className={`control-main${isImmersiveEditor ? " control-main--editor" : ""}`}
      >
        <header className="control-topbar" aria-label="Control status">
          <div className="topbar-context">
            <IconButton
              aria-label="Navigatie openen"
              className="control-menu-trigger"
              disabled={!isInteractive}
              onClick={openMobileNavigation}
              title="Navigatie openen"
            >
              <Menu aria-hidden="true" />
            </IconButton>
            <div className="topbar-context__copy">
              {hasTenantNavigationContext ? <p className="topbar-context__eyebrow">VeyoCast FieldFlow</p> : null}
              {shellOwnsHeading ? (
                <h1>{pagePresentation.title}</h1>
              ) : (
                <p className="topbar-context__title">{pagePresentation.title}</p>
              )}
              <p className="topbar-context__description">{pagePresentation.description}</p>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="control-health-pill" data-tone={topbarStatusTone}>
              <StatusDot status={topbarStatusTone} />
              {visualReference
                ? "Alles werkt"
                : session.isLive
                ? session.tenantStatus === "paused" ? "Alleen lezen" : "Tenant actief"
                : "Demomodus"}
            </span>
            <DialogTrigger asChild>
              <button
                aria-label="Snel naar een onderdeel"
                aria-keyshortcuts="Control+K Meta+K"
                className="command-search"
                disabled={!isInteractive}
                type="button"
              >
                <Search aria-hidden="true" />
                <span>Zoeken</span>
                <kbd>⌘ K</kbd>
              </button>
            </DialogTrigger>
            <IconButton
              asChild
              aria-label="Meldingen openen"
              className="topbar-help"
              title="Meldingen"
            >
              <Link href={hasTenantNavigationContext ? "/dashboard/activity" : "/platform/system"}>
                <Bell aria-hidden="true" />
              </Link>
            </IconButton>
            <AccountMenu
              activeScope={activeNavigationScope}
              displayName={displayUserName}
              displayRole={visualReference ? "Beheerder" : undefined}
              session={session}
              variant="topbar"
            />
          </div>
        </header>
        <div
          className={`control-content${isImmersiveEditor ? " control-content--editor" : ""}`}
          id="control-content"
          tabIndex={-1}
        >
          {children}
        </div>
      </main>
      {hasTenantNavigationContext ? (
        <GlobalUploadTray items={uploadQueue} />
      ) : null}
      {hasTenantNavigationContext ? (
        <MobileBottomNav
          groups={visibleNavigationGroups}
          isInteractive={isInteractive}
          isMoreOpen={isMobileNavOpen}
          onMore={openMobileNavigation}
          pathname={pathname}
        />
      ) : null}

        <DialogContent className="command-palette" showClose={false}>
          <DialogTitle className="vc-visually-hidden">
            Snel naar een onderdeel
          </DialogTitle>
          <DialogDescription className="vc-visually-hidden">
            Zoek binnen toegankelijke navigatie en resources.
          </DialogDescription>
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
              <DialogClose asChild>
                <IconButton
                  aria-label="Snel naar sluiten"
                  title="Snel naar sluiten"
                >
                  <X aria-hidden="true" />
                </IconButton>
              </DialogClose>
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
                      onClick={(event) => {
                        event.preventDefault();
                        navigateFromCommandPalette(item.href);
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
                      onClick={(event) => {
                        event.preventDefault();
                        navigateFromCommandPalette(result.href);
                      }}
                    >
                      <Search aria-hidden="true" />
                      <span><strong>{result.label}</strong><small>{resourceKindLabel[result.kind]} · {result.description}</small></span>
                    </Link>
                  )) : <p className="command-palette__empty">Geen toegankelijke resources gevonden.</p>}
                </>
              ) : null}
            </div>
        </DialogContent>
      </div>
    </Dialog>
  );
}

function AccountMenu({
  activeScope,
  displayName,
  displayRole,
  session,
  variant = "icon"
}: {
  activeScope: "platform" | "tenant";
  displayName?: string;
  displayRole?: string;
  session: ControlSession;
  variant?: "icon" | "topbar";
}) {
  const role = activeScope === "tenant" && session.tenantRoleLabel
    ? session.tenantRoleLabel
    : session.roles[0]
      ? roleLabel[session.roles[0]]
      : "Geen rol toegewezen";
  const triggerName = displayName ?? session.userName;
  const triggerRole = displayRole ?? role;

  return (
    <Dialog>
      <DialogTrigger asChild>
        {variant === "topbar" ? (
          <button aria-label="Accountmenu openen" className="control-account-trigger" type="button">
            <span className="control-user__avatar" aria-hidden="true">
              {initials(triggerName)}
            </span>
            <span className="control-account-trigger__copy">
              <strong>{firstName(triggerName)}</strong>
              <small>{triggerRole}</small>
            </span>
            <ChevronDown aria-hidden="true" />
          </button>
        ) : (
          <IconButton
            aria-label="Accountmenu openen"
            title="Accountmenu openen"
          >
            <ChevronDown aria-hidden="true" />
          </IconButton>
        )}
      </DialogTrigger>
      <DialogContent className="control-account-menu">
        <DialogHeader>
          <div className="control-account-menu__identity">
            <span className="control-user__avatar" aria-hidden="true">
              {initials(session.userName)}
            </span>
            <div>
              <DialogTitle>{session.userName}</DialogTitle>
              <DialogDescription>{session.email}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogBody>
          <nav aria-label="Accountinstellingen" className="control-account-menu__links">
            {activeScope === "tenant" ? (
              <Link href="/dashboard/settings">
                <Settings2 aria-hidden="true" />
                Profiel en instellingen
              </Link>
            ) : null}
            {session.isLive ? (
              <Link href="/auth/mfa">
                <ShieldCheck aria-hidden="true" />
                Accountbeveiliging en MFA
              </Link>
            ) : null}
            <a href="https://veyocast.nl/privacy" rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" />
              Privacyverklaring
            </a>
          </nav>
          <section
            aria-labelledby="account-preferences-title"
            className="control-account-menu__preferences"
          >
            <div>
              <SlidersHorizontal aria-hidden="true" />
              <div>
                <h3 id="account-preferences-title">Weergave</h3>
                <p>Kies thema en informatiedichtheid.</p>
              </div>
            </div>
            <ControlThemeSwitcher />
          </section>
          <p className="control-account-menu__role">
            <BadgeCheck aria-hidden="true" />
            {role}
          </p>
        </DialogBody>
        <DialogFooter>
          <form
            action={signOut}
            onSubmit={() => clearTenantScopedLocalData(window.localStorage)}
          >
            <Button type="submit" variant="destructive">
              Uitloggen
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MobileBottomNav({
  groups,
  isInteractive,
  isMoreOpen,
  onMore,
  pathname
}: {
  groups: readonly ControlNavigationGroup[];
  isInteractive: boolean;
  isMoreOpen: boolean;
  onMore: () => void;
  pathname: string;
}) {
  const items = groups
    .flatMap((group) => group.items)
    .filter((item) =>
      mobilePrimaryLabels.includes(
        item.label as (typeof mobilePrimaryLabels)[number]
      )
    )
    .sort(
      (left, right) =>
        mobilePrimaryLabels.indexOf(
          left.label as (typeof mobilePrimaryLabels)[number]
        ) -
        mobilePrimaryLabels.indexOf(
          right.label as (typeof mobilePrimaryLabels)[number]
        )
    );
  const moreActive =
    isMoreOpen ||
    groups
      .flatMap((group) => group.items)
      .filter(
        (item) =>
          !mobilePrimaryLabels.includes(
            item.label as (typeof mobilePrimaryLabels)[number]
          )
      )
      .some((item) => isActive(pathname, item));

  return (
    <nav
      aria-label="Mobiele hoofdnavigatie"
      className="control-mobile-nav"
    >
      <ul className="control-mobile-nav__list">
        {items.map((item) => {
          const visibleLabel = item.label === "Vandaag" ? "Overzicht" : item.label;
          const Icon = visibleLabel === "Overzicht"
            ? Home
            : navigationIcons[visibleLabel] ?? LayoutDashboard;
          const active = isActive(pathname, item);

          return (
            <li key={item.href}>
              <Link
                aria-current={active ? "page" : undefined}
                className="control-mobile-nav__item"
                href={item.href}
              >
                <Icon aria-hidden="true" />
                <span>{visibleLabel}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            aria-controls="control-sidebar-navigation"
            aria-expanded={isMoreOpen}
            className="control-mobile-nav__item"
            data-active={moreActive ? "true" : undefined}
            disabled={!isInteractive}
            onClick={onMore}
            type="button"
          >
            <MoreHorizontal aria-hidden="true" />
            <span>Meer</span>
          </button>
        </li>
      </ul>
    </nav>
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

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "beheerder";
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
