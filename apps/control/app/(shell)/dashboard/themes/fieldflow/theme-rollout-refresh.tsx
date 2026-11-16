"use client";

import { useVisibleRouteRefresh } from "../../../../../lib/use-visible-route-refresh";

export function ThemeRolloutRefresh({ active }: { active: boolean }) {
  useVisibleRouteRefresh(active, 3_000);

  return null;
}
