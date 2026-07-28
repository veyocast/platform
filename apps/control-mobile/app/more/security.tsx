import {
  AppShell,
  AppText,
  InlineAlert,
  ScreenScrollView,
  SurfaceCard,
  mobileSpacing
} from "@veyocast/mobile-design-system";
import { Fingerprint } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

import { useAppLock } from "../../src/auth/app-lock-provider";

export default function SecurityScreen() {
  const { available, enabled, setEnabled } = useAppLock();
  const [failed, setFailed] = useState(false);
  return (
    <AppShell>
      <ScreenScrollView>
        <View style={styles.copy}>
          <AppText accessibilityRole="header" variant="section">
            Lokale appbeveiliging
          </AppText>
          <AppText muted>
            Supabase-sessietokens blijven altijd versleuteld in de beveiligde
            opslag van dit apparaat.
          </AppText>
        </View>
        {!available ? (
          <InlineAlert
            description="Stel eerst biometrie of een apparaatcode in via Android."
            title="Biometrie niet beschikbaar"
            tone="warning"
          />
        ) : null}
        {failed ? (
          <InlineAlert
            description="De instelling is niet gewijzigd."
            title="Identiteit niet bevestigd"
            tone="critical"
          />
        ) : null}
        <SurfaceCard style={styles.setting}>
          <Fingerprint color="#1A1917" size={26} />
          <View style={styles.settingCopy}>
            <AppText variant="cardTitle">Biometrisch ontgrendelen</AppText>
            <AppText muted>
              Vergrendel Control wanneer de app naar de achtergrond gaat.
            </AppText>
          </View>
          <Switch
            accessibilityLabel="Biometrisch ontgrendelen"
            disabled={!available}
            onValueChange={(next) => {
              void setEnabled(next).then((changed) => setFailed(!changed));
            }}
            value={enabled}
          />
        </SurfaceCard>
      </ScreenScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  copy: { gap: mobileSpacing.micro },
  setting: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.inline
  },
  settingCopy: { flex: 1, gap: mobileSpacing.micro }
});
