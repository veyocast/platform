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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Linking, StyleSheet, Switch, View } from "react-native";

import { mobileApi } from "../../src/api/mobile-api";
import { AppError } from "../../src/components/app-error";
import { useTenant } from "../../src/tenant/tenant-provider";

export default function AccountScreen() {
  const { session } = useTenant();
  const queryClient = useQueryClient();
  const requests = useQuery({
    queryFn: mobileApi.deletionRequests,
    queryKey: ["account-deletion-requests"]
  });
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<number | null>(null);

  async function requestDeletion() {
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const result = await mobileApi.requestAccountDeletion(
        reason.trim() || undefined
      );
      setSuccess(result.requestNumber);
      setReason("");
      setConfirmed(false);
      await queryClient.invalidateQueries({
        queryKey: ["account-deletion-requests"]
      });
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <ScreenScrollView>
        <SurfaceCard style={styles.card}>
          <AppText variant="cardTitle">{session?.userName}</AppText>
          <AppText muted>{session?.email}</AppText>
        </SurfaceCard>
        <View style={styles.copy}>
          <AppText accessibilityRole="header" variant="section">
            Account verwijderen
          </AppText>
          <AppText muted>
            Je verzoek wordt gelogd en beoordeeld. Het account blijft
            beschikbaar totdat de status ‘uitgevoerd’ is.
          </AppText>
        </View>
        {success ? (
          <InlineAlert
            description={`Bewaar verzoeknummer ${success}. Je ziet de voortgang hieronder.`}
            title="Verwijderverzoek ontvangen"
            tone="success"
          />
        ) : null}
        {error ? <AppError error={error} /> : null}
        <TextField
          label="Toelichting (optioneel)"
          maxLength={1000}
          multiline
          onChangeText={setReason}
          value={reason}
        />
        <SurfaceCard style={styles.confirm}>
          <View style={styles.confirmCopy}>
            <AppText variant="bodyStrong">
              Ik begrijp dat dit een formeel verwijderverzoek is
            </AppText>
            <AppText muted variant="caption">
              Organisatiegegevens kunnen bewaarplichten of een aparte
              beheerder vereisen.
            </AppText>
          </View>
          <Switch
            accessibilityLabel="Verwijderverzoek bevestigen"
            onValueChange={setConfirmed}
            value={confirmed}
          />
        </SurfaceCard>
        <Button
          disabled={!confirmed}
          icon={<Trash2 color="#FFFFFF" size={20} />}
          loading={busy}
          onPress={() => void requestDeletion()}
          variant="danger"
        >
          Verwijderverzoek indienen
        </Button>
        <Button
          icon={<ExternalLink color="#1A1917" size={20} />}
          onPress={() =>
            void Linking.openURL("https://veyocast.nl/account-verwijderen")
          }
          variant="secondary"
        >
          Publieke verwijderpagina
        </Button>
        <View style={styles.requests}>
          <AppText accessibilityRole="header" variant="section">
            Eerdere verzoeken
          </AppText>
          {requests.error ? (
            <AppError
              error={requests.error}
              onRetry={() => void requests.refetch()}
            />
          ) : (
            requests.data?.map((request) => (
              <SurfaceCard key={request.id} style={styles.card}>
                <AppText variant="cardTitle">
                  Verzoek {request.requestNumber}
                </AppText>
                <AppText muted>Status: {statusLabel(request.status)}</AppText>
                <AppText muted variant="caption">
                  Aangevraagd op{" "}
                  {new Intl.DateTimeFormat("nl-NL", {
                    dateStyle: "medium"
                  }).format(new Date(request.requestedAt))}
                </AppText>
              </SurfaceCard>
            ))
          )}
        </View>
      </ScreenScrollView>
    </AppShell>
  );
}

function statusLabel(status: string) {
  return (
    {
      approved: "goedgekeurd",
      blocked: "geblokkeerd",
      cancelled: "geannuleerd",
      executed: "uitgevoerd",
      legal_review: "juridische beoordeling",
      requested: "ontvangen"
    }[status] ?? status
  );
}

const styles = StyleSheet.create({
  card: { gap: mobileSpacing.micro },
  confirm: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.default
  },
  confirmCopy: { flex: 1, gap: mobileSpacing.micro },
  copy: { gap: mobileSpacing.micro },
  requests: { gap: mobileSpacing.inline }
});
