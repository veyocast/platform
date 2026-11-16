"use client";

import { useVisibleRouteRefresh } from "../../../../../lib/use-visible-route-refresh";

export function AutomationProgressRefresh({ active }: { active: boolean }) {
  useVisibleRouteRefresh(active, 5_000);
  return null;
}
