"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function SportlinkSyncRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  const refreshCount = useRef(0);

  useEffect(() => {
    if (!active) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (refreshCount.current >= 18) {
        window.clearInterval(timer);
        return;
      }
      refreshCount.current += 1;
      router.refresh();
    }, 10_000);

    return () => window.clearInterval(timer);
  }, [active, router]);

  return null;
}
