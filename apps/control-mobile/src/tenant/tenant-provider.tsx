import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MobileSession } from "@veyocast/contracts";

import { mobileApi } from "../api/mobile-api";
import { useAuth } from "../auth/auth-provider";
import { selectedTenantStorage } from "../auth/secure-storage";
import { clearTenantCache } from "../storage/tenant-cache";

type MobileTenant = MobileSession["tenants"][number];

type TenantContextValue = {
  activeTenant: MobileTenant | null;
  error: Error | null;
  loading: boolean;
  session: MobileSession | null;
  switchTenant: (tenantId: string) => Promise<void>;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const sessionQuery = useQuery({
    enabled: Boolean(auth.session),
    queryFn: mobileApi.session,
    queryKey: ["mobile-session"]
  });

  useEffect(() => {
    if (!sessionQuery.data) return;
    void selectedTenantStorage.get().then((stored) => {
      const available = sessionQuery.data.tenants.some(
        (tenant) => tenant.id === stored
      );
      const next = available
        ? stored
        : sessionQuery.data.tenants[0]?.id ?? null;
      setTenantId(next);
      if (next) void selectedTenantStorage.set(next);
    });
  }, [sessionQuery.data]);

  const switchTenant = useCallback(
    async (nextTenantId: string) => {
      const allowed = sessionQuery.data?.tenants.some(
        (tenant) => tenant.id === nextTenantId
      );
      if (!allowed) throw new Error("Deze organisatie is niet beschikbaar.");
      const previous = tenantId;
      setTenantId(nextTenantId);
      await selectedTenantStorage.set(nextTenantId);
      if (previous && previous !== nextTenantId) {
        await clearTenantCache(previous);
      }
      await queryClient.cancelQueries();
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "mobile-session"
      });
    },
    [queryClient, sessionQuery.data?.tenants, tenantId]
  );

  const activeTenant =
    sessionQuery.data?.tenants.find((tenant) => tenant.id === tenantId) ?? null;
  const value = useMemo<TenantContextValue>(
    () => ({
      activeTenant,
      error:
        sessionQuery.error instanceof Error ? sessionQuery.error : null,
      loading: sessionQuery.isLoading || (Boolean(sessionQuery.data) && !tenantId),
      session: sessionQuery.data ?? null,
      switchTenant
    }),
    [
      activeTenant,
      sessionQuery.data,
      sessionQuery.error,
      sessionQuery.isLoading,
      switchTenant,
      tenantId
    ]
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant() {
  const value = useContext(TenantContext);
  if (!value) {
    throw new Error("useTenant moet binnen TenantProvider worden gebruikt.");
  }
  return value;
}
