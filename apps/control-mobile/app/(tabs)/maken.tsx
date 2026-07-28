import {
  AppShell,
  AppText,
  Button,
  InlineAlert,
  ScreenScrollView,
  StateView,
  SurfaceCard,
  TextField,
  mobileSpacing,
  useMobileTheme
} from "@veyocast/mobile-design-system";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  Camera,
  ImagePlus,
  MonitorUp,
  RefreshCw,
  UploadCloud
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { MobileApiError, mobileApi } from "../../src/api/mobile-api";
import { AppError } from "../../src/components/app-error";
import { PageHeader } from "../../src/components/page-header";
import {
  completeImageUpload,
  enqueueImageUpload,
  listImageUploads,
  updateImageUpload,
  type QueuedImageUpload
} from "../../src/storage/upload-queue";
import { useTenant } from "../../src/tenant/tenant-provider";

export default function MakenScreen() {
  const router = useRouter();
  const theme = useMobileTheme();
  const queryClient = useQueryClient();
  const { activeTenant } = useTenant();
  const [title, setTitle] = useState("");
  const [selected, setSelected] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [queue, setQueue] = useState<QueuedImageUpload[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const refreshQueue = useCallback(async () => {
    if (!activeTenant) return;
    setQueue(await listImageUploads(activeTenant.id));
  }, [activeTenant]);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  async function pick(source: "camera" | "library") {
    setError(null);
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(
        new Error(
          source === "camera"
            ? "Cameratoegang is niet verleend."
            : "Toegang tot foto’s is niet verleend."
        )
      );
      return;
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            exif: false,
            mediaTypes: ["images"],
            quality: 1
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsMultipleSelection: false,
            exif: false,
            mediaTypes: ["images"],
            quality: 1
          });
    const asset = result.canceled ? null : result.assets[0] ?? null;
    if (!asset) return;
    setSelected(asset);
    setTitle(titleFromFile(asset.fileName ?? "Afbeelding"));
  }

  async function enqueueAndUpload() {
    if (!activeTenant || !selected) return;
    const mime = normalizeImageMime(selected.mimeType);
    if (!mime) {
      setError(new Error("Gebruik een JPEG-, PNG- of WebP-afbeelding."));
      return;
    }
    if (title.trim().length < 2 || title.trim().length > 120) {
      setError(new Error("Gebruik een titel van 2 tot en met 120 tekens."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const item = await enqueueImageUpload({
        fileName: selected.fileName ?? `afbeelding.${mime.split("/")[1]}`,
        mimeType: mime,
        sourceUri: selected.uri,
        tenantId: activeTenant.id,
        title: title.trim()
      });
      setSelected(null);
      setTitle("");
      await processItem(item);
    } catch (uploadError) {
      setError(uploadError);
    } finally {
      await refreshQueue();
      setBusy(false);
    }
  }

  async function processItem(item: QueuedImageUpload) {
    if (!activeTenant) return;
    await updateImageUpload(item.id, "uploading");
    try {
      await mobileApi.uploadImage(activeTenant.id, {
        fileName: item.file_name,
        mimeType: item.mime_type,
        title: item.title,
        uri: item.uri
      });
      await completeImageUpload(item);
      await queryClient.invalidateQueries({
        queryKey: ["content", activeTenant.id]
      });
    } catch (uploadError) {
      await updateImageUpload(
        item.id,
        "failed",
        uploadError instanceof MobileApiError
          ? uploadError.code
          : "UPLOAD_FAILED"
      );
      throw uploadError;
    }
  }

  async function retry(item: QueuedImageUpload) {
    setBusy(true);
    setError(null);
    try {
      await processItem(item);
    } catch (uploadError) {
      setError(uploadError);
    } finally {
      await refreshQueue();
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <ScreenScrollView>
        <PageHeader eyebrow="Snel maken" title="Maken" />
        <View style={styles.actions}>
          <Button
            icon={<ImagePlus color="#0A0A0A" size={20} />}
            onPress={() => void pick("library")}
          >
            Foto kiezen
          </Button>
          <Button
            icon={<Camera color={theme.colors.ink} size={20} />}
            onPress={() => void pick("camera")}
            variant="secondary"
          >
            Foto maken
          </Button>
          <Button
            icon={<MonitorUp color={theme.colors.ink} size={20} />}
            onPress={() => router.push("/screens/pair")}
            variant="secondary"
          >
            Scherm koppelen
          </Button>
        </View>
        {error ? <AppError error={error} /> : null}
        {selected ? (
          <SurfaceCard style={styles.composer}>
            <Image source={{ uri: selected.uri }} style={styles.preview} />
            <TextField
              label="Titel"
              maxLength={120}
              onChangeText={setTitle}
              value={title}
            />
            <InlineAlert
              description="De app bewaart deze upload lokaal totdat de server de afbeelding veilig heeft bevestigd."
              title="Klaar voor upload"
              tone="info"
            />
            <Button
              icon={<UploadCloud color="#0A0A0A" size={20} />}
              loading={busy}
              onPress={() => void enqueueAndUpload()}
            >
              Uploaden
            </Button>
          </SurfaceCard>
        ) : null}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText accessibilityRole="header" variant="section">
              Uploadwachtrij
            </AppText>
            <AppText muted>{queue.length} item(s)</AppText>
          </View>
          {queue.length ? (
            queue.map((item) => (
              <SurfaceCard key={item.id} style={styles.queueItem}>
                <View style={styles.queueCopy}>
                  <AppText variant="cardTitle">{item.title}</AppText>
                  <AppText muted>
                    {item.status === "uploading"
                      ? "Wordt geüpload"
                      : item.status === "failed"
                        ? `Mislukt · ${item.error_code ?? "UPLOAD_FAILED"}`
                        : "Wacht op upload"}
                  </AppText>
                </View>
                <Button
                  disabled={busy}
                  icon={<RefreshCw color={theme.colors.ink} size={18} />}
                  onPress={() => void retry(item)}
                  variant="secondary"
                >
                  Opnieuw
                </Button>
              </SurfaceCard>
            ))
          ) : (
            <StateView
              description="Nieuwe uploads verschijnen hier totdat de server ze heeft bevestigd."
              icon={<UploadCloud color={theme.colors.secondaryInk} size={32} />}
              title="Geen uploads in wachtrij"
            />
          )}
        </View>
      </ScreenScrollView>
    </AppShell>
  );
}

function normalizeImageMime(
  value: string | null | undefined
): QueuedImageUpload["mime_type"] | null {
  if (value === "image/jpeg" || value === "image/png" || value === "image/webp") {
    return value;
  }
  return null;
}

function titleFromFile(fileName: string) {
  const result = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return result.length >= 2 ? result.slice(0, 120) : "Nieuwe afbeelding";
}

const styles = StyleSheet.create({
  actions: { gap: mobileSpacing.compact },
  composer: { gap: mobileSpacing.default },
  preview: {
    aspectRatio: 16 / 9,
    borderRadius: 12,
    width: "100%"
  },
  queueCopy: { flex: 1, gap: mobileSpacing.micro },
  queueItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.inline
  },
  section: { gap: mobileSpacing.default },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  }
});
