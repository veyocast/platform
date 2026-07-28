import {
  AppText,
  IconButton,
  mobileSpacing,
  useMobileTheme
} from "@veyocast/mobile-design-system";
import { Building2, ChevronDown } from "lucide-react-native";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

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
  const { activeTenant } = useTenant();
  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        {eyebrow ? (
          <AppText muted variant="label">
            {eyebrow}
          </AppText>
        ) : null}
        <AppText accessibilityRole="header" variant="pageTitle">
          {title}
        </AppText>
        {activeTenant ? (
          <View style={styles.organization}>
            <Building2 color={theme.colors.secondaryInk} size={15} />
            <AppText muted variant="label">
              {activeTenant.name}
            </AppText>
          </View>
        ) : null}
      </View>
      <IconButton
        accessibilityLabel="Organisatie wisselen"
        icon={<ChevronDown color={theme.colors.ink} size={22} />}
        onPress={() => router.push("/more/organizations")}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    gap: mobileSpacing.micro
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.default
  },
  organization: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  }
});
