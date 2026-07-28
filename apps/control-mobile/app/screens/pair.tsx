import {
  AppShell,
  AppText,
  Button,
  InlineAlert,
  ScreenScrollView,
  SegmentedControl,
  SurfaceCard,
  TextField,
  mobileSpacing,
  useMobileTheme
} from "@veyocast/mobile-design-system";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import { Camera, Check, Keyboard, Link2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { mobileApi } from "../../src/api/mobile-api";
import { AppError } from "../../src/components/app-error";
import { useMobileScreens } from "../../src/query/use-mobile-data";
import { useTenant } from "../../src/tenant/tenant-provider";
import {
  normalizePairingCode,
  pairingCodeFromScan
} from "../../src/pairing/code";

type InputMode = "manual" | "scan";

export default function PairScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useMobileTheme();
  const screens = useMobileScreens();
  const { activeTenant } = useTenant();
  const [mode, setMode] = useState<InputMode>("manual");
  const [permission, requestPermission] = useCameraPermissions();
  const [screenId, setScreenId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const available =
    screens.data?.data.items.filter((screen) => screen.status === "pairing") ??
    [];

  async function claim() {
    if (!activeTenant || !screenId) {
      setError(new Error("Kies eerst het scherm dat je wilt koppelen."));
      return;
    }
    const normalized = normalizePairingCode(code);
    if (!/^[A-Z0-9]{6,12}$/.test(normalized)) {
      setError(new Error("Gebruik alle 6 tot 12 tekens van de Playercode."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await mobileApi.claimPairing(activeTenant.id, {
        code: normalized,
        idempotencyKey: Crypto.randomUUID(),
        screenId
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["screens", activeTenant.id]
        }),
        queryClient.invalidateQueries({
          queryKey: ["cockpit", activeTenant.id]
        })
      ]);
      router.replace(`/screens/${screenId}`);
    } catch (claimError) {
      setError(claimError);
      setScanned(false);
    } finally {
      setBusy(false);
    }
  }

  function handleScan(data: string) {
    if (scanned) return;
    const parsed = pairingCodeFromScan(data);
    if (!parsed) {
      setError(
        new Error(
          "Deze QR-code bevat geen geldige VeyoCast-koppelcode en is niet gebruikt."
        )
      );
      setScanned(true);
      return;
    }
    setCode(parsed);
    setScanned(true);
    setMode("manual");
  }

  return (
    <AppShell>
      <ScreenScrollView>
        <View style={styles.copy}>
          <AppText accessibilityRole="header" variant="section">
            Koppel een fysieke Player
          </AppText>
          <AppText muted>
            Kies eerst een bestaand schermobject. De tijdelijke code bevat
            nooit een device- of installatiesecret.
          </AppText>
        </View>
        <View style={styles.list}>
          {available.map((screen) => {
            const selected = screen.id === screenId;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={screen.id}
                onPress={() => setScreenId(screen.id)}
              >
                <SurfaceCard style={styles.screenChoice}>
                  <View style={styles.choiceCopy}>
                    <AppText variant="cardTitle">{screen.name}</AppText>
                    <AppText muted>{screen.location ?? "Geen locatie"}</AppText>
                  </View>
                  {selected ? (
                    <Check color={theme.colors.success} size={24} />
                  ) : null}
                </SurfaceCard>
              </Pressable>
            );
          })}
          {!available.length && !screens.isLoading ? (
            <InlineAlert
              description="Maak eerst een schermobject in Control. Bestaande content en planning worden daarna aan dat scherm gekoppeld."
              title="Geen ongekoppelde schermen"
              tone="warning"
            />
          ) : null}
        </View>
        <SegmentedControl
          accessibilityLabel="Koppelcode invoeren"
          onChange={setMode}
          options={[
            { label: "Handmatig", value: "manual" },
            { label: "QR scannen", value: "scan" }
          ]}
          value={mode}
        />
        {mode === "scan" ? (
          permission?.granted ? (
            <View style={styles.cameraFrame}>
              <CameraView
                barcodeScannerSettings={{
                  barcodeTypes: ["qr"]
                }}
                onBarcodeScanned={({ data }) => handleScan(data)}
                style={StyleSheet.absoluteFill}
              />
            </View>
          ) : (
            <Button
              icon={<Camera color="#0A0A0A" size={20} />}
              onPress={() => void requestPermission()}
            >
              Camera toestaan
            </Button>
          )
        ) : (
          <TextField
            autoCapitalize="characters"
            autoCorrect={false}
            label="Koppelcode"
            leading={<Keyboard color={theme.colors.secondaryInk} size={20} />}
            maxLength={12}
            onChangeText={(value) => setCode(normalizePairingCode(value))}
            placeholder="ABC123"
            value={code}
          />
        )}
        {error ? <AppError error={error} /> : null}
        <Button
          disabled={!screenId || code.length < 6}
          icon={<Link2 color="#0A0A0A" size={20} />}
          loading={busy}
          onPress={() => void claim()}
        >
          Scherm koppelen
        </Button>
      </ScreenScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  cameraFrame: {
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
    width: "100%"
  },
  choiceCopy: { flex: 1, gap: mobileSpacing.micro },
  copy: { gap: mobileSpacing.micro },
  list: { gap: mobileSpacing.compact },
  screenChoice: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.inline
  }
});
