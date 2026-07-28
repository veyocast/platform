import { useState, type PropsWithChildren, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { minimumTouchTarget, mobileRadius, mobileSpacing } from "./tokens";
import { useMobileTheme } from "./theme";
import { AppText } from "./typography";

export type ButtonVariant = "danger" | "ghost" | "primary" | "secondary";
export type ButtonSize = "compact" | "default";

export type ButtonProps = PropsWithChildren<
  Omit<PressableProps, "children" | "style"> & {
    icon?: ReactNode;
    loading?: boolean;
    size?: ButtonSize;
    style?: StyleProp<ViewStyle>;
    variant?: ButtonVariant;
  }
>;

export function Button({
  children,
  disabled,
  icon,
  loading = false,
  size = "default",
  style,
  variant = "primary",
  ...props
}: ButtonProps) {
  const theme = useMobileTheme();
  const unavailable = Boolean(disabled || loading);
  const variantColors = {
    danger: {
      background: theme.colors.critical,
      border: theme.colors.critical,
      foreground: "#FFFFFF"
    },
    ghost: {
      background: "transparent",
      border: "transparent",
      foreground: theme.colors.ink
    },
    primary: {
      background: theme.colors.action,
      border: theme.colors.action,
      foreground: "#0A0A0A"
    },
    secondary: {
      background: theme.colors.raised,
      border: theme.colors.strongLine,
      foreground: theme.colors.ink
    }
  }[variant];

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      style={({ pressed }) => [
        styles.button,
        size === "compact" && styles.buttonCompact,
        {
          backgroundColor:
            pressed && variant === "primary"
              ? theme.colors.actionPressed
              : variantColors.background,
          borderColor: variantColors.border,
          opacity: unavailable ? 0.52 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }]
        },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantColors.foreground} />
      ) : (
        <>
          {icon}
          <AppText
            variant={size === "compact" ? "label" : "bodyStrong"}
            style={{ color: variantColors.foreground, textAlign: "center" }}
          >
            {children}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

export type IconButtonProps = Omit<ButtonProps, "children"> & {
  accessibilityLabel: string;
  icon: ReactNode;
};

export function IconButton({
  accessibilityLabel,
  disabled,
  icon,
  loading = false,
  style,
  variant = "ghost",
  ...props
}: IconButtonProps) {
  const theme = useMobileTheme();
  const unavailable = Boolean(disabled || loading);
  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      style={({ pressed }) => [
        styles.button,
        styles.iconButton,
        {
          backgroundColor:
            variant === "primary" ? theme.colors.action : "transparent",
          borderColor:
            variant === "secondary"
              ? theme.colors.strongLine
              : "transparent",
          opacity: unavailable ? 0.52 : pressed ? 0.72 : 1
        },
        style
      ]}
    >
      {loading ? <ActivityIndicator color={theme.colors.ink} /> : icon}
    </Pressable>
  );
}

export type FilterChipProps = Omit<PressableProps, "children"> & {
  label: string;
  selected?: boolean;
};

export function FilterChip({
  label,
  selected = false,
  ...props
}: FilterChipProps) {
  const theme = useMobileTheme();
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.ink : theme.colors.raised,
          borderColor: theme.colors.line,
          opacity: pressed ? 0.8 : 1
        }
      ]}
    >
      <AppText
        variant="label"
        style={{ color: selected ? theme.colors.canvas : theme.colors.ink }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export type SegmentedControlProps<T extends string> = {
  accessibilityLabel: string;
  onChange: (value: T) => void;
  options: ReadonlyArray<Readonly<{ label: string; value: T }>>;
  value: T;
};

export function SegmentedControl<T extends string>({
  accessibilityLabel,
  onChange,
  options,
  value
}: SegmentedControlProps<T>) {
  const theme = useMobileTheme();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={[styles.segmented, { backgroundColor: theme.colors.surface }]}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              selected && { backgroundColor: theme.colors.raised }
            ]}
          >
            <AppText variant="label">{option.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PressableSurface({
  children,
  style,
  ...props
}: PropsWithChildren<
  Omit<PressableProps, "children" | "style"> & {
    style?: StyleProp<ViewStyle>;
  }
>) {
  const theme = useMobileTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      {...props}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      style={({ pressed }) => [
        {
          borderColor: focused ? theme.colors.focus : theme.colors.line,
          opacity: pressed ? 0.82 : 1
        },
        style
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: mobileRadius.control,
    borderWidth: 1,
    flexDirection: "row",
    gap: mobileSpacing.compact,
    justifyContent: "center",
    minHeight: minimumTouchTarget,
    paddingHorizontal: mobileSpacing.inline
  },
  buttonCompact: {
    gap: mobileSpacing.micro,
    paddingHorizontal: mobileSpacing.compact
  },
  chip: {
    alignItems: "center",
    borderRadius: mobileRadius.chip,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: mobileSpacing.inline
  },
  iconButton: {
    minWidth: minimumTouchTarget,
    paddingHorizontal: mobileSpacing.compact
  },
  segment: {
    alignItems: "center",
    borderRadius: mobileRadius.chip,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: mobileSpacing.compact
  },
  segmented: {
    borderRadius: mobileRadius.control,
    flexDirection: "row",
    gap: mobileSpacing.micro,
    padding: mobileSpacing.micro
  }
});
