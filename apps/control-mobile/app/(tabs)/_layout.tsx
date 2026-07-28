import { Tabs } from "expo-router";

import { PremiumTabBar } from "../../src/navigation/premium-tab-bar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true
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
