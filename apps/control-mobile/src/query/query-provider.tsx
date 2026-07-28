import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager
} from "@tanstack/react-query";
import * as Network from "expo-network";
import { useEffect, useState, type PropsWithChildren } from "react";
import { AppState, Platform } from "react-native";

export function MobileQueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 24 * 60 * 60_000,
            retry: (count, error) =>
              count < 2 &&
              !(
                typeof error === "object" &&
                error !== null &&
                "status" in error &&
                Number(error.status) < 500
              ),
            staleTime: 30_000
          }
        }
      })
  );

  useEffect(() => {
    const appState = AppState.addEventListener("change", (status) => {
      if (Platform.OS !== "web") focusManager.setFocused(status === "active");
    });
    const network = Network.addNetworkStateListener((state) => {
      onlineManager.setOnline(
        state.isConnected === true && state.isInternetReachable !== false
      );
    });
    return () => {
      appState.remove();
      network.remove();
    };
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
