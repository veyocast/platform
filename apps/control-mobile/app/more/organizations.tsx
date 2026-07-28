import {
  AppShell,
  AppText,
  Button,
  ScreenScrollView,
  StatusBadge,
  SurfaceCard,
  mobileSpacing
} from "@veyocast/mobile-design-system";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { useTenant } from "../../src/tenant/tenant-provider";

export default function OrganizationsScreen() {
  const router = useRouter();
  const { activeTenant, session, switchTenant } = useTenant();
  return (
    <AppShell>
      <ScreenScrollView>
        <View style={styles.copy}>
          <AppText accessibilityRole="header" variant="section">
            Kies een organisatie
          </AppText>
          <AppText muted>
            Lokale scherm- en contentcache wordt bij wisselen gewist, zodat
            organisaties nooit data delen.
          </AppText>
        </View>
        {session?.tenants.map((tenant) => {
          const selected = tenant.id === activeTenant?.id;
          return (
            <SurfaceCard key={tenant.id} style={styles.tenant}>
              <View style={styles.tenantCopy}>
                <AppText variant="cardTitle">{tenant.name}</AppText>
                <AppText muted>{tenant.roleLabel}</AppText>
                <StatusBadge
                  label={tenant.status === "active" ? "Actief" : tenant.status}
                  tone={tenant.status === "active" ? "success" : "warning"}
                />
              </View>
              {selected ? (
                <Check color="#18794E" size={24} />
              ) : (
                <Button
                  disabled={tenant.status !== "active"}
                  onPress={() => {
                    void switchTenant(tenant.id).then(() => router.back());
                  }}
                  variant="secondary"
                >
                  Kiezen
                </Button>
              )}
            </SurfaceCard>
          );
        })}
      </ScreenScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  copy: { gap: mobileSpacing.micro },
  tenant: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.default
  },
  tenantCopy: { flex: 1, gap: mobileSpacing.micro }
});
