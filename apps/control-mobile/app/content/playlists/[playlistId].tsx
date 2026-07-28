import type { MobilePlaylistMutationRequest } from "@veyocast/contracts";
import {
  AppShell,
  AppText,
  Button,
  InlineAlert,
  ScreenScrollView,
  SectionHeader,
  StatusBadge,
  SurfaceCard,
  TextField,
  mobileSpacing,
  useMobileTheme
} from "@veyocast/mobile-design-system";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ImagePlus,
  Send,
  Trash2
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { mobileApi } from "../../../src/api/mobile-api";
import { AppError } from "../../../src/components/app-error";
import { useTenant } from "../../../src/tenant/tenant-provider";

export default function PlaylistDetailScreen() {
  const { playlistId } = useLocalSearchParams<{ playlistId: string }>();
  const { activeTenant } = useTenant();
  const queryClient = useQueryClient();
  const theme = useMobileTheme();
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const query = useQuery({
    enabled: Boolean(activeTenant && playlistId),
    queryFn: () => {
      if (!activeTenant || !playlistId) throw new Error("Playlist ontbreekt.");
      return mobileApi.playlist(activeTenant.id, playlistId);
    },
    queryKey: ["playlist", activeTenant?.id, playlistId]
  });
  const playlist = query.data;
  const selectedTargets = useMemo(
    () =>
      playlist?.publishTargets.filter((target) =>
        selectedScreens.includes(target.id)
      ) ?? [],
    [playlist, selectedScreens]
  );

  async function mutate(input: MobilePlaylistMutationRequest) {
    if (!activeTenant || !playlistId) return;
    setBusyKey(input.operation);
    setError(null);
    try {
      const result = await mobileApi.mutatePlaylist(
        activeTenant.id,
        playlistId,
        input
      );
      if (result.outcome === "conflict") {
        throw new Error(
          "De playlist is elders gewijzigd. De nieuwste versie wordt geladen."
        );
      }
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({
          queryKey: ["content", activeTenant.id]
        })
      ]);
    } catch (mutationError) {
      setError(mutationError);
      await query.refetch();
    } finally {
      setBusyKey(null);
    }
  }

  function confirmPublish() {
    if (!playlist || !selectedScreens.length) return;
    const warnings = selectedTargets.filter(
      (target) => target.status === "warning"
    ).length;
    Alert.alert(
      "Immutable release publiceren?",
      warnings
        ? `${warnings} geselecteerde Player(s) zijn niet recent online geweest. De huidige release blijft spelen totdat zij veilig synchroniseren.`
        : "De geselecteerde Players ontvangen een nieuwe immutable release. Hun huidige release blijft spelen totdat de download is geverifieerd.",
      [
        { style: "cancel", text: "Annuleren" },
        {
          onPress: () => void publish(warnings > 0),
          text: "Publiceren"
        }
      ]
    );
  }

  async function publish(confirmWarnings: boolean) {
    if (!activeTenant || !playlistId || !playlist) return;
    setBusyKey("publish");
    setError(null);
    try {
      const result = await mobileApi.publishPlaylist(
        activeTenant.id,
        playlistId,
        {
          confirmWarnings,
          expectedRevision: playlist.revision,
          idempotencyKey: Crypto.randomUUID(),
          releaseNotes: releaseNotes.trim() || null,
          screenIds: selectedScreens
        }
      );
      if (result.outcome === "conflict") {
        throw new Error(
          "De playlist is elders gewijzigd. Controleer de nieuwste versie voor publicatie."
        );
      }
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      setReleaseNotes("");
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({
          queryKey: ["content", activeTenant.id]
        }),
        queryClient.invalidateQueries({
          queryKey: ["screens", activeTenant.id]
        })
      ]);
      Alert.alert(
        "Release aangemaakt",
        "De Players synchroniseren de nieuwe release zonder de huidige playback te onderbreken."
      );
    } catch (publishError) {
      setError(publishError);
    } finally {
      setBusyKey(null);
    }
  }

  if (query.isLoading) {
    return (
      <AppShell>
        <ScreenScrollView>
          <AppText>Playlist laden…</AppText>
        </ScreenScrollView>
      </AppShell>
    );
  }
  if (query.error || !playlist) {
    return (
      <AppShell>
        <ScreenScrollView>
          <AppError
            error={query.error ?? new Error("Playlist niet gevonden.")}
            onRetry={() => void query.refetch()}
          />
        </ScreenScrollView>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScreenScrollView>
        <View style={styles.heading}>
          <AppText accessibilityRole="header" variant="section">
            {playlist.name}
          </AppText>
          {playlist.description ? (
            <AppText muted>{playlist.description}</AppText>
          ) : null}
          <StatusBadge
            label={
              playlist.status === "published" ? "Gepubliceerd" : "Concept"
            }
            tone={playlist.status === "published" ? "success" : "neutral"}
          />
        </View>

        <SectionHeader
          description="Alleen gereed verwerkte media kan worden toegevoegd."
          title={`Items · ${playlist.items.length}`}
        />
        <View style={styles.list}>
          {playlist.items.length ? (
            playlist.items.map((item, index) => (
              <SurfaceCard key={item.id} style={styles.item}>
                <View style={styles.itemCopy}>
                  <AppText variant="cardTitle">{item.title}</AppText>
                  <AppText muted variant="caption">
                    {item.durationSeconds} sec · {item.fitMode} ·{" "}
                    {item.muted ? "gedempt" : "geluid"}
                  </AppText>
                </View>
                <View style={styles.actions}>
                  <Button
                    accessibilityLabel={`${item.title} omhoog`}
                    disabled={index === 0}
                    icon={<ArrowUp color={theme.colors.ink} size={18} />}
                    onPress={() =>
                      void mutate({
                        direction: "up",
                        expectedRevision: playlist.revision,
                        idempotencyKey: Crypto.randomUUID(),
                        itemId: item.id,
                        operation: "move_item"
                      })
                    }
                    variant="secondary"
                  >
                    Omhoog
                  </Button>
                  <Button
                    accessibilityLabel={`${item.title} omlaag`}
                    disabled={index === playlist.items.length - 1}
                    icon={<ArrowDown color={theme.colors.ink} size={18} />}
                    onPress={() =>
                      void mutate({
                        direction: "down",
                        expectedRevision: playlist.revision,
                        idempotencyKey: Crypto.randomUUID(),
                        itemId: item.id,
                        operation: "move_item"
                      })
                    }
                    variant="secondary"
                  >
                    Omlaag
                  </Button>
                  <Button
                    accessibilityLabel={`${item.title} uitsnede wijzigen`}
                    onPress={() =>
                      void mutate({
                        displayName: item.title,
                        durationSeconds: item.durationSeconds,
                        expectedRevision: playlist.revision,
                        fitMode:
                          item.fitMode === "contain" ? "cover" : "contain",
                        idempotencyKey: Crypto.randomUUID(),
                        itemId: item.id,
                        muted: item.muted,
                        operation: "update_item"
                      })
                    }
                    variant="secondary"
                  >
                    {item.fitMode === "contain" ? "Vullen" : "Passend"}
                  </Button>
                  <Button
                    accessibilityLabel={`${item.title} verwijderen`}
                    icon={<Trash2 color="#FFFFFF" size={18} />}
                    onPress={() =>
                      Alert.alert(
                        "Item verwijderen?",
                        "Dit wijzigt alleen het concept; bestaande releases blijven intact.",
                        [
                          { style: "cancel", text: "Annuleren" },
                          {
                            onPress: () =>
                              void mutate({
                                expectedRevision: playlist.revision,
                                idempotencyKey: Crypto.randomUUID(),
                                itemId: item.id,
                                operation: "remove_item"
                              }),
                            style: "destructive",
                            text: "Verwijderen"
                          }
                        ]
                      )
                    }
                    variant="danger"
                  >
                    Verwijder
                  </Button>
                </View>
              </SurfaceCard>
            ))
          ) : (
            <InlineAlert
              description="Voeg hieronder een gereed mediabestand toe."
              title="Deze playlist is nog leeg"
              tone="info"
            />
          )}
        </View>

        <SectionHeader title="Media toevoegen" />
        <View style={styles.list}>
          {playlist.readyMedia.map((asset) => (
            <SurfaceCard key={asset.id} style={styles.compactRow}>
              <View style={styles.itemCopy}>
                <AppText variant="cardTitle">{asset.name}</AppText>
                <AppText muted variant="caption">
                  {asset.mimeType}
                </AppText>
              </View>
              <Button
                icon={<ImagePlus color="#0A0A0A" size={18} />}
                loading={busyKey === `add-${asset.id}`}
                onPress={() => {
                  setBusyKey(`add-${asset.id}`);
                  void mutate({
                    expectedRevision: playlist.revision,
                    idempotencyKey: Crypto.randomUUID(),
                    mediaAssetId: asset.id,
                    operation: "add_item"
                  });
                }}
              >
                Voeg toe
              </Button>
            </SurfaceCard>
          ))}
        </View>

        <SectionHeader
          description="Players wisselen pas na volledige download en verificatie."
          title="Publiceren"
        />
        <View style={styles.list}>
          {playlist.publishTargets.map((target) => {
            const selected = selectedScreens.includes(target.id);
            const blocked = target.status === "blocked";
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled: blocked }}
                disabled={blocked}
                key={target.id}
                onPress={() =>
                  setSelectedScreens((current) =>
                    selected
                      ? current.filter((id) => id !== target.id)
                      : [...current, target.id]
                  )
                }
              >
                <SurfaceCard style={styles.compactRow}>
                  <View style={styles.itemCopy}>
                    <AppText variant="cardTitle">{target.name}</AppText>
                    <StatusBadge
                      label={
                        target.status === "ready"
                          ? "Online"
                          : target.status === "warning"
                            ? "Niet recent online"
                            : "Niet beschikbaar"
                      }
                      tone={
                        target.status === "ready"
                          ? "success"
                          : target.status === "warning"
                            ? "warning"
                            : "critical"
                      }
                    />
                  </View>
                  {selected ? (
                    <Check color={theme.colors.success} size={24} />
                  ) : null}
                </SurfaceCard>
              </Pressable>
            );
          })}
          {!playlist.publishTargets.length ? (
            <InlineAlert
              description="Koppel eerst een scherm voordat je publiceert."
              title="Geen doelschermen"
              tone="warning"
            />
          ) : null}
        </View>
        <TextField
          label="Releasenotitie (optioneel)"
          maxLength={500}
          multiline
          onChangeText={setReleaseNotes}
          value={releaseNotes}
        />
        {error ? <AppError error={error} /> : null}
        <Button
          disabled={!playlist.items.length || !selectedScreens.length}
          icon={<Send color="#0A0A0A" size={20} />}
          loading={busyKey === "publish"}
          onPress={confirmPublish}
        >
          Publiceren naar {selectedScreens.length} scherm(en)
        </Button>
      </ScreenScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.compact
  },
  compactRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.inline
  },
  heading: { gap: mobileSpacing.compact },
  item: { gap: mobileSpacing.inline },
  itemCopy: { flex: 1, gap: mobileSpacing.micro },
  list: { gap: mobileSpacing.compact }
});
