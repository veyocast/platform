import {
  AppText,
  IconButton,
  PressableSurface,
  mobileRadius,
  mobileSpacing,
  useMobileTheme
} from "@veyocast/mobile-design-system";
import {
  Bell,
  Building2,
  ChevronDown,
  UserRound
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { StyleSheet, View, useWindowDimensions } from "react-native";

import { useAuth } from "../auth/auth-provider";
import { useTenant } from "../tenant/tenant-provider";

export function PageHeader({
  eyebrow,
  title
}: {
  eyebrow?: string;
  title: string;
}) {
  const theme = useMobileTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const { activeTenant } = useTenant();
  const compact = width < 560;
  const userInitial = (session?.user.email ?? "V")
    .slice(0, 1)
    .toLocaleUpperCase("nl-NL");
  return (
    <View
      style={[
        styles.header,
        compact ? styles.headerCompact : styles.headerWide
      ]}
    >
      <View style={styles.copy}>
        {eyebrow ? (
          <AppText muted variant="label">
            {eyebrow}
          </AppText>
        ) : null}
        <AppText accessibilityRole="header" variant="pageTitle">
          {title}
        </AppText>
      </View>
      <View style={styles.context}>
        {activeTenant ? (
          <PressableSurface
            accessibilityLabel={`Organisatie wisselen. Actief: ${activeTenant.name}`}
            accessibilityRole="button"
            onPress={() => router.push("/more/organizations")}
            style={[
              styles.organization,
              {
                backgroundColor: theme.colors.raised,
                borderColor: theme.colors.line
              }
            ]}
          >
            <View
              style={[
                styles.organizationIcon,
                { backgroundColor: theme.colors.canvas }
              ]}
            >
              <Building2 color={theme.colors.secondaryInk} size={16} />
            </View>
            <AppText numberOfLines={1} variant="label" style={styles.tenantName}>
              {activeTenant.name}
            </AppText>
            <ChevronDown color={theme.colors.secondaryInk} size={16} />
          </PressableSurface>
        ) : null}
        <View style={styles.actions}>
          <IconButton
            accessibilityLabel="Meldingsvoorkeuren openen"
            icon={<Bell color={theme.colors.ink} size={20} />}
            onPress={() => router.push("/more/notifications")}
            style={[
              styles.headerAction,
              {
                backgroundColor: theme.colors.raised,
                borderColor: theme.colors.line
              }
            ]}
            variant="secondary"
          />
          <IconButton
            accessibilityLabel="Account openen"
            icon={
              session?.user.email ? (
                <AppText variant="label" style={styles.avatarText}>
                  {userInitial}
                </AppText>
              ) : (
                <UserRound color={theme.colors.ink} size={20} />
              )
            }
            onPress={() => router.push("/more/account")}
            style={[
              styles.avatar,
              { backgroundColor: theme.colors.action }
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.compact
  },
  avatar: {
    borderRadius: mobileRadius.full,
    minHeight: 44,
    minWidth: 44
  },
  avatarText: {
    color: "#0A0A0A",
    fontWeight: "700"
  },
  context: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.compact
  },
  copy: {
    flex: 1,
    gap: 2
  },
  header: {
    gap: mobileSpacing.inline
  },
  headerAction: {
    borderWidth: 1,
    minHeight: 44,
    minWidth: 44
  },
  headerCompact: {
    alignItems: "stretch"
  },
  headerWide: {
    alignItems: "center",
    flexDirection: "row"
  },
  organization: {
    alignItems: "center",
    borderRadius: mobileRadius.control,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: mobileSpacing.compact,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: mobileSpacing.compact
  },
  organizationIcon: {
    alignItems: "center",
    borderRadius: mobileRadius.chip,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  tenantName: {
    flexShrink: 1
  }
});
