"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import styles from "./led-secondary-sections.module.css";

type Kind = "management" | "editor" | "live-score" | "help";
type Props = {
  navigationKey: string;
  editing: boolean;
  recovering: boolean;
  managementInitiallyOpen: boolean;
  goalOverlay: ReactNode;
  management: ReactNode;
  editor: ReactNode;
  liveScore: ReactNode;
  help: ReactNode;
};

const titles: Record<Kind, string> = {
  management: "Bestaande wedstrijdmomenten",
  editor: "Uitgebreide overlay-editor",
  "live-score": "Live tussenstand als slide",
  help: "Uitleg en clubhuisstijl"
};

function hashKind(hash: string): Kind | null {
  return hash === "#editor" ? "editor" : hash === "#live-score-slide" ? "live-score" : null;
}

export function LedSecondarySections({ navigationKey, editing, recovering, managementInitiallyOpen, goalOverlay, management, editor, liveScore, help }: Props) {
  const [opened, setOpened] = useState<Record<Kind, boolean>>(() => ({
    management: managementInitiallyOpen || recovering,
    editor: editing || recovering,
    "live-score": recovering,
    help: false
  }));
  const nodes = useRef<Partial<Record<Kind, HTMLDetailsElement>>>({});

  useEffect(() => {
    let frame = 0;
    let disposed = false;
    function openRequiredSections() {
      setOpened(current => ({
        management: current.management || managementInitiallyOpen || recovering,
        editor: current.editor || editing || recovering,
        "live-score": current["live-score"] || recovering,
        help: current.help
      }));
    }
    function reveal(hash: string) {
      const kind = hashKind(hash);
      if (!kind || !nodes.current[kind]) return;
      const details = nodes.current[kind];
      details.open = true;
      setOpened(current => current[kind] ? current : { ...current, [kind]: true });
      function scrollToTask() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (disposed || !details.open) return;
          details.querySelector("summary")?.focus({ preventScroll: true });
          details.scrollIntoView({ block: "start" });
        });
      }
      scrollToTask();
      // A late font layout can move the browser's initial fragment position.
      void document.fonts.ready.then(() => { if (!disposed && hash === window.location.hash) scrollToTask(); });
    }
    const onHashChange = () => reveal(window.location.hash);
    function onLinkClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target && target.target !== "_self" || target.hasAttribute("download")) return;
      const url = new URL(target.href, window.location.href);
      if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search) reveal(url.hash);
    }
    openRequiredSections();
    reveal(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    // A second click on an unchanged hash emits no hashchange. Keep the real
    // anchor/navigation intact while revealing its retained task again.
    document.addEventListener("click", onLinkClick, true);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onLinkClick, true);
    };
  }, [navigationKey, editing, recovering, managementInitiallyOpen]);

  const content = { management, editor, "live-score": liveScore, help };
  function section(kind: Kind) {
    if (!content[kind]) return null;
    return <details
      className={styles.section}
      data-led-secondary={kind}
      key={kind}
      onToggle={event => {
        const open = event.currentTarget.open;
        setOpened(current => current[kind] === open ? current : { ...current, [kind]: open });
      }}
      open={opened[kind]}
      ref={node => { if (node) nodes.current[kind] = node; else delete nodes.current[kind]; }}
    >
      <summary className={styles.summary}><span>{titles[kind]}</span><ChevronDown aria-hidden="true" className={styles.chevron} size={16} /></summary>
      <div className={styles.body}>{content[kind]}</div>
    </details>;
  }

  return <div className={styles.root}>
    {editing ? section("editor") : null}
    <div className={styles.goalOverlay}>{goalOverlay}</div>
    {section("management")}
    {!editing ? section("editor") : null}
    {section("live-score")}
    {section("help")}
  </div>;
}
