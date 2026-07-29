import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Tabs } from "expo-router";
import {
  CirclePlus,
  LayoutDashboard,
  Library,
  MoreHorizontal,
  Monitor,
  type LucideIcon
} from "lucide-react-native";

import {
  AppText,
  mobilePalette,
  mobileRadius,
  mobileSpacing,
  useMobileTheme
} from "@veyocast/mobile-design-system";

import { useAuth } from "../auth/auth-provider";
import { BrandMark } from "../components/brand-mark";
import { useTenant } from "../tenant/tenant-provider";

type TabBarRenderer = NonNullable<ComponentProps<typeof Tabs>["tabBar"]>;
type PremiumTabBarProps = Parameters<TabBarRenderer>[0];

const tabPresentation: Record<
  string,
  Readonly<{ icon: LucideIcon; label: string }>
> = {
  content: { icon: Library, label: "Content" },
  maken: { icon: CirclePlus, label: "Maken" },
  meer: { icon: MoreHorizontal, label: "Meer" },
  schermen: { icon: Monitor, label: "Schermen" },
  vandaag: { icon: LayoutDashboard, label: "Vandaag" }
};

export const premiumRailBreakpoint = 768;

export function PremiumTabBar(props: PremiumTabBarProps) {
  const { width } = useWindowDimensions();
  return width >= premiumRailBreakpoint ? (
    <TabletNavigationRail {...props} />
  ) : (
    <PhoneNavigationDock {...props} />
  );
}

