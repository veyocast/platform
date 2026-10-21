"use client";

import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { GoalOverlay } from "@veyocast/content-templates";
import styles from "./goal-overlay.module.css";

/** Control waits for its own fonts; signage keeps the existing shared renderer. */
export function GoalOverlayPreview(props: ComponentProps<typeof GoalOverlay>) {
  const [phase, setPhase] = useState<"loading" | "fallback" | "ready">("loading");

  useEffect(() => {
    let active = true;
    let frame: number | undefined;
    const deadline = window.setTimeout(() => {
      if (active) setPhase("fallback");
    }, 3000);
    const fonts = document.fonts;
    const loaded = fonts
      ? Promise.allSettled([400, 500, 700, 900].map(weight => fonts.load(`${weight} 16px "Roboto"`))).then(() => fonts.ready)
      : Promise.resolve();
    void loaded.catch(() => undefined).then(() => {
      if (!active) return;
      window.clearTimeout(deadline);
      frame = requestAnimationFrame(() => {
        if (active) setPhase("ready");
      });
    });
    return () => {
      active = false;
      window.clearTimeout(deadline);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className={styles.previewSurface} aria-busy={phase === "loading"}>
      {phase === "loading" ? (
        <div className={styles.previewLoading} role="status">Voorbeeld laden…</div>
      ) : (
        <IsolatedGoalCanvas phase={phase} {...props} />
      )}
    </div>
  );
}

/** Keep operational page selectors outside the unchanged signage canvas. */
function IsolatedGoalCanvas({ phase, ...props }: ComponentProps<typeof GoalOverlay> & { phase: "fallback" | "ready" }) {
  const [shadow, setShadow] = useState<ShadowRoot | null>(null);
  const mount = useCallback((host: HTMLDivElement | null) => {
    if (host) setShadow(host.shadowRoot ?? host.attachShadow({ mode: "open" }));
  }, []);
  return <div className={styles.previewSurface} ref={mount}>{shadow ? createPortal(
    <><style>{":host{display:block;width:100%;height:100%;line-height:var(--vc-vector-line-height-body,1.5)}"}</style><GoalOverlay key={phase} {...props} /></>, shadow
  ) : null}</div>;
}
