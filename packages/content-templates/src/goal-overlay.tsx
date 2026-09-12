"use client";

import React, { useLayoutEffect, useRef } from "react";
import type { GoalOverlayConfiguration, GoalOverlayEvent } from "@veyocast/contracts";
import { goalOverlayCss, renderGoalOverlayDom } from "./goal-overlay-renderer";

/** Same locked DOM renderer is embedded in Static LG; no separate preview layout. */
export function GoalOverlay({ event, configuration, orientation, appearance }: {
  event: GoalOverlayEvent;
  configuration: GoalOverlayConfiguration;
  orientation: "landscape" | "portrait";
  appearance: "light" | "dark";
}) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (root.current) return renderGoalOverlayDom(root.current, configuration, event, orientation, appearance);
  }, [configuration, event, orientation, appearance]);
  return <><style>{goalOverlayCss}</style><div className="vc-goal" data-testid="goal-overlay-2" ref={root} /></>;
}
