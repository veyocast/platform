import {
  AppText,
  PressableSurface,
  mobileRadius,
  mobileSpacing,
  useMobileTheme
} from "@veyocast/mobile-design-system";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

export function SettingsRow({
  description,
  icon,
  label,
  onPress,
  trailing
}: {
  description?: string;
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  const theme = useMobileTheme();
  return (
    <PressableSurface
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.raised,
          borderColor: theme.colors.line
        }
      ]}
    >
      <View
        style={[styles.icon, { backgroundColor: theme.colors.surface }]}
      >
        {icon}
      </View>
      <View style={styles.copy}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText muted variant="caption">
            {description}
          </AppText>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <ChevronRight color={theme.colors.mutedInk} size={22} />
        ) : null)}
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: mobileSpacing.micro },
  icon: {
    alignItems: "center",
    borderRadius: mobileRadius.control,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  row: {
    alignItems: "center",
    borderRadius: mobileRadius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: mobileSpacing.inline,
    minHeight: 76,
    padding: mobileSpacing.inline
  }
});
