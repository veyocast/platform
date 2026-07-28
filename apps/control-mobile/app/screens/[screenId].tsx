import {
  AppShell,
  AppText,
  Button,
  InlineAlert,
  ScreenScrollView,
  Skeleton,
  StatusBadge,
  SurfaceCard,
  mobileSpacing,
} from "@veyocast/mobile-design-system";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams } from "expo-router";
import {
  DatabaseZap,
  Link2Off,
  RefreshCcw,
  RotateCw
} from "lucide-react-native";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import {
  MobileApiError,
  mobileApi
} from "../../src/api/mobile-api";
import { AppError } from "../../src/components/app-error";
import { useMobileScreens } from "../../src/query/use-mobile-data";
import { useTenant } from "../../src/tenant/tenant-provider";

type Command =
  | "CLEAR_PLAYER_CACHE"
  | "FORCE_UNPAIR"
  | "RECOVER_PAIRING"
  | "RELOAD_PLAYER";

export default function ScreenDetailScreen() {
  const params = useLocalSearchParams<{ screenId: string }>();
  const screens = useMobileScreens();
  const { activeTenant } = useTenant();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Command | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const screen = screens.data?.data.items.find(
    (item) => item.id === params.screenId
  );

  async function run(commandType: Command) {
    if (!activeTenant || !screen) return;
    setPending(commandType);
    setError(null);
    setMessage(null);
    try {
      const command = await mobileApi.command(activeTenant.id, {
        commandType,
        idempotencyKey: Crypto.randomUUID(),
        screenId: screen.id,
        ttlSeconds: commandType === "RELOAD_PLAYER" ? 300 : 900
      });
      setMessage(
        `${commandLabel(commandType)} staat klaar. Status: ${command.status}.`
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["screens", activeTenant.id]
        }),
        queryClient.invalidateQueries({
          queryKey: ["cockpit", activeTenant.id]
        })
      ]);
    } catch (commandError) {
      setError(commandError);
    } finally {
      setPending(null);
    }
  }

  function confirm(commandType: Command) {
    const destructive = commandType === "FORCE_UNPAIR";
    Alert.alert(
      commandLabel(commandType),
      destructive
        ? "De schermbinding en oude tokens worden ingetrokken. Het schermobject, playlists, planning en historie blijven behouden."
        : commandType === "RECOVER_PAIRING"
          ? "De Player haalt een nieuwe credential op. Scherm, tenant, playlist en planning blijven behouden."
          : "De koppeling en schermconfiguratie blijven behouden.",
      [
        { style: "cancel", text: "Annuleren" },
        {
          onPress: () => void run(commandType),
          style: destructive ? "destructive" : "default",
          text: destructive ? "Ontkoppelen" : "Uitvoeren"
        }
      ]
    );
  }

  if (screens.isLoading) {
    return (
      <AppShell>
        <ScreenScrollView>
          <Skeleton height={180} />
        </ScreenScrollView>
      </AppShell>
    );
  }
  if (screens.error) {
    return (
      <AppShell>
        <ScreenScrollView>
          <AppError
            error={screens.error}
            onRetry={() => void screens.refetch()}
          />
        </ScreenScrollView>
      </AppShell>
    );
  }
  if (!screen) {
    return (
      <AppShell>
        <ScreenScrollView>
          <InlineAlert
            description="Het scherm bestaat niet binnen de gekozen organisatie of je hebt geen toegang."
            title="Scherm niet gevonden"
            tone="critical"
          />
        </ScreenScrollView>
      </AppShell>
    );
  }

  const status = statusPresentation[screen.status];
  return (
    <AppShell>
      <ScreenScrollView>
        <SurfaceCard style={styles.hero}>
          <View style={styles.heroHeader}>
            <View style={styles.copy}>
              <AppText accessibilityRole="header" variant="pageTitle">
                {screen.name}
              </AppText>
              <AppText muted>{screen.location ?? "Geen locatie"}</AppText>
            </View>
            <StatusBadge label={status.label} tone={status.tone} />
          </View>
          <View style={styles.metadata}>
            <Metadata label="Player-versie" value={screen.appVersion ?? "Onbekend"} />
            <Metadata
              label="Laatste contact"
              value={
                screen.lastSeenAt
                  ? new Intl.DateTimeFormat("nl-NL", {
                      dateStyle: "short",
                      timeStyle: "short"
                    }).format(new Date(screen.lastSeenAt))
                  : "Nog niet gemeld"
              }
            />
            <Metadata
              label="Actieve release"
              value={screen.activeReleaseLabel ?? "Niet toegewezen"}
            />
          </View>
        </SurfaceCard>
        {screen.lastErrorCode ? (
          <InlineAlert
            description="Open herstel alleen wanneer retry of lokale diagnose het probleem niet oplost."
            title={`Playerfout: ${screen.lastErrorCode}`}
            tone="critical"
          />
        ) : null}
        {message ? (
          <InlineAlert
            description="De Player bevestigt de opdracht via het bestaande commandkanaal."
            title={message}
            tone="success"
          />
        ) : null}
        {error ? <AppError error={error} /> : null}
        <View style={styles.section}>
          <View style={styles.copy}>
            <AppText accessibilityRole="header" variant="section">
              Veilige Playeracties
            </AppText>
            <AppText muted>
              Elke opdracht heeft een unieke nonce en verloopt automatisch.
            </AppText>
          </View>
          <Button
            icon={<RotateCw color="#1A1917" size={20} />}
            loading={pending === "RELOAD_PLAYER"}
            onPress={() => confirm("RELOAD_PLAYER")}
            variant="secondary"
          >
            Player opnieuw laden
          </Button>
          <Button
            icon={<RefreshCcw color="#1A1917" size={20} />}
            loading={pending === "RECOVER_PAIRING"}
            onPress={() => confirm("RECOVER_PAIRING")}
            variant="secondary"
          >
            Koppeling herstellen
          </Button>
          <Button
            icon={<DatabaseZap color="#1A1917" size={20} />}
            loading={pending === "CLEAR_PLAYER_CACHE"}
            onPress={() => confirm("CLEAR_PLAYER_CACHE")}
            variant="secondary"
          >
            Lokale cache herstellen
          </Button>
          <Button
            icon={<Link2Off color="#FFFFFF" size={20} />}
            loading={pending === "FORCE_UNPAIR"}
            onPress={() => confirm("FORCE_UNPAIR")}
            variant="danger"
          >
            Ontkoppelen en nieuwe code
          </Button>
        </View>
        {error instanceof MobileApiError ? (
          <AppText muted variant="caption">
            Supportcode: {error.requestId ?? "niet beschikbaar"}
          </AppText>
        ) : null}
      </ScreenScrollView>
    </AppShell>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metadataItem}>
      <AppText muted variant="label">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

function commandLabel(command: Command) {
  return {
    CLEAR_PLAYER_CACHE: "Lokale cache herstellen",
    FORCE_UNPAIR: "Ontkoppelen en nieuwe code",
    RECOVER_PAIRING: "Koppeling herstellen",
    RELOAD_PLAYER: "Player opnieuw laden"
  }[command];
}

const statusPresentation = {
  attention: { label: "Aandacht", tone: "critical" },
  offline: { label: "Offline", tone: "warning" },
  online: { label: "Online", tone: "success" },
  pairing: { label: "Te koppelen", tone: "info" },
  unknown: { label: "Onbekend", tone: "neutral" }
} as const;

const styles = StyleSheet.create({
  copy: { flex: 1, gap: mobileSpacing.micro },
  hero: { gap: mobileSpacing.default },
  heroHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: mobileSpacing.default
  },
  metadata: { gap: mobileSpacing.inline },
  metadataItem: { gap: mobileSpacing.micro },
  section: { gap: mobileSpacing.compact }
});
