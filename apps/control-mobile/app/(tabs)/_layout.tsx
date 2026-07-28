import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";

import {
  PremiumTabBar,
  premiumRailBreakpoint
} from "../../src/navigation/premium-tab-bar";

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  return (
    <Tabs
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarPosition:
          width >= premiumRailBreakpoint ? "left" : "bottom"
      }}
    >
      <Tabs.Screen
        name="vandaag"
        options={{
          title: "Vandaag"
        }}
      />
      <Tabs.Screen
        name="schermen"
        options={{
          title: "Schermen"
        }}
      />
      <Tabs.Screen
        name="maken"
        options={{
          title: "Maken"
        }}
      />
      <Tabs.Screen
        name="content"
        options={{
          title: "Content"
        }}
      />
      <Tabs.Screen
        name="meer"
        options={{
          title: "Meer"
        }}
      />
    </Tabs>
  );
}
