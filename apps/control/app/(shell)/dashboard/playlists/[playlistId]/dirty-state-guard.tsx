"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function DirtyStateGuard({
  children,
  toolbar
}: {
  children: ReactNode;
  toolbar?: ReactNode;
}) {
  const [dirty, setDirty] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    const followLink = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented || event.button !== 0) return;
      const target = event.target;
      const anchor = target instanceof Element ? target.closest("a[href]") : null;
      if (!anchor || anchor.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("Je hebt niet-opgeslagen formulierwijzigingen. Wil je Playlist Studio verlaten?")) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", followLink, true);
    };
  }, [dirty]);

  return (
    <div
      onChangeCapture={(event) => {
        if (event.target instanceof HTMLInputElement && event.target.type === "hidden") return;
        if (event.target instanceof Element && event.target.closest("[data-ignore-dirty]")) return;
        setDirty(true);
      }}
      onSubmitCapture={() => setDirty(false)}
      ref={rootRef}
    >
      <div className="playlist-studio-toolbar">
        <p aria-live="polite" className="playlist-save-state" data-dirty={dirty || undefined}>
          {dirty ? "Niet opgeslagen" : "Opgeslagen"}
        </p>
        {toolbar ? <div className="playlist-studio-toolbar__actions">{toolbar}</div> : null}
      </div>
      {children}
    </div>
  );
}
