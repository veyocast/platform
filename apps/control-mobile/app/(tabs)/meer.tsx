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
import { Alert, Linking, StyleSheet, View } from "react-native";

import { useAuth } from "../../src/auth/auth-provider";
import { PageHeader } from "../../src/components/page-header";
import { SettingsRow } from "../../src/components/settings-row";
import { useTenant } from "../../src/tenant/tenant-provider";

export default function MeerScreen() {
  const router = useRouter();
  const theme = useMobileTheme();
  const { signOut, signOutEverywhere } = useAuth();
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
            Organisatie en account
          </AppText>
          <SurfaceCard style={styles.settingsGroup}>
            <SettingsRow
              description="Wissel zonder gegevens tussen organisaties te mengen."
              grouped
              icon={<Building2 color={theme.colors.ink} size={21} />}
              label="Organisaties"
              onPress={() => router.push("/more/organizations")}
              showDivider
            />
            <SettingsRow
              description="Biometrie en lokale appbeveiliging."
              grouped
              icon={<ShieldCheck color={theme.colors.ink} size={21} />}
              label="Beveiliging"
              onPress={() => router.push("/more/security")}
              showDivider
            />
            <SettingsRow
              description="Profiel, verwijderen en sessie."
              grouped
              icon={<UserRound color={theme.colors.ink} size={21} />}
              label="Account"
              onPress={() => router.push("/more/account")}
            />
          </SurfaceCard>
        </View>
        <View style={styles.section}>
          <AppText muted variant="label">
            Meldingen en support
          </AppText>
          <SurfaceCard style={styles.settingsGroup}>
            <SettingsRow
              description="Pushmeldingen worden alleen gevraagd wanneer je ze hier inschakelt."
              grouped
              icon={<Bell color={theme.colors.ink} size={21} />}
              label="Meldingsvoorkeuren"
              onPress={() => router.push("/more/notifications")}
              showDivider
            />
            <SettingsRow
              description="Open de publieke VeyoCast-supportomgeving."
              grouped
              icon={<CircleHelp color={theme.colors.ink} size={21} />}
              label="Support"
              onPress={() => void Linking.openURL("https://veyocast.nl/support")}
            />
          </SurfaceCard>
        </View>
        <SurfaceCard style={styles.settingsGroup}>
          <SettingsRow
            description="Wis sessietokens en lokale tenantcache op dit apparaat."
            grouped
            icon={<LogOut color={theme.colors.critical} size={21} />}
            label="Uitloggen"
            onPress={() => void signOut()}
            showDivider
          />
          <SettingsRow
            description="Trek alle VeyoCast-sessies voor dit account in."
            grouped
            icon={<ShieldCheck color={theme.colors.critical} size={21} />}
            label="Overal uitloggen"
            onPress={() =>
              Alert.alert(
                "Overal uitloggen?",
                "Je wordt ook op andere apparaten en in Control opnieuw om je wachtwoord gevraagd.",
                [
                  { style: "cancel", text: "Annuleren" },
                  {
                    onPress: () => void signOutEverywhere(),
                    style: "destructive",
                    text: "Overal uitloggen"
                  }
                ]
              )
            }
          />
        </SurfaceCard>
      </ScreenScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  copy: { flex: 1, gap: mobileSpacing.micro },
  profile: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.inline
  },
  section: { gap: mobileSpacing.compact },
  settingsGroup: {
    overflow: "hidden",
    padding: 0
  }
});
