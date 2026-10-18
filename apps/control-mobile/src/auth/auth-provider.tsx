import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { clearAllTenantCaches } from "../storage/tenant-cache";
import {
  mobileRuntimeError,
  mobileSupabase
} from "./supabase";
import { selectedTenantStorage } from "./secure-storage";
import { runNativeSessionOperation } from "./session-operations";
import { applyNativeSessionTransition } from "./session-transition";

type AuthContextValue = {
  configurationError: string | null;
  initialized: boolean;
  resetPassword: (email: string) => Promise<void>;
  session: Session | null;
  sessionError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const currentUser = useRef<string | null>(null);
  const sessionTransition = useRef<Promise<void>>(Promise.resolve());
  const [initialized, setInitialized] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!mobileSupabase) {
      setInitialized(true);
      return;
    }
    let active = true;
    let receivedAuthEvent = false;
    function failedTransition() {
      if (active) {
        setSession(null);
        setInitialized(true);
        setSessionError("De vorige accountgegevens konden niet veilig worden opgeruimd. Je account blijft afgeschermd; probeer opnieuw in te loggen of herstart de app.");
      }
    }
    function acceptSession(next: Session | null) {
      if (!active) return;
      sessionTransition.current = sessionTransition.current.catch(() => undefined).then(() => applyNativeSessionTransition(currentUser, next, {
        hide: () => { if (active) setSession(null); },
        cancelQueries: () => queryClient.cancelQueries(),
        clearQueries: () => queryClient.clear(),
        clearTenantCaches: clearAllTenantCaches,
        publish: value => { if (active) { setSession(value); setSessionError(null); setInitialized(true); } },
      }));
      void sessionTransition.current.catch(failedTransition);
    }
    void mobileSupabase.auth.getSession().then(({ data }) => {
      if (!receivedAuthEvent) acceptSession(data.session);
    }).catch(() => { if (!receivedAuthEvent) failedTransition(); });
    const { data } = mobileSupabase.auth.onAuthStateChange((_event, next) => {
      receivedAuthEvent = true;
      acceptSession(next);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [queryClient]);

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
    setSessionError(null);
    await runNativeSessionOperation(async () => {
      const { error } = await mobileSupabase!.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await sessionTransition.current;
    });
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
    await runNativeSessionOperation(async () => {
      await Promise.all([selectedTenantStorage.remove(), clearAllTenantCaches(), mobileSupabase?.auth.signOut({ scope: "local" })]);
    });
  }, []);

  const signOutEverywhere = useCallback(async () => {
    if (!mobileSupabase) {
      throw new Error(mobileRuntimeError ?? "De appconfiguratie ontbreekt.");
    }
    await runNativeSessionOperation(async () => {
      const { error } = await mobileSupabase!.auth.signOut({ scope: "global" });
      if (error) throw error;
      await Promise.all([selectedTenantStorage.remove(), clearAllTenantCaches()]);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configurationError: mobileRuntimeError,
      initialized,
      resetPassword,
      session,
      sessionError,
      signIn,
      signOut,
      signOutEverywhere
    }),
    [
      initialized,
      resetPassword,
      session,
      sessionError,
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
