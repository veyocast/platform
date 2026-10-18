import { AppText, IconButton, PressableSurface, mobileSpacing, useMobileTheme } from "@veyocast/mobile-design-system";
import { ChevronDown, LockKeyhole } from "lucide-react-native";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useAppLock } from "../auth/app-lock-provider";
import { useTenant } from "../tenant/tenant-provider";
import { BrandMark } from "./brand-mark";

/** The Source identity remains native; organization and locking use the real providers. */
export function PageHeader({ eyebrow, title }: { eyebrow?: string; title: string }) {
  const theme = useMobileTheme();
  const router = useRouter();
  const { activeTenant } = useTenant();
  const { enabled, lock } = useAppLock();
  return (
    <View style={styles.header}>
      <View style={styles.identity}>
        <BrandMark size={34} />
        <PressableSurface
          accessibilityLabel={`Organisatie wisselen. Actief: ${activeTenant?.name ?? "Geen organisatie"}`}
          onPress={() => router.push("/more/organizations")}
          style={styles.organization}
        >
          <View style={styles.copy}>
            <AppText numberOfLines={1} variant="bodyStrong">{activeTenant?.name ?? "Kies een organisatie"}</AppText>
            <AppText muted variant="caption">Mobile Manage</AppText>
          </View>
          <ChevronDown color={theme.colors.secondaryInk} size={16} />
        </PressableSurface>
        <IconButton
          accessibilityLabel={enabled ? "App vergrendelen" : "Appbeveiliging instellen"}
          icon={<LockKeyhole color={theme.colors.ink} size={20} />}
          onPress={() => { if (!lock()) router.push("/more/security"); }}
          variant="secondary"
        />
      </View>
      <View style={styles.copy}>
        {eyebrow ? <AppText muted variant="label">{eyebrow}</AppText> : null}
        <AppText accessibilityRole="header" variant="pageTitle">{title}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: mobileSpacing.section },
  identity: { alignItems: "center", flexDirection: "row", gap: mobileSpacing.compact },
  organization: { alignItems: "center", flex: 1, flexDirection: "row", gap: mobileSpacing.micro, minHeight: 44, minWidth: 0 },
  copy: { flex: 1, gap: mobileSpacing.micro, minWidth: 0 },
});
