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
  grouped = false,
  showDivider = false,
  trailing
}: {
  description?: string;
  grouped?: boolean;
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  showDivider?: boolean;
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
        },
        grouped && styles.grouped,
        grouped &&
          showDivider && {
            borderBottomColor: theme.colors.line,
            borderBottomWidth: 1
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
  },
  grouped: {
    backgroundColor: "transparent",
    borderRadius: 0,
    borderWidth: 0,
    minHeight: 68
  }
});
