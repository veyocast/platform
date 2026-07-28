import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  mobilePalette,
  mobileRadius,
  mobileSpacing,
  type MobileStatusTone
} from "./tokens";
import { useMobileTheme } from "./theme";
import { AppText } from "./typography";
import { Button } from "./controls";

const toneLabels: Record<MobileStatusTone, string> = {
  critical: "Fout",
  info: "Informatie",
  neutral: "Status",
  success: "Gereed",
  warning: "Aandacht"
};

export function StatusBadge({
  label,
  tone = "neutral"
}: {
  label: string;
  tone?: MobileStatusTone;
}) {
  const theme = useMobileTheme();
  const foreground = {
    critical: mobilePalette.status.critical,
    info: theme.colors.focus,
    neutral: theme.colors.secondaryInk,
    success: mobilePalette.status.success,
    warning: mobilePalette.status.warning
  }[tone];
  const background = {
    critical: mobilePalette.status.criticalSurface,
    info: mobilePalette.status.infoSurface,
    neutral: theme.colors.surface,
    success: mobilePalette.status.successSurface,
    warning: mobilePalette.status.warningSurface
  }[tone];
  return (
    <View
      accessibilityLabel={`${toneLabels[tone]}: ${label}`}
      style={[styles.badge, { backgroundColor: background }]}
    >
      <View style={[styles.dot, { backgroundColor: foreground }]} />
      <AppText variant="micro" style={{ color: foreground }}>
        {label}
      </AppText>
    </View>
  );
}

export function InlineAlert({
  action,
  description,
  title,
  tone = "info"
}: {
  action?: ReactNode;
  description: string;
  title: string;
  tone?: MobileStatusTone;
}) {
  const theme = useMobileTheme();
  const borderColor =
    tone === "critical"
      ? theme.colors.critical
      : tone === "warning"
        ? theme.colors.warning
        : theme.colors.focus;
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.alert,
        { backgroundColor: theme.colors.raised, borderColor }
      ]}
    >
      <View style={styles.alertCopy}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText muted>{description}</AppText>
      </View>
      {action}
    </View>
  );
}

export function StateView({
  actionLabel,
  description,
  icon,
  loading = false,
  onAction,
  title
}: {
  actionLabel?: string;
  description: string;
  icon?: ReactNode;
  loading?: boolean;
  onAction?: () => void;
  title: string;
}) {
  const theme = useMobileTheme();
  return (
    <View
      accessibilityLiveRegion={loading ? "polite" : "none"}
      style={[styles.state, { backgroundColor: theme.colors.surface }]}
    >
      {loading ? <ActivityIndicator color={theme.colors.action} size="large" /> : icon}
      <AppText accessibilityRole="header" variant="section" style={styles.center}>
        {title}
      </AppText>
      <AppText muted style={styles.center}>
        {description}
      </AppText>
      {actionLabel && onAction ? (
        <Button onPress={onAction} variant="secondary">
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

export function Skeleton({ height = 80 }: { height?: number }) {
  const theme = useMobileTheme();
  return (
    <View
      accessibilityLabel="Inhoud wordt geladen"
      style={[
        styles.skeleton,
        { backgroundColor: theme.colors.line, height }
      ]}
    />
  );
}

const styles = StyleSheet.create({
  alert: {
    alignItems: "flex-start",
    borderLeftWidth: 3,
    borderRadius: mobileRadius.control,
    flexDirection: "row",
    gap: mobileSpacing.default,
    padding: mobileSpacing.default
  },
  alertCopy: {
    flex: 1,
    gap: mobileSpacing.micro
  },
  badge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: mobileRadius.full,
    flexDirection: "row",
    gap: 6,
    minHeight: 24,
    paddingHorizontal: mobileSpacing.compact
  },
  center: {
    textAlign: "center"
  },
  dot: {
    borderRadius: mobileRadius.full,
    height: 8,
    width: 8
  },
  skeleton: {
    borderRadius: mobileRadius.card,
    opacity: 0.65,
    width: "100%"
  },
  state: {
    alignItems: "center",
    borderRadius: mobileRadius.card,
    gap: mobileSpacing.inline,
    justifyContent: "center",
    minHeight: 240,
    padding: mobileSpacing.section
  }
});
