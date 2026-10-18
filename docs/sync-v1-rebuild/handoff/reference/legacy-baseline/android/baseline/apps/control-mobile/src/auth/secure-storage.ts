import * as SecureStore from "expo-secure-store";
import type { SupportedStorage } from "@supabase/supabase-js";

const keyPrefix = "veyocast.control.auth.";

function scopedKey(key: string) {
  return `${keyPrefix}${key}`;
}

export const secureAuthStorage: SupportedStorage = {
  async getItem(key) {
    return SecureStore.getItemAsync(scopedKey(key));
  },
  async removeItem(key) {
    await SecureStore.deleteItemAsync(scopedKey(key));
  },
  async setItem(key, value) {
    await SecureStore.setItemAsync(scopedKey(key), value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
  }
};

export const selectedTenantStorage = {
  async get() {
    return SecureStore.getItemAsync("veyocast.control.tenant");
  },
  async remove() {
    return SecureStore.deleteItemAsync("veyocast.control.tenant");
  },
  async set(tenantId: string) {
    return SecureStore.setItemAsync("veyocast.control.tenant", tenantId, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
  }
};
