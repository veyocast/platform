import type { PropsWithChildren, ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { mobileRadius, mobileSpacing } from "./tokens";
import { useMobileTheme } from "./theme";
import { AppText } from "./typography";

export function AppShell({
  children,
  style
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const theme = useMobileTheme();
  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={[styles.shell, { backgroundColor: theme.colors.canvas }, style]}
    >
      {children}
    </SafeAreaView>
  );
}

export function ScreenScrollView({
  children,
  contentContainerStyle,
  ...props
}: PropsWithChildren<ScrollViewProps>) {
  return (
    <ScrollView
      {...props}
      automaticallyAdjustContentInsets
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function SurfaceCard({
  children,
  style
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const theme = useMobileTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.raised,
          borderColor: theme.colors.line
        },
        style
      ]}
    >
      {children}
    </View>
  );
}

export type SectionHeaderProps = {
  action?: ReactNode;
  description?: string;
  title: string;
};

export function SectionHeader({
  action,
  description,
  title
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        <AppText accessibilityRole="header" variant="section">
          {title}
        </AppText>
        {description ? <AppText muted>{description}</AppText> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: mobileRadius.card,
    borderWidth: 1,
    padding: mobileSpacing.default
  },
  screenContent: {
    gap: mobileSpacing.section,
    paddingBottom: 112,
    paddingHorizontal: mobileSpacing.default,
    paddingTop: mobileSpacing.default
  },
  sectionCopy: {
    flex: 1,
    gap: mobileSpacing.micro
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: mobileSpacing.default,
    justifyContent: "space-between"
  },
  shell: {
    flex: 1
  }
});
