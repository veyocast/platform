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
  useMobileTheme
} from "@veyocast/mobile-design-system";
import type { MobileEngageWorkspace } from "@veyocast/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { ExternalLink, Play, Square } from "lucide-react-native";
import { useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";

import { mobileApi } from "../../src/api/mobile-api";
import { AppError } from "../../src/components/app-error";
import { readMobileRuntimeConfig } from "../../src/config/runtime";
import { useTenant } from "../../src/tenant/tenant-provider";

type Campaign = MobileEngageWorkspace["campaigns"][number];

export default function EngageScreen() {
  const { activeTenant } = useTenant();
  const queryClient = useQueryClient();
  const theme = useMobileTheme();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const query = useQuery({
    enabled: Boolean(activeTenant),
    queryFn: () => mobileApi.engage(activeTenant!.id),
    queryKey: ["engage", activeTenant?.id],
    refetchInterval: 15_000
  });
  const canWrite =
    activeTenant?.capabilities.includes("tenant.dynamic_slide.write") ?? false;

  async function transition(campaign: Campaign, targetStatus: "closed" | "live") {
    if (!activeTenant) return;
    setPending(`${campaign.id}:${targetStatus}`);
    setMessage(null);
    setError(null);
    try {
      const result = await mobileApi.transitionEngage(activeTenant.id, {
        campaignId: campaign.id,
        idempotencyKey: Crypto.randomUUID(),
        targetStatus
      });
      setMessage(
        result.status === "live"
          ? `${campaign.title} staat nu live.`
          : `${campaign.title} is gesloten; nieuwe stemmen worden geweigerd.`
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["engage", activeTenant.id] }),
        queryClient.invalidateQueries({ queryKey: ["cockpit", activeTenant.id] })
      ]);
    } catch (transitionError) {
      setError(transitionError);
    } finally {
      setPending(null);
    }
  }

  function confirmTransition(
    campaign: Campaign,
    targetStatus: "closed" | "live"
  ) {
    Alert.alert(
      targetStatus === "live" ? "Campagne live zetten?" : "Campagne sluiten?",
      targetStatus === "live"
        ? "De publieke stemlink wordt direct actief. Controleer titel, opties en resultaatweergave eerst in Control."
        : "Nieuwe stemmen worden direct geweigerd. Bestaande resultaten en audit blijven behouden.",
      [
        { style: "cancel", text: "Annuleren" },
        {
          onPress: () => void transition(campaign, targetStatus),
          style: targetStatus === "closed" ? "destructive" : "default",
          text: targetStatus === "live" ? "Live zetten" : "Sluiten"
        }
      ]
    );
  }

  async function openVoting(campaign: Campaign) {
    const runtime = readMobileRuntimeConfig();
    if (!runtime.config) {
      setError(new Error(runtime.error ?? "De Control-origin ontbreekt."));
      return;
    }
    await Linking.openURL(
      `${runtime.config.controlOrigin}/engage/${campaign.publicId}`
    );
  }

  return (
    <AppShell>
      <ScreenScrollView>
        <View style={styles.intro}>
          <AppText accessibilityRole="header" variant="section">
            Engage livebediening
          </AppText>
          <AppText muted>
            Start of sluit een voorbereide poll of Man of the Match-campagne.
            Campagnes maken en inhoud wijzigen doe je bewust in Control.
          </AppText>
        </View>
        {message ? (
          <InlineAlert
            description="De status is server-side vastgelegd en geaudit."
            title={message}
            tone="success"
          />
        ) : null}
        {error ? <AppError error={error} /> : null}
        {query.isLoading ? (
          <View style={styles.list}>
            <Skeleton height={170} />
            <Skeleton height={170} />
          </View>
        ) : query.error ? (
          <AppError error={query.error} onRetry={() => void query.refetch()} />
        ) : !query.data?.enabled ? (
          <InlineAlert
            description="Een beheerder kan Engage alleen gebruiken nadat de gecontroleerde tenantfeature is vrijgegeven."
            title="Engage is niet actief"
            tone="info"
          />
        ) : query.data.campaigns.length ? (
          <View style={styles.list}>
            {query.data.campaigns.map((campaign) => {
              const status = statusPresentation[campaign.status];
              const canStart =
                canWrite &&
                (campaign.status === "draft" || campaign.status === "scheduled");
              const canClose =
                canWrite &&
                (campaign.status === "live" || campaign.status === "scheduled");
              return (
                <SurfaceCard key={campaign.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardCopy}>
                      <AppText variant="cardTitle">{campaign.title}</AppText>
                      <AppText muted>{campaign.question}</AppText>
                    </View>
                    <StatusBadge label={status.label} tone={status.tone} />
                  </View>
                  <View style={styles.metadata}>
                    <AppText muted variant="label">
                      {campaign.kind === "motm" ? "Man of the Match" : "Poll"}
                    </AppText>
                    <AppText muted variant="label">
                      {campaign.optionCount} opties · {campaign.totalVotes} stemmen
                    </AppText>
                  </View>
                  <View style={styles.actions}>
                    {canStart ? (
                      <Button
                        icon={<Play color={theme.colors.ink} size={18} />}
                        loading={pending === `${campaign.id}:live`}
                        onPress={() => confirmTransition(campaign, "live")}
                        size="compact"
                      >
                        Live zetten
                      </Button>
                    ) : null}
                    {canClose ? (
                      <Button
                        icon={<Square color={theme.colors.critical} size={18} />}
                        loading={pending === `${campaign.id}:closed`}
                        onPress={() => confirmTransition(campaign, "closed")}
                        size="compact"
                        variant="dangerQuiet"
                      >
                        Sluiten
                      </Button>
                    ) : null}
                    {(campaign.status === "live" || campaign.status === "closed") ? (
                      <Button
                        icon={<ExternalLink color={theme.colors.ink} size={18} />}
                        onPress={() => void openVoting(campaign)}
                        size="compact"
                        variant="secondary"
                      >
                        Stemomgeving
                      </Button>
                    ) : null}
                  </View>
                </SurfaceCard>
              );
            })}
          </View>
        ) : (
          <InlineAlert
            description="Maak eerst een poll of Man of the Match-campagne in Control. Daarna kun je hem hier live bedienen."
            title="Nog geen campagnes"
            tone="info"
          />
        )}
        {!canWrite && query.data?.enabled ? (
          <InlineAlert
            description="Je rol mag campagnestatussen bekijken, maar niet wijzigen."
            title="Alleen-lezen"
            tone="info"
          />
        ) : null}
      </ScreenScrollView>
    </AppShell>
  );
}

const statusPresentation = {
  archived: { label: "Gearchiveerd", tone: "neutral" },
  closed: { label: "Gesloten", tone: "neutral" },
  draft: { label: "Concept", tone: "neutral" },
  live: { label: "Live", tone: "success" },
  scheduled: { label: "Gepland", tone: "info" }
} as const;

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.compact
  },
  card: { gap: mobileSpacing.inline },
  cardCopy: { flex: 1, gap: mobileSpacing.micro },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: mobileSpacing.inline
  },
  intro: { gap: mobileSpacing.micro },
  list: { gap: mobileSpacing.compact },
  metadata: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.inline
  }
});

