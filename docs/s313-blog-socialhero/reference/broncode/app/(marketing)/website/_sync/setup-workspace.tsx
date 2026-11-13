"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Preserve the supplied Source chrome's native public navigation. */
import { useRef, useState, type KeyboardEvent } from "react";

import { VenueSetupBuilder } from "../_components/venue-setup-builder";
import { Brand, Icon } from "./ui";
import styles from "./setup-workspace.module.css";

// Source-native public chrome, without loading the unrelated landing sections.
export function SetupWorkspace({ appHref }: { appHref: string }) {
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);

  function closeMenu(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape") return;
    const details = navigation.current?.querySelector<HTMLDetailsElement>("details[open]");
    if (details) {
      details.open = false;
      details.querySelector("summary")?.focus();
    } else if (menu) {
      setMenu(false);
      menuButton.current?.focus();
    }
  }

  return <div className={`mk-site ${styles.workspace}`}>
    <a className="mk-skip" href="#main">Direct naar inhoud</a>
    <header className="mk-header" onKeyDown={closeMenu}>
      <a className="mk-logo" href="/website" aria-label="VeyoCast — home"><Brand /></a>
      <nav id="setup-public-navigation" ref={navigation} className={menu ? "is-open" : ""} aria-label="Publieke hoofdnavigatie">
        <a href="/website/functies/">Platform</a>
        <details className="mk-nav-dropdown">
          <summary>Voor wie<Icon name="ChevronDown" size={14} /></summary>
          <div>
            <a href="/website/oplossingen/sportverenigingen/"><Icon name="Trophy" />Sportverenigingen</a>
            <a href="/website/oplossingen/horeca/"><Icon name="Coffee" />Horeca</a>
            <a href="/website/oplossingen/bedrijven/"><Icon name="Building2" />Bedrijven</a>
          </div>
        </details>
        <a href="/website/koppelingen/">Koppelingen</a>
        <a href="/website/players/">Players</a>
        <a href="/website/narrowcasting/">Narrowcasting</a>
        <a href="/blog">Blog</a>
      </nav>
      <div className="mk-header-actions">
        <a className="mk-login" href={appHref}>Inloggen<Icon name="ArrowUpRight" size={15} /></a>
        <a className="mk-button" href="/website/demo/">Plan een demo<Icon name="ArrowUpRight" size={18} /></a>
        <button ref={menuButton} className="mk-menu-button" aria-label={menu ? "Menu sluiten" : "Menu openen"} aria-expanded={menu} aria-controls="setup-public-navigation" onClick={() => {
          setMenu(!menu);
          if (!menu) requestAnimationFrame(() => navigation.current?.querySelector("a")?.focus());
        }}><Icon name={menu ? "ChevronUp" : "Menu"} size={23} /></button>
      </div>
    </header>
    <main id="main" tabIndex={-1}><VenueSetupBuilder /></main>
    <footer className="mk-footer">
      <div className="mk-footer-top">
        <div><a href="/website" aria-label="VeyoCast — home"><Brand /></a><p>Jouw content. Jouw schermen.<br />Jouw verhaal.</p><span>Narrowcasting, mooi geregeld.</span></div>
        <div><strong>Platform</strong><a href="/website/functies/">Functies</a><a href="/website/koppelingen/">Koppelingen</a><a href="/website/players/">Players</a><a href="/website/narrowcasting/">Wat is narrowcasting?</a></div>
        <div><strong>Voor jouw organisatie</strong><a href="/website/oplossingen/sportverenigingen/">Sportverenigingen</a><a href="/website/oplossingen/horeca/">Horeca</a><a href="/website/oplossingen/bedrijven/">Bedrijven & organisaties</a></div>
        <div><strong>Ontdek VeyoCast</strong><a href={appHref}>Open de werkplek</a><a href="/website/demo/">Plan een demo</a><a href="/blog">Blog</a><a href="/website/demo/#vragen">Veelgestelde vragen</a></div>
      </div>
      <div className="mk-footer-bottom"><span>© {new Date().getFullYear()} VeyoCast · Een product van DG Webservices</span><span>VeyoCast · Narrowcasting</span></div>
    </footer>
  </div>;
}
