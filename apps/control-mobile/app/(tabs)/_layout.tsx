import { Tabs } from "expo-router";
import {
  CirclePlus,
  LayoutDashboard,
  Library,
  MoreHorizontal,
  Monitor
} from "lucide-react-native";
import { useWindowDimensions } from "react-native";

import { useMobileTheme } from "@veyocast/mobile-design-system";

export default function TabsLayout() {
  const theme = useMobileTheme();
  const { width } = useWindowDimensions();
  const rail = width >= 840;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.action,
        tabBarInactiveTintColor: theme.colors.mutedInk,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "500" },
        tabBarPosition: rail ? "left" : "bottom",
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.line,
          minWidth: rail ? 112 : undefined
        }
      }}
    >
      <Tabs.Screen
        name="vandaag"
        options={{
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={size} />
          ),
          title: "Vandaag"
        }}
      />
      <Tabs.Screen
        name="schermen"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Monitor color={color} size={size} />
          ),
          title: "Schermen"
        }}
      />
      <Tabs.Screen
        name="maken"
        options={{
          tabBarIcon: ({ color, size }) => (
            <CirclePlus color={color} size={size} />
          ),
          title: "Maken"
        }}
      />
      <Tabs.Screen
        name="content"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Library color={color} size={size} />
          ),
          title: "Content"
        }}
      />
      <Tabs.Screen
        name="meer"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MoreHorizontal color={color} size={size} />
          ),
          title: "Meer"
        }}
      />
    </Tabs>
  );
}
