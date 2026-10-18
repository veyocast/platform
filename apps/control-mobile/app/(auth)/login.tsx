import {
  AppShell,
  AppText,
  Button,
  InlineAlert,
  ScreenScrollView,
  SurfaceCard,
  TextField,
  mobileSpacing
} from "@veyocast/mobile-design-system";
import { Redirect, useRouter } from "expo-router";
import { LockKeyhole, LogIn, Mail } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";

import { useAuth } from "../../src/auth/auth-provider";
import { BrandMark } from "../../src/components/brand-mark";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, session, sessionError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError("Vul je e-mailadres en wachtwoord in.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch {
      setError(
        "Inloggen is niet gelukt. Controleer je gegevens, MFA-status en verbinding."
      );
    } finally {
      setLoading(false);
    }
  }

  if (session) return <Redirect href="/(auth)/mfa" />;
  return (
    <AppShell>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScreenScrollView contentContainerStyle={styles.content}>
          <View style={styles.brand}>
            <BrandMark />
            <View style={styles.brandCopy}>
              <AppText variant="display">VeyoCast Control</AppText>
              <AppText muted>
                Beheer schermen, content en publicaties vanaf je telefoon.
              </AppText>
            </View>
          </View>
          <SurfaceCard style={styles.form}>
            <View style={styles.intro}>
              <AppText accessibilityRole="header" variant="section">
                Welkom terug
              </AppText>
              <AppText muted>
                Gebruik hetzelfde account als in VeyoCast Control.
              </AppText>
            </View>
            {sessionError || error ? (
              <InlineAlert
                description="Je gegevens zijn niet gewijzigd."
                title={sessionError ?? error ?? "Inloggen is niet gelukt."}
                tone="critical"
              />
            ) : null}
            <TextField
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              label="E-mailadres"
              leading={<Mail color="#6C6861" size={20} />}
              onChangeText={setEmail}
              returnKeyType="next"
              value={email}
            />
            <TextField
              autoCapitalize="none"
              autoComplete="current-password"
              label="Wachtwoord"
              leading={<LockKeyhole color="#6C6861" size={20} />}
              onChangeText={setPassword}
              onSubmitEditing={() => void submit()}
              returnKeyType="done"
              secureTextEntry
              value={password}
            />
            <Button
              icon={<LogIn color="#0A0A0A" size={20} />}
              loading={loading}
              onPress={() => void submit()}
            >
              Inloggen
            </Button>
            <Button
              onPress={() => router.push("/(auth)/forgot-password")}
              variant="ghost"
            >
              Wachtwoord vergeten
            </Button>
          </SurfaceCard>
        </ScreenScrollView>
      </KeyboardAvoidingView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: "center",
    gap: mobileSpacing.default
  },
  brandCopy: {
    alignItems: "center",
    gap: mobileSpacing.compact
  },
  content: {
    alignSelf: "center",
    justifyContent: "center",
    maxWidth: 520,
    minHeight: "100%",
    width: "100%"
  },
  flex: { flex: 1 },
  form: {
    gap: mobileSpacing.default
  },
  intro: {
    gap: mobileSpacing.micro
  }
});
