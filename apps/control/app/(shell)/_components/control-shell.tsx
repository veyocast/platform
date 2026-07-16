"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function ControlShell({
  children,
  navigationGroups,
  session
}: ControlShellProps) {
  const pathname = usePathname();

  return (
    <div className="control-shell">
      <a className="skip-link" href="#control-content">
        Naar inhoud
      </a>
      <aside className="control-sidebar" aria-label="Control navigatie">
        <div className="control-brand">
          <span className="control-brand__mark" aria-hidden="true">
            C
          </span>
          <div>
            <p className="control-brand__title">Castivo Control</p>
            <p className="control-brand__meta">Beheeromgeving</p>
          </div>
        </div>

        <section className="control-session" aria-label="Actieve sessie">
          <div>
            <p className="control-session__name">{session.userName}</p>
            <p className="control-session__meta">{session.email}</p>
          </div>
          <div>
            <p className="control-session__meta">{session.organization}</p>
            <p className="control-session__meta">Tenant: {session.tenant}</p>
          </div>
          <div className="role-strip" aria-label="Actieve rollen">
            {session.roles.map((role) => (
              <span className="status-pill status-pill--info" key={role}>
                <span className="status-pill__dot" aria-hidden="true" />
                {roleLabel[role]}
              </span>
            ))}
          </div>
        </section>

        <nav className="control-nav" aria-label="Hoofdnavigatie">
          {navigationGroups.map((group) => (
            <section className="control-nav__group" key={group.scope}>
              <h2 className="control-nav__heading">
                {group.title}
                <span>{group.roleLabel}</span>
              </h2>
              <ul className="control-nav__list">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      aria-current={isActive(pathname, item) ? "page" : undefined}
                      className="control-nav__link"
                      href={item.href}
                    >
                      <span className="control-nav__label">{item.label}</span>
                      <span className="control-nav__description">
                        {item.description}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <p className="control-sidebar__footer">
          Navigatie wordt gefilterd op ontwikkelrollen. Server-side sessieclaims
          vervangen deze fixture in de auth-integratietaak.
        </p>
      </aside>

      <main className="control-main">
        <header className="control-topbar" aria-label="Control status">
          <div>
            <p className="control-topbar__title">Operationele cockpit</p>
            <p className="control-session__meta">
              RLS-first shell, geen service-role in de client
            </p>
          </div>
          <div className="topbar-actions">
            <span className="status-pill status-pill--success">
              <span className="status-pill__dot" aria-hidden="true" />
              App shell actief
            </span>
            <Link className="button-link button-link--secondary" href="/login">
              Sessie wisselen
            </Link>
          </div>
        </header>
        <div className="control-content" id="control-content" tabIndex={-1}>
          {children}
        </div>
      </main>
    </div>
  );
}

function isActive(pathname: string, item: ControlNavigationItem) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const roleLabel = {
  platform_admin: "Platformadmin",
  tenant_admin: "Tenantadmin",
  tenant_viewer: "Tenantviewer"
} satisfies Record<ControlSession["roles"][number], string>;
