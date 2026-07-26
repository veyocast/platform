"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect } from "react";

import { parseRecoveryFragment } from "../../lib/recovery-fragment";

type RecoveryFragmentBridgeProps = Readonly<{
  anonKey: string;
  supabaseUrl: string;
}>;

export function RecoveryFragmentBridge({
  anonKey,
  supabaseUrl
}: RecoveryFragmentBridgeProps) {
  useEffect(() => {
    const session = parseRecoveryFragment(window.location.hash);
    if (!session) return;

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    );

    const supabase = createBrowserClient(supabaseUrl, anonKey);
    void supabase.auth
      .setSession({
        access_token: session.accessToken,
        refresh_token: session.refreshToken
      })
      .then(({ error }) => {
        window.location.replace(
          error
            ? "/login?fout=herstel"
            : "/auth/reset-password"
        );
      })
      .catch(() => {
        window.location.replace("/login?fout=herstel");
      });
  }, [anonKey, supabaseUrl]);

  return null;
}