function PhoneNavigationDock({
  descriptors,
  navigation,
  state
}: PremiumTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useMobileTheme();
  const dockBackground =
    theme.mode === "dark" ? theme.colors.raised : theme.colors.ink;
  const dockForeground =
    theme.mode === "dark" ? theme.colors.secondaryInk : theme.colors.canvas;

  return (
    <View
      style={[
        styles.phoneBar,
        {
          backgroundColor: theme.colors.canvas,
          paddingBottom: Math.max(insets.bottom, mobileSpacing.micro)
        }
      ]}
    >
      <View
        style={[
          styles.phoneDock,
          {
            backgroundColor: dockBackground,
            borderColor:
              theme.mode === "dark"
                ? theme.colors.strongLine
                : theme.colors.ink
          }
        ]}
      >
        {state.routes.map((route, index) => {
          const presentation = tabPresentation[route.name];
          if (!presentation) return null;
          const selected = state.index === index;
          const createAction = route.name === "maken";
          const color = selected ? theme.colors.action : dockForeground;
          const Icon = presentation.icon;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={presentation.label}
              key={route.key}
              onLongPress={() =>
                navigation.emit({
                  target: route.key,
                  type: "tabLongPress"
                })
              }
              onPress={() => {
                const event = navigation.emit({
                  canPreventDefault: true,
                  target: route.key,
                  type: "tabPress"
                });
                if (!selected && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={({ pressed }) => [
                styles.phoneItem,
                { opacity: pressed ? 0.72 : 1 }
              ]}
              testID={descriptors[route.key]?.options.tabBarButtonTestID}
            >
              <View
                style={[
                  styles.phoneIcon,
                  createAction && styles.createIcon,
                  createAction && {
                    backgroundColor: theme.colors.action,
                    borderColor: dockBackground
                  },
                  selected &&
                    !createAction && {
                      backgroundColor:
                        theme.mode === "dark"
                          ? theme.colors.surface
                          : "#302D29"
                    }
                ]}
              >
                <Icon
                  color={createAction ? "#0A0A0A" : color}
                  size={createAction ? 23 : 21}
                  strokeWidth={selected || createAction ? 2.35 : 1.9}
                />
              </View>
              <AppText
                numberOfLines={1}
                variant="micro"
                style={[
                  styles.phoneLabel,
                  {
                    color: selected ? theme.colors.action : dockForeground,
                    fontWeight: selected ? "700" : "500"
                  }
                ]}
              >
                {presentation.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TabletNavigationRail({
  descriptors,
  navigation,
  state
}: PremiumTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useMobileTheme();
  const { session } = useAuth();
  const { activeTenant } = useTenant();
  const email = session?.user.email ?? "Account";
  const initial = email.slice(0, 1).toLocaleUpperCase("nl-NL");
  const rail = {
    background: mobilePalette.dark.canvas,
    border: mobilePalette.dark.line,
    foreground: mobilePalette.dark.ink,
    muted: mobilePalette.dark.secondaryInk,
    raised: mobilePalette.dark.raised,
    surface: mobilePalette.dark.surface
  };

  return (
    <View
      style={[
        styles.rail,
        {
          backgroundColor: rail.background,
          borderColor: rail.border,
          paddingBottom: Math.max(insets.bottom, mobileSpacing.default),
          paddingTop: Math.max(insets.top, mobileSpacing.card)
        }
      ]}
    >
      <View style={styles.railBrand}>
        <View
          style={[
          styles.railLogo,
            { backgroundColor: rail.surface }
          ]}
        >
          <BrandMark size={34} />
        </View>
        <View style={styles.railBrandCopy}>
          <AppText variant="cardTitle" style={{ color: rail.foreground }}>
            VeyoCast
          </AppText>
          <AppText variant="micro" style={{ color: rail.muted }}>
            Control
          </AppText>
        </View>
      </View>

      {activeTenant ? (
        <Pressable
          accessibilityLabel="Organisatie wisselen"
          accessibilityRole="button"
          onPress={() => router.push("/more/organizations")}
          style={({ pressed }) => [
            styles.tenantCard,
            {
              backgroundColor: rail.surface,
              borderColor: rail.border,
              opacity: pressed ? 0.76 : 1
            }
          ]}
        >
          <View
            style={[
              styles.tenantAvatar,
              { backgroundColor: theme.colors.action }
            ]}
          >
            <AppText variant="label" style={styles.darkText}>
              {activeTenant.name.slice(0, 1).toLocaleUpperCase("nl-NL")}
            </AppText>
          </View>
          <View style={styles.railItemCopy}>
            <AppText
              numberOfLines={1}
              variant="label"
              style={{ color: rail.foreground }}
            >
              {activeTenant.name}
            </AppText>
            <AppText
              numberOfLines={1}
              variant="micro"
              style={{ color: rail.muted }}
            >
              Actieve organisatie
            </AppText>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.railNavigation}>
        <AppText
          variant="micro"
          style={[styles.railSectionLabel, { color: rail.muted }]}
        >
          Werkplek
        </AppText>
        {state.routes.map((route, index) => {
          const presentation = tabPresentation[route.name];
          if (!presentation) return null;
          const selected = state.index === index;
          const Icon = presentation.icon;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={presentation.label}
              key={route.key}
              onLongPress={() =>
                navigation.emit({
                  target: route.key,
                  type: "tabLongPress"
                })
              }
              onPress={() => {
                const event = navigation.emit({
                  canPreventDefault: true,
                  target: route.key,
                  type: "tabPress"
                });
                if (!selected && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={({ pressed }) => [
                styles.railItem,
                {
                  backgroundColor: selected
                    ? rail.raised
                    : "transparent",
                  borderColor: selected
                    ? rail.border
                    : "transparent",
                  opacity: pressed ? 0.72 : 1
                }
              ]}
              testID={descriptors[route.key]?.options.tabBarButtonTestID}
            >
              <View
                style={[
                  styles.railActiveMark,
                  {
                    backgroundColor: selected
                      ? theme.colors.action
                      : "transparent"
                  }
                ]}
              />
              <Icon
                color={
                  selected ? theme.colors.action : rail.muted
                }
                size={21}
                strokeWidth={selected ? 2.4 : 1.9}
              />
              <AppText
                variant="bodyStrong"
                style={{
                  color: selected
                    ? rail.foreground
                    : rail.muted
                }}
              >
                {presentation.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityLabel="Account openen"
        accessibilityRole="button"
        onPress={() => router.push("/more/account")}
        style={({ pressed }) => [
          styles.accountCard,
          {
            borderColor: rail.border,
            opacity: pressed ? 0.76 : 1
          }
        ]}
      >
        <View
          style={[
            styles.accountAvatar,
            { backgroundColor: theme.colors.action }
          ]}
        >
          <AppText variant="label" style={styles.darkText}>
            {initial}
          </AppText>
        </View>
        <View style={styles.railItemCopy}>
          <AppText
            numberOfLines={1}
            variant="label"
            style={{ color: rail.foreground }}
          >
            Account
          </AppText>
          <AppText
            numberOfLines={1}
            variant="micro"
            style={{ color: rail.muted }}
          >
            {email}
          </AppText>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  accountAvatar: {
    alignItems: "center",
    borderRadius: mobileRadius.full,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  accountCard: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: mobileSpacing.inline,
    marginTop: "auto",
    paddingTop: mobileSpacing.default
  },
  createIcon: {
    borderRadius: mobileRadius.full,
    borderWidth: 2,
    height: 40,
    marginTop: -7,
    width: 40
  },
  darkText: {
    color: "#0A0A0A",
    fontWeight: "700"
  },
  phoneBar: {
    paddingHorizontal: mobileSpacing.inline,
    paddingTop: mobileSpacing.micro
  },
  phoneDock: {
    borderRadius: mobileRadius.hero,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 58,
    paddingHorizontal: mobileSpacing.micro,
    boxShadow: "0 5px 14px rgba(0, 0, 0, 0.16)"
  },
  phoneIcon: {
    alignItems: "center",
    borderRadius: mobileRadius.control,
    height: 32,
    justifyContent: "center",
    width: 38
  },
  phoneItem: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 2,
    paddingVertical: mobileSpacing.micro
  },
  phoneLabel: {
    fontSize: 10,
    lineHeight: 13,
    textAlign: "center"
  },
  rail: {
    borderRightWidth: 1,
    paddingHorizontal: mobileSpacing.inline,
    width: 208
  },
  railActiveMark: {
    borderRadius: mobileRadius.full,
    height: 24,
    marginLeft: -mobileSpacing.inline,
    width: 3
  },
  railBrand: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.inline,
    paddingHorizontal: mobileSpacing.compact
  },
  railBrandCopy: {
    gap: 1
  },
  railItem: {
    alignItems: "center",
    borderRadius: mobileRadius.control,
    borderWidth: 1,
    flexDirection: "row",
    gap: mobileSpacing.inline,
    minHeight: 46,
    paddingHorizontal: mobileSpacing.inline
  },
  railItemCopy: {
    flex: 1,
    gap: 1
  },
  railLogo: {
    alignItems: "center",
    borderRadius: mobileRadius.control,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  railNavigation: {
    gap: mobileSpacing.compact,
    marginTop: mobileSpacing.section
  },
  railSectionLabel: {
    letterSpacing: 0.6,
    paddingHorizontal: mobileSpacing.inline,
    textTransform: "uppercase"
  },
  tenantAvatar: {
    alignItems: "center",
    borderRadius: mobileRadius.control,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  tenantCard: {
    alignItems: "center",
    borderRadius: mobileRadius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: mobileSpacing.compact,
    marginTop: mobileSpacing.section,
    padding: mobileSpacing.compact
  }
});
