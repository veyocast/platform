import {
  AppShell,
  AppText,
  ScreenScrollView,
  SurfaceCard,
  mobileSpacing,
  useMobileTheme
} from "@veyocast/mobile-design-system";
import { useRouter } from "expo-router";
import {
  Bell,
  Building2,
  CircleHelp,
  LogOut,
  ShieldCheck,
  UserRound
} from "lucide-react-native";
import { Linking, StyleSheet, View } from "react-native";

import { useAuth } from "../../src/auth/auth-provider";
import { PageHeader } from "../../src/components/page-header";
import { SettingsRow } from "../../src/components/settings-row";
import { useTenant } from "../../src/tenant/tenant-provider";

export default function MeerScreen() {
  const router = useRouter();
  const theme = useMobileTheme();
  const { signOut } = useAuth();
  const { session } = useTenant();
  return (
    <AppShell>
      <ScreenScrollView>
        <PageHeader eyebrow="Instellingen" title="Meer" />
        {session ? (
          <SurfaceCard style={styles.profile}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: theme.colors.action }
              ]}
            >
              <AppText variant="section">
                {session.userName.slice(0, 1).toLocaleUpperCase("nl-NL")}
              </AppText>
            </View>
            <View style={styles.copy}>
              <AppText variant="cardTitle">{session.userName}</AppText>
              <AppText muted>{session.email}</AppText>
            </View>
          </SurfaceCard>
        ) : null}
        <View style={styles.section}>
          <AppText muted variant="label">
            ORGANISATIE EN ACCOUNT
          </AppText>
          <SettingsRow
            description="Wissel zonder gegevens tussen organisaties te mengen."
            icon={<Building2 color={theme.colors.ink} size={22} />}
            label="Organisaties"
            onPress={() => router.push("/more/organizations")}
          />
          <SettingsRow
            description="Biometrie en lokale appbeveiliging."
            icon={<ShieldCheck color={theme.colors.ink} size={22} />}
            label="Beveiliging"
            onPress={() => router.push("/more/security")}
          />
          <SettingsRow
            description="Profiel, verwijderen en sessie."
            icon={<UserRound color={theme.colors.ink} size={22} />}
            label="Account"
            onPress={() => router.push("/more/account")}
          />
        </View>
        <View style={styles.section}>
          <AppText muted variant="label">
            MELDINGEN EN SUPPORT
          </AppText>
          <SettingsRow
            description="Pushmeldingen worden alleen gevraagd wanneer je ze hier inschakelt."
            icon={<Bell color={theme.colors.ink} size={22} />}
            label="Meldingsvoorkeuren"
          />
          <SettingsRow
            description="Open de publieke VeyoCast-supportomgeving."
            icon={<CircleHelp color={theme.colors.ink} size={22} />}
            label="Support"
            onPress={() => void Linking.openURL("https://veyocast.nl/support")}
          />
        </View>
        <SettingsRow
          description="Wis sessietokens en lokale tenantcache op dit apparaat."
          icon={<LogOut color={theme.colors.critical} size={22} />}
          label="Uitloggen"
          onPress={() => void signOut()}
        />
      </ScreenScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    borderRadius: 16,
    height: 56,
    justifyContent: "center",
    width: 56
  },
  copy: { flex: 1, gap: mobileSpacing.micro },
  profile: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.inline
  },
  section: { gap: mobileSpacing.compact }
});
