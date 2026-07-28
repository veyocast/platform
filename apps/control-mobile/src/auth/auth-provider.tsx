import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
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

import { clearAllTenantCaches } from "../storage/tenant-cache";
import {
  mobileRuntimeError,
  mobileSupabase
} from "./supabase";
import { selectedTenantStorage } from "./secure-storage";

type AuthContextValue = {
  configurationError: string | null;
  initialized: boolean;
  resetPassword: (email: string) => Promise<void>;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [initialized, setInitialized] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!mobileSupabase) {
      setInitialized(true);
      return;
    }
    void mobileSupabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitialized(true);
    });
    const { data } = mobileSupabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setInitialized(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!mobileSupabase) return;
    const client = mobileSupabase;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        client.auth.startAutoRefresh();
      } else {
        client.auth.stopAutoRefresh();
      }
    });
    return () => subscription.remove();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!mobileSupabase) {
      throw new Error(mobileRuntimeError ?? "De appconfiguratie ontbreekt.");
    }
    const { error } = await mobileSupabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!mobileSupabase) {
      throw new Error(mobileRuntimeError ?? "De appconfiguratie ontbreekt.");
    }
    const { error } = await mobileSupabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: Linking.createURL("/auth/reset-password") }
    );
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await Promise.all([
      selectedTenantStorage.remove(),
      clearAllTenantCaches(),
      mobileSupabase?.auth.signOut({ scope: "local" })
    ]);
  }, []);

  const signOutEverywhere = useCallback(async () => {
    if (!mobileSupabase) {
      throw new Error(mobileRuntimeError ?? "De appconfiguratie ontbreekt.");
    }
    const { error } = await mobileSupabase.auth.signOut({ scope: "global" });
    if (error) throw error;
    await Promise.all([
      selectedTenantStorage.remove(),
      clearAllTenantCaches()
    ]);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configurationError: mobileRuntimeError,
      initialized,
      resetPassword,
      session,
      signIn,
      signOut,
      signOutEverywhere
    }),
    [
      initialized,
      resetPassword,
      session,
      signIn,
      signOut,
      signOutEverywhere
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth moet binnen AuthProvider worden gebruikt.");
  return value;
}
