import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { AppState } from "react-native";

const preferenceKey = "veyocast.control.biometric-lock";

type AppLockContextValue = {
  available: boolean;
  enabled: boolean;
  locked: boolean;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  unlock: () => Promise<boolean>;
};

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function AppLockProvider({ children }: PropsWithChildren) {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    void Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      SecureStore.getItemAsync(preferenceKey)
    ]).then(([hardware, enrolled, preference]) => {
      setAvailable(hardware && enrolled);
      setEnabledState(preference === "enabled");
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && enabled) setLocked(true);
    });
    return () => subscription.remove();
  }, [enabled]);

  const unlock = useCallback(async () => {
    if (!enabled) {
      setLocked(false);
      return true;
    }
    const result = await LocalAuthentication.authenticateAsync({
      cancelLabel: "Annuleren",
      disableDeviceFallback: false,
      fallbackLabel: "Toegangscode gebruiken",
      promptMessage: "Ontgrendel VeyoCast Control"
    });
    if (result.success) setLocked(false);
    return result.success;
  }, [enabled]);

  const setEnabled = useCallback(
    async (next: boolean) => {
      if (next) {
        if (!available) return false;
        const result = await LocalAuthentication.authenticateAsync({
          cancelLabel: "Annuleren",
          promptMessage: "Biometrische vergrendeling inschakelen"
        });
        if (!result.success) return false;
      }
      await SecureStore.setItemAsync(
        preferenceKey,
        next ? "enabled" : "disabled",
        { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
      );
      setEnabledState(next);
      setLocked(false);
      return true;
    },
    [available]
  );

  const value = useMemo(
    () => ({ available, enabled, locked, setEnabled, unlock }),
    [available, enabled, locked, setEnabled, unlock]
  );

  return (
    <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>
  );
}

export function useAppLock() {
  const value = useContext(AppLockContext);
  if (!value) {
    throw new Error("useAppLock moet binnen AppLockProvider worden gebruikt.");
  }
  return value;
}
