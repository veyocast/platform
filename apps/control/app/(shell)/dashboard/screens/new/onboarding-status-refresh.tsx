"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const onboardingRefreshIntervalMs = 3_000;

export function OnboardingStatusRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      router.refresh();
    }, onboardingRefreshIntervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [router]);

  return null;
}
