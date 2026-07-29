import {
  mobileFontFamily,
  useMobileTheme
} from "@veyocast/mobile-design-system";
import { Stack } from "expo-router";

export default function ContentLayout() {
  const theme = useMobileTheme();
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: theme.colors.canvas },
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.colors.canvas },
        headerTintColor: theme.colors.ink,
        headerTitleStyle: {
          fontFamily: mobileFontFamily.medium,
          fontSize: 16
        }
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="playlists/new"
        options={{ title: "Playlist maken" }}
      />
      <Stack.Screen
        name="playlists/[playlistId]"
        options={{ title: "Playlist" }}
      />
    </Stack>
  );
}
