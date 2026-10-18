import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";

import {
  PremiumTabBar,
  premiumRailBreakpoint,
} from "../../src/navigation/premium-tab-bar";

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  return (
    <Tabs
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarPosition: width >= premiumRailBreakpoint ? "left" : "bottom",
      }}
    >
      <Tabs.Screen
        name="vandaag"
        options={{
          title: "Cockpit",
        }}
      />
      <Tabs.Screen
        name="schermen"
        options={{
          title: "Schermen",
          href: null,
        }}
      />
      <Tabs.Screen
        name="content"
        options={{
          title: "Media",
        }}
      />
      <Tabs.Screen
        name="maken"
        options={{
          title: "Maken",
          href: null,
        }}
      />
      <Tabs.Screen name="ontwerpen" options={{ title: "Studio" }} />
      <Tabs.Screen
        name="meer"
        options={{
          title: "Instellingen",
        }}
      />
    </Tabs>
  );
}
