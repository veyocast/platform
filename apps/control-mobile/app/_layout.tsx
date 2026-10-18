import "react-native-gesture-handler";
import SyncManrope_400Regular from "../assets/fonts/SyncManrope-400.ttf";
import SyncManrope_450Book from "../assets/fonts/SyncManrope-450.ttf";
import SyncManrope_500Medium from "../assets/fonts/SyncManrope-500.ttf";
import SyncManrope_600SemiBold from "../assets/fonts/SyncManrope-600.ttf";
import SyncManrope_650Strong from "../assets/fonts/SyncManrope-650.ttf";
import SyncManrope_700Bold from "../assets/fonts/SyncManrope-700.ttf";
import SyncManrope_750Heading from "../assets/fonts/SyncManrope-750.ttf";

import {
  AppShell,
  mobileFontFamily,
  MobileThemeProvider,
  ScreenScrollView,
  useMobileTheme,
} from "@veyocast/mobile-design-system";
import { useFonts } from "expo-font";
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
  const [fontsLoaded, fontError] = useFonts({
    SyncManrope_400Regular,
    SyncManrope_450Book,
    SyncManrope_500Medium,
    SyncManrope_600SemiBold,
    SyncManrope_650Strong,
    SyncManrope_700Bold,
    SyncManrope_750Heading,
  });
  const fontsReady = fontsLoaded || Boolean(fontError);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <MobileThemeProvider>
          <MobileQueryProvider>
            <AuthProvider>
              <AppLockProvider>
                <TenantProvider>
                  <RootNavigator fontsReady={fontsReady} />
                </TenantProvider>
              </AppLockProvider>
            </AuthProvider>
          </MobileQueryProvider>
        </MobileThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { initialized } = useAuth();
  const theme = useMobileTheme();
  useEffect(() => {
    if (initialized && fontsReady) void SplashScreen.hideAsync();
  }, [fontsReady, initialized]);
  if (!initialized || !fontsReady) return null;
  return (
    <>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.canvas },
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.ink,
          headerTitleStyle: {
            fontFamily: mobileFontFamily.medium,
            fontSize: 16,
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="studio/index" options={{ title: "Studio" }} />
        <Stack.Screen
          name="studio/[seriesId]"
          options={{ title: "Studio-reeks" }}
        />
        <Stack.Screen name="screens/[screenId]" options={{ title: "Scherm" }} />
        <Stack.Screen
          name="screens/pair"
          options={{ title: "Scherm koppelen" }}
        />
        <Stack.Screen
          name="more/organizations"
          options={{ title: "Organisaties" }}
        />
        <Stack.Screen name="more/security" options={{ title: "Beveiliging" }} />
        <Stack.Screen name="more/account" options={{ title: "Account" }} />
        <Stack.Screen name="more/engage" options={{ title: "Engage" }} />
        <Stack.Screen
          name="more/notifications"
          options={{ title: "Meldingen" }}
        />
      </Stack>
      <NotificationRouter />
      <AppLock />
    </>
  );
}
