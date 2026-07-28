import {
  AppShell,
  AppText,
  Button,
  PressableSurface,
  ScreenScrollView,
  SegmentedControl,
  Skeleton,
  StateView,
  StatusBadge,
  SurfaceCard,
  mobileSpacing,
  useMobileTheme
} from "@veyocast/mobile-design-system";
import { FileImage, ListVideo } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { AppError } from "../../src/components/app-error";
import { PageHeader } from "../../src/components/page-header";
import { useMobileContent } from "../../src/query/use-mobile-data";

type Segment = "media" | "playlists";

export default function ContentScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>("media");
  const query = useMobileContent();
  const theme = useMobileTheme();
  const content = query.data?.data;
  return (
    <AppShell>
      <ScreenScrollView
        refreshControl={
          <RefreshControl
            colors={[theme.colors.action]}
            onRefresh={() => void query.refetch()}
            refreshing={query.isRefetching}
            tintColor={theme.colors.action}
          />
        }
      >
        <PageHeader eyebrow="Bibliotheek" title="Content" />
        <SegmentedControl
          accessibilityLabel="Contenttype"
          onChange={setSegment}
          options={[
            { label: "Media", value: "media" },
            { label: "Playlists", value: "playlists" }
          ]}
          value={segment}
        />
        {segment === "playlists" ? (
          <Button
            icon={<ListVideo color="#0A0A0A" size={20} />}
            onPress={() => router.push("/content/playlists/new")}
          >
            Nieuwe playlist
          </Button>
        ) : null}
        {query.isLoading ? (
          <View style={styles.list}>
            <Skeleton />
            <Skeleton />
          </View>
        ) : query.error ? (
          <AppError error={query.error} onRetry={() => void query.refetch()} />
        ) : segment === "media" ? (
          content?.media.length ? (
            <View style={styles.list}>
              {content.media.map((asset) => (
                <SurfaceCard key={asset.id} style={styles.row}>
                  <FileImage color={theme.colors.secondaryInk} size={26} />
                  <View style={styles.copy}>
                    <AppText variant="cardTitle">{asset.name}</AppText>
                    <AppText muted variant="caption">
                      {asset.mimeType} · {formatBytes(asset.sizeBytes)}
                    </AppText>
                    <StatusBadge
                      label={
                        asset.processingStatus === "ready"
                          ? "Gereed"
                          : asset.processingStatus === "failed"
                            ? "Mislukt"
                            : "Verwerken"
                      }
                      tone={
                        asset.processingStatus === "ready"
                          ? "success"
                          : asset.processingStatus === "failed"
                            ? "critical"
                            : "info"
                      }
                    />
                  </View>
                </SurfaceCard>
              ))}
            </View>
          ) : (
            <StateView
              description="Upload een afbeelding via Maken om je mediabibliotheek te vullen."
              icon={<FileImage color={theme.colors.secondaryInk} size={34} />}
              title="Nog geen media"
            />
          )
        ) : content?.playlists.length ? (
          <View style={styles.list}>
            {content.playlists.map((playlist) => (
              <PressableSurface
                accessibilityLabel={`Open playlist ${playlist.name}`}
                accessibilityRole="button"
                key={playlist.id}
                onPress={() =>
                  router.push(`/content/playlists/${playlist.id}`)
                }
              >
                <SurfaceCard style={styles.row}>
                  <ListVideo color={theme.colors.secondaryInk} size={26} />
                  <View style={styles.copy}>
                    <AppText variant="cardTitle">{playlist.name}</AppText>
                    <AppText muted>
                      {playlist.itemCount} item(s)
                      {playlist.publishedVersion
                        ? ` · versie ${playlist.publishedVersion}`
                        : ""}
                    </AppText>
                    <StatusBadge
                      label={
                        playlist.status === "published"
                          ? "Gepubliceerd"
                          : "Concept"
                      }
                      tone={
                        playlist.status === "published"
                          ? "success"
                          : "neutral"
                      }
                    />
                  </View>
                </SurfaceCard>
              </PressableSurface>
            ))}
          </View>
        ) : (
          <StateView
            description="Maak een playlist en voeg gereed verwerkte media toe."
            icon={<ListVideo color={theme.colors.secondaryInk} size={34} />}
            title="Nog geen playlists"
          />
        )}
      </ScreenScrollView>
    </AppShell>
  );
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} kB`;
  return `${value} B`;
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: mobileSpacing.micro },
  list: { gap: mobileSpacing.inline },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.inline
  }
});
