"use client";

import { useEffect, useState } from "react";
import { PlaylistPreview, type PlaylistPreviewItem } from "../playlists/playlist-preview";
import { readAgentPlaylistPreviewAction } from "./actions";

export function AgentPlaylistPreview({ proposalId, stepIndex, revision }: { proposalId: string; stepIndex: number; revision: number }) {
  const [items, setItems] = useState<PlaylistPreviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setItems([]); setError(null);
    void readAgentPlaylistPreviewAction(proposalId, stepIndex).then(result => { if (!current) return; if (result.ok) setItems(result.preview); else setError(result.error); }).catch(() => { if (current) setError("Het voorbeeld is niet bevestigd geladen. Controleer het concept voordat je publiceert."); });
    return () => { current = false; };
  }, [proposalId, stepIndex, revision]);
  return <section aria-label="Publicatievoorbeeld"><h4>Werkelijk opgeslagen playlistvoorbeeld</h4>{error ? <p role="status">{error}</p> : items.length ? <PlaylistPreview items={items} /> : <p role="status">Voorbeeld laden…</p>}</section>;
}
