"use client";

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { watchVisibleRouteRefresh } from './visible-route-refresh';

export function useVisibleRouteRefresh(active: boolean, intervalMs: number) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!active || pending) return;
    return watchVisibleRouteRefresh({ document, window, intervalMs,
      refresh: () => startTransition(() => router.refresh()) });
  }, [active, intervalMs, pending, router]);
}
