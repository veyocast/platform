import {
  mobileCockpitSchema,
  mobileContentSchema,
  mobileScreensEnvelopeSchema
} from "@veyocast/contracts";
import { useQuery } from "@tanstack/react-query";

import { mobileApi, MobileApiError } from "../api/mobile-api";
import { useAuth } from "../auth/auth-provider";
import { useTenant } from "../tenant/tenant-provider";
import {
  readTenantCache,
  writeTenantCache
} from "../storage/tenant-cache";

const screensDataSchema = mobileScreensEnvelopeSchema.shape.data;

export function useMobileCockpit() {
  const { activeTenant } = useTenant();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    enabled: Boolean(activeTenant && userId),
    queryFn: async () => {
      if (!activeTenant || !userId) throw new Error("Kies eerst een organisatie en bevestig je sessie.");
      try {
        const data = await mobileApi.cockpit(activeTenant.id);
        await writeTenantCache(activeTenant.id, `cockpit:${userId}`, data);
        return { data, offline: false, storedAt: null };
      } catch (error) {
        if (error instanceof MobileApiError && error.status < 500) throw error;
        const cached = await readTenantCache(
          activeTenant.id,
          `cockpit:${userId}`,
          mobileCockpitSchema
        );
        if (cached) {
          return {
            data: cached.data,
            offline: true,
            storedAt: cached.storedAt
          };
        }
        throw error;
      }
    },
    queryKey: ["cockpit", activeTenant?.id, userId]
  });
}

export function useMobileScreens() {
  const { activeTenant } = useTenant();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    enabled: Boolean(activeTenant && userId),
    queryFn: async () => {
      if (!activeTenant || !userId) throw new Error("Kies eerst een organisatie en bevestig je sessie.");
      try {
        const data = await mobileApi.screens(activeTenant.id);
        await writeTenantCache(activeTenant.id, `screens:${userId}`, data);
        return { data, offline: false, storedAt: null };
      } catch (error) {
        if (error instanceof MobileApiError && error.status < 500) throw error;
        const cached = await readTenantCache(
          activeTenant.id,
          `screens:${userId}`,
          screensDataSchema
        );
        if (cached) {
          return {
            data: cached.data,
            offline: true,
            storedAt: cached.storedAt
          };
        }
        throw error;
      }
    },
    queryKey: ["screens", activeTenant?.id, userId]
  });
}

export function useMobileContent() {
  const { activeTenant } = useTenant();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    enabled: Boolean(activeTenant && userId),
    queryFn: async () => {
      if (!activeTenant || !userId) throw new Error("Kies eerst een organisatie en bevestig je sessie.");
      try {
        const data = await mobileApi.content(activeTenant.id);
        await writeTenantCache(activeTenant.id, `content:${userId}`, data);
        return { data, offline: false, storedAt: null };
      } catch (error) {
        if (error instanceof MobileApiError && error.status < 500) throw error;
        const cached = await readTenantCache(
          activeTenant.id,
          `content:${userId}`,
          mobileContentSchema
        );
        if (cached) {
          return {
            data: cached.data,
            offline: true,
            storedAt: cached.storedAt
          };
        }
        throw error;
      }
    },
    queryKey: ["content", activeTenant?.id, userId]
  });
}
