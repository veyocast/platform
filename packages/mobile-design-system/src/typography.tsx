import type { PropsWithChildren } from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { mobileType } from "./tokens";
import { useMobileTheme } from "./theme";

export type TextRole =
  | "body"
  | "bodyStrong"
  | "caption"
  | "cardTitle"
  | "display"
  | "label"
  | "micro"
  | "pageTitle"
  | "section";

export type AppTextProps = PropsWithChildren<
  Omit<TextProps, "role"> & {
    muted?: boolean;
    variant?: TextRole;
  }
>;

export function AppText({
  children,
  muted = false,
  variant = "body",
  style,
  ...props
}: AppTextProps) {
  const theme = useMobileTheme();
  const roleStyle = mobileType[variant] as TextStyle;
  return (
    <Text
      {...props}
      maxFontSizeMultiplier={1.8}
      style={[
        roleStyle,
        {
          color: muted ? theme.colors.secondaryInk : theme.colors.ink,
          fontFamily: "sans-serif"
        },
        style
      ]}
    >
      {children}
    </Text>
  );
}
