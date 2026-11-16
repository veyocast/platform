"use client";

import { useVisibleRouteRefresh } from "../../../../../lib/use-visible-route-refresh";

const onboardingRefreshIntervalMs = 3_000;

export function OnboardingStatusRefresh() {
  useVisibleRouteRefresh(true, onboardingRefreshIntervalMs);

  return null;
}
