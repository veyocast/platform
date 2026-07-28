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
import { useRouter } from "expo-router";
import { ArrowLeft, Mail } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useAuth } from "../../src/auth/auth-provider";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim()) {
      setError("Vul je e-mailadres in.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPassword(email);
      setSent(true);
    } catch {
      setError("De herstellink kon niet worden verstuurd.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <ScreenScrollView contentContainerStyle={styles.content}>
        <SurfaceCard style={styles.card}>
          <View style={styles.copy}>
            <AppText accessibilityRole="header" variant="section">
              Wachtwoord herstellen
            </AppText>
            <AppText muted>
              Je ontvangt alleen een link wanneer het account bestaat.
            </AppText>
          </View>
          {sent ? (
            <InlineAlert
              description="Open de link op dit apparaat om terug te keren naar VeyoCast Control."
              title="Controleer je e-mail"
              tone="success"
            />
          ) : null}
          {error ? (
            <InlineAlert
              description="Controleer je verbinding en probeer het opnieuw."
              title={error}
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
            value={email}
          />
          <Button loading={loading} onPress={() => void submit()}>
            Herstellink versturen
          </Button>
          <Button
            icon={<ArrowLeft color="#1A1917" size={20} />}
            onPress={() => router.back()}
            variant="ghost"
          >
            Terug naar inloggen
          </Button>
        </SurfaceCard>
      </ScreenScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  card: { gap: mobileSpacing.default },
  content: {
    alignSelf: "center",
    justifyContent: "center",
    maxWidth: 520,
    minHeight: "100%",
    width: "100%"
  },
  copy: { gap: mobileSpacing.micro }
});
