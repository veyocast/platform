import { forwardRef, useState, type ReactNode } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps
} from "react-native";
import { minimumTouchTarget, mobileRadius, mobileSpacing } from "./tokens";
import { useMobileTheme } from "./theme";
import { AppText } from "./typography";

export type TextFieldProps = TextInputProps & {
  error?: string;
  helper?: string;
  label: string;
  leading?: ReactNode;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { error, helper, label, leading, style, ...props },
  ref
) {
  const theme = useMobileTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <View
        style={[
          styles.inputFrame,
          {
            backgroundColor: theme.colors.raised,
            borderColor: error
              ? theme.colors.critical
              : focused
                ? theme.colors.focus
                : theme.colors.strongLine
          }
        ]}
      >
        {leading}
        <TextInput
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          placeholderTextColor={theme.colors.mutedInk}
          ref={ref}
          style={[
            styles.input,
            { color: theme.colors.ink },
            style
          ]}
        />
      </View>
      {error ? (
        <AppText accessibilityRole="alert" variant="caption" style={{ color: theme.colors.critical }}>
          {error}
        </AppText>
      ) : helper ? (
        <AppText muted variant="caption">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
});

export function SearchField(props: Omit<TextFieldProps, "label">) {
  return (
    <TextField
      {...props}
      accessibilityLabel={props.accessibilityLabel ?? "Zoeken"}
      label="Zoeken"
      returnKeyType="search"
    />
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    minHeight: minimumTouchTarget,
    paddingVertical: 0
  },
  inputFrame: {
    alignItems: "center",
    borderRadius: mobileRadius.control,
    borderWidth: 1,
    flexDirection: "row",
    gap: mobileSpacing.compact,
    minHeight: minimumTouchTarget,
    paddingHorizontal: mobileSpacing.inline
  }
});
