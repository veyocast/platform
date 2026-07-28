import {
  AppShell,
  AppText,
  Button,
  InlineAlert,
  ScreenScrollView,
  Skeleton,
  SurfaceCard,
  mobileSpacing
} from "@veyocast/mobile-design-system";
import type { MobileNotificationPreferences } from "@veyocast/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, BellRing } from "lucide-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

import { mobileApi } from "../../src/api/mobile-api";
import { AppError } from "../../src/components/app-error";
import {
  disablePushNotifications,
  enablePushNotifications,
  hasPushRegistration
} from "../../src/notifications/registration";
import { useTenant } from "../../src/tenant/tenant-provider";

type Preferences = MobileNotificationPreferences;

export default function NotificationsScreen() {
  const { activeTenant } = useTenant();
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: Boolean(activeTenant),
    queryFn: () => mobileApi.notificationPreferences(activeTenant!.id),
    queryKey: ["notification-preferences", activeTenant?.id]
  });
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (query.data) setPreferences(query.data);
  }, [query.data]);
  useEffect(() => {
    void hasPushRegistration().then(setRegistered);
  }, []);

  async function toggleMaster(next: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (next) {
        await enablePushNotifications();
        setMessage("Dit apparaat ontvangt nu de gekozen VeyoCast-meldingen.");
      } else {
        await disablePushNotifications();
        setMessage("Dit apparaat ontvangt geen VeyoCast-pushmeldingen meer.");
      }
      setRegistered(next);
    } catch (toggleError) {
      setError(toggleError);
    } finally {
      setBusy(false);
    }
  }

  async function update<K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ) {
    if (!activeTenant || !preferences) return;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setError(null);
    try {
      await mobileApi.updateNotificationPreferences(activeTenant.id, next);
      await queryClient.invalidateQueries({
        queryKey: ["notification-preferences", activeTenant.id]
      });
    } catch (updateError) {
      setPreferences(preferences);
      setError(updateError);
    }
  }

  return (
    <AppShell>
      <ScreenScrollView>
        <View style={styles.copy}>
          <AppText accessibilityRole="header" variant="section">
            Pushmeldingen
          </AppText>
          <AppText muted>
            Toestemming wordt pas aan Android gevraagd wanneer je meldingen
            hieronder inschakelt.
          </AppText>
        </View>
        {message ? (
          <InlineAlert
            description="Je kunt dit altijd weer wijzigen."
            title={message}
            tone="success"
          />
        ) : null}
        {error ? <AppError error={error} /> : null}
        <SurfaceCard style={styles.row}>
          {registered ? (
            <BellRing color="#18794E" size={24} />
          ) : (
            <BellOff color="#6C6861" size={24} />
          )}
          <View style={styles.rowCopy}>
            <AppText variant="cardTitle">Meldingen op dit apparaat</AppText>
            <AppText muted>
              {registered ? "Ingeschakeld" : "Uitgeschakeld"}
            </AppText>
          </View>
          <Switch
            accessibilityLabel="Meldingen op dit apparaat"
            disabled={busy}
            onValueChange={(next) => void toggleMaster(next)}
            value={registered}
          />
        </SurfaceCard>
        {query.isLoading || !preferences ? (
          <Skeleton height={240} />
        ) : query.error ? (
          <AppError error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <View style={styles.list}>
            <PreferenceRow
              label="Scherm offline"
              onChange={(value) => void update("screenOffline", value)}
              value={preferences.screenOffline}
            />
            <PreferenceRow
              label="Playerfout"
              onChange={(value) => void update("playerError", value)}
              value={preferences.playerError}
            />
            <PreferenceRow
              label="Publicatie afgerond"
              onChange={(value) => void update("publicationCompleted", value)}
              value={preferences.publicationCompleted}
            />
            <PreferenceRow
              label="Mediaverwerking mislukt"
              onChange={(value) => void update("mediaFailed", value)}
              value={preferences.mediaFailed}
            />
            <PreferenceRow
              label="Goedkeuring gevraagd"
              onChange={(value) => void update("approvalRequested", value)}
              value={preferences.approvalRequested}
            />
          </View>
        )}
        {!registered ? (
          <Button
            disabled={busy}
            onPress={() => void toggleMaster(true)}
            variant="secondary"
          >
            Meldingen inschakelen
          </Button>
        ) : null}
      </ScreenScrollView>
    </AppShell>
  );
}

function PreferenceRow({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <SurfaceCard style={styles.row}>
      <View style={styles.rowCopy}>
        <AppText variant="bodyStrong">{label}</AppText>
      </View>
      <Switch accessibilityLabel={label} onValueChange={onChange} value={value} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  copy: { gap: mobileSpacing.micro },
  list: { gap: mobileSpacing.compact },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.inline
  },
  rowCopy: { flex: 1, gap: mobileSpacing.micro }
});
