import {
  AppText,
  Button,
  SurfaceCard,
  useMobileTheme
} from "@veyocast/mobile-design-system";
import { Fingerprint } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { useAppLock } from "../auth/app-lock-provider";
import { BrandMark } from "./brand-mark";

export function AppLock() {
  const { locked, unlock } = useAppLock();
  const theme = useMobileTheme();
  if (!locked) return null;
  return (
    <View
      accessibilityViewIsModal
      style={[styles.overlay, { backgroundColor: theme.colors.canvas }]}
    >
      <SurfaceCard style={styles.card}>
        <BrandMark />
        <AppText accessibilityRole="header" variant="section">
          VeyoCast Control is vergrendeld
        </AppText>
        <AppText muted style={styles.center}>
          Bevestig je identiteit om organisaties en schermstatus te openen.
        </AppText>
        <Button
          icon={<Fingerprint color="#0A0A0A" size={22} />}
          onPress={() => void unlock()}
        >
          Ontgrendelen
        </Button>
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: 20,
    maxWidth: 420,
    width: "100%"
  },
  center: {
    textAlign: "center"
  },
  overlay: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    padding: 24,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1000
  }
});
