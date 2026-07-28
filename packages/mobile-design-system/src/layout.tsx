import type { PropsWithChildren, ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
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
  const { width } = useWindowDimensions();
  const horizontalPadding =
    width >= 1200
      ? mobileSpacing.major
      : width >= 768
        ? mobileSpacing.section
        : width >= 390
          ? mobileSpacing.card
          : mobileSpacing.default;
  return (
    <ScrollView
      {...props}
      automaticallyAdjustContentInsets
      contentContainerStyle={[
        styles.screenContent,
        { paddingHorizontal: horizontalPadding },
        contentContainerStyle
      ]}
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
    padding: mobileSpacing.default,
    shadowColor: "#000000",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.035,
    shadowRadius: 10
  },
  screenContent: {
    alignSelf: "center",
    gap: mobileSpacing.section,
    maxWidth: 1180,
    paddingBottom: mobileSpacing.large,
    paddingTop: mobileSpacing.section,
    width: "100%"
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
