import {
  AppShell,
  AppText,
  Button,
  ScreenScrollView,
  TextField
} from "@veyocast/mobile-design-system";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ListPlus } from "lucide-react-native";
import { useState } from "react";

import { mobileApi } from "../../../src/api/mobile-api";
import { AppError } from "../../../src/components/app-error";
import { useTenant } from "../../../src/tenant/tenant-provider";

export default function CreatePlaylistScreen() {
  const { activeTenant } = useTenant();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function create() {
    if (!activeTenant || name.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const result = await mobileApi.createPlaylist(activeTenant.id, {
        description: description.trim() || null,
        name: name.trim()
      });
      await queryClient.invalidateQueries({
        queryKey: ["content", activeTenant.id]
      });
      router.replace(`/content/playlists/${result.playlistId}`);
    } catch (createError) {
      setError(createError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <ScreenScrollView>
        <AppText muted>
          Maak een compact concept. Daarna voeg je bestaande, verwerkte media
          toe en publiceer je een immutable release naar gekozen schermen.
        </AppText>
        <TextField
          autoCapitalize="sentences"
          label="Naam"
          maxLength={120}
          onChangeText={setName}
          placeholder="Bijvoorbeeld Kantine vandaag"
          value={name}
        />
        <TextField
          label="Beschrijving (optioneel)"
          maxLength={500}
          multiline
          onChangeText={setDescription}
          placeholder="Doel of gebruik van deze playlist"
          style={{ minHeight: 96, textAlignVertical: "top" }}
          value={description}
        />
        {error ? <AppError error={error} /> : null}
        <Button
          disabled={name.trim().length < 2}
          icon={<ListPlus color="#0A0A0A" size={20} />}
          loading={busy}
          onPress={() => void create()}
        >
          Concept maken
        </Button>
      </ScreenScrollView>
    </AppShell>
  );
}
