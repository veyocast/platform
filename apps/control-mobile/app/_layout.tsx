import "react-native-gesture-handler";

import {
  AppShell,
  MobileThemeProvider,
  ScreenScrollView,
  useMobileTheme
} from "@veyocast/mobile-design-system";
import * as SplashScreen from "expo-splash-screen";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { AppLockProvider } from "../src/auth/app-lock-provider";
import { AuthProvider, useAuth } from "../src/auth/auth-provider";
import { AppLock } from "../src/components/app-lock";
import { FullScreenError } from "../src/components/app-error";
import { MobileQueryProvider } from "../src/query/query-provider";
import { TenantProvider } from "../src/tenant/tenant-provider";
import { NotificationRouter } from "../src/notifications/notification-router";

void SplashScreen.preventAutoHideAsync();

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <MobileThemeProvider>
        <AppShell>
          <ScreenScrollView>
            <FullScreenError error={error} retry={retry} />
          </ScreenScrollView>
        </AppShell>
      </MobileThemeProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <MobileThemeProvider>
          <MobileQueryProvider>
            <AuthProvider>
              <AppLockProvider>
                <TenantProvider>
                  <RootNavigator />
                </TenantProvider>
              </AppLockProvider>
            </AuthProvider>
          </MobileQueryProvider>
        </MobileThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { initialized } = useAuth();
  const theme = useMobileTheme();
  useEffect(() => {
    if (initialized) void SplashScreen.hideAsync();
  }, [initialized]);
  if (!initialized) return null;
  return (
    <>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.canvas },
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.ink
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="screens/[screenId]" options={{ title: "Scherm" }} />
        <Stack.Screen name="screens/pair" options={{ title: "Scherm koppelen" }} />
        <Stack.Screen name="content/playlists/new" options={{ title: "Playlist maken" }} />
        <Stack.Screen name="content/playlists/[playlistId]" options={{ title: "Playlist" }} />
        <Stack.Screen name="more/organizations" options={{ title: "Organisaties" }} />
        <Stack.Screen name="more/security" options={{ title: "Beveiliging" }} />
        <Stack.Screen name="more/account" options={{ title: "Account" }} />
        <Stack.Screen name="more/notifications" options={{ title: "Meldingen" }} />
      </Stack>
      <NotificationRouter />
      <AppLock />
    </>
  );
}
