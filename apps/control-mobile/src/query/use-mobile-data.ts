import {
  mobileCockpitSchema,
  mobileContentSchema,
  mobileScreensEnvelopeSchema
} from "@veyocast/contracts";
import { useQuery } from "@tanstack/react-query";

import { mobileApi } from "../api/mobile-api";
import { useTenant } from "../tenant/tenant-provider";
import {
  readTenantCache,
  writeTenantCache
} from "../storage/tenant-cache";

const screensDataSchema = mobileScreensEnvelopeSchema.shape.data;

export function useMobileCockpit() {
  const { activeTenant } = useTenant();
  return useQuery({
    enabled: Boolean(activeTenant),
    queryFn: async () => {
      if (!activeTenant) throw new Error("Kies eerst een organisatie.");
      try {
        const data = await mobileApi.cockpit(activeTenant.id);
        await writeTenantCache(activeTenant.id, "cockpit", data);
        return { data, offline: false, storedAt: null };
      } catch (error) {
        const cached = await readTenantCache(
          activeTenant.id,
          "cockpit",
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
    queryKey: ["cockpit", activeTenant?.id]
  });
}

export function useMobileScreens() {
  const { activeTenant } = useTenant();
  return useQuery({
    enabled: Boolean(activeTenant),
    queryFn: async () => {
      if (!activeTenant) throw new Error("Kies eerst een organisatie.");
      try {
        const data = await mobileApi.screens(activeTenant.id);
        await writeTenantCache(activeTenant.id, "screens", data);
        return { data, offline: false, storedAt: null };
      } catch (error) {
        const cached = await readTenantCache(
          activeTenant.id,
          "screens",
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
    queryKey: ["screens", activeTenant?.id]
  });
}

export function useMobileContent() {
  const { activeTenant } = useTenant();
  return useQuery({
    enabled: Boolean(activeTenant),
    queryFn: async () => {
      if (!activeTenant) throw new Error("Kies eerst een organisatie.");
      try {
        const data = await mobileApi.content(activeTenant.id);
        await writeTenantCache(activeTenant.id, "content", data);
        return { data, offline: false, storedAt: null };
      } catch (error) {
        const cached = await readTenantCache(
          activeTenant.id,
          "content",
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
    queryKey: ["content", activeTenant?.id]
  });
}
