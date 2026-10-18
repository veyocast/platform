import { AppShell, AppText, Button, InlineAlert, ScreenScrollView, Skeleton, SurfaceCard, TextField, mobileSpacing } from "@veyocast/mobile-design-system";
import { type MobileSyncStudioProjectV3, type MobileSyncStudioRequestV3, type StudioDocument } from "@veyocast/studio/mobile-v3";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, View } from "react-native";
import { mobileApi } from "../../../src/api/mobile-api";
import { AppError } from "../../../src/components/app-error";
import { PageHeader } from "../../../src/components/page-header";
import { useAuth } from "../../../src/auth/auth-provider";
import { useTenant } from "../../../src/tenant/tenant-provider";
import { useStudioRecovery } from "../../../src/sync/use-studio-recovery";
import { assertSyncReceipt, newSyncRecovery } from "../../../src/sync/studio-recovery";
import { PendingStudioReceipt } from "../../../src/sync/pending-receipt";
import { SyncStudioFields } from "../../../src/sync/studio-fields";
import { useMobileContent } from "../../../src/query/use-mobile-data";
import { syncRenderObservationMs, syncRenderPollDelay } from "../../../src/sync/render-polling";

export default function NativeSyncProjectRoute() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { activeTenant } = useTenant();
  const { session } = useAuth();
  const [focused, setFocused] = useState(true);
  const [pollingAllowed, setPollingAllowed] = useState(false);
  const [observation, setObservation] = useState<{ jobId: string; startedAt: number } | null>(null);
  const [observationEnded, setObservationEnded] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const query = useQuery({
    queryKey: ["sync-studio-v3-project", session?.user.id, activeTenant?.id, projectId], enabled: Boolean(activeTenant && session && projectId),
    queryFn: () => mobileApi.studioV3(activeTenant!.id, projectId),
    refetchInterval: current => syncRenderPollDelay(current.state.data?.projects.find(value => value.id === projectId)?.renderStatus, observation?.startedAt ?? null, Date.now(), pollingAllowed && focused),
  });
  const project = query.data?.projects.find(value => value.id === projectId);
  useEffect(() => {
    if (project?.renderJobId && ["queued", "rendering"].includes(project.renderStatus)) {
      setObservation(current => current?.jobId === project.renderJobId ? current : { jobId: project.renderJobId!, startedAt: Date.now() });
    } else setObservation(null);
  }, [project?.renderJobId, project?.renderStatus]);
  useEffect(() => {
    setObservationEnded(false);
    if (!observation) return;
    const timer = setTimeout(() => setObservationEnded(true), Math.max(0, observation.startedAt + syncRenderObservationMs - Date.now()));
    return () => clearTimeout(timer);
  }, [observation]);
  return <AppShell><ScreenScrollView>
    {observation ? <>
      <InlineAlert title={observationEnded ? "Nog geen definitieve renderstatus" : "Afspeelbestand volgen"} description={observationEnded ? "Automatisch volgen is na twee minuten gestopt. Je opdracht en bestaande afspeelbestand blijven behouden; vraag de status opnieuw op." : "We volgen deze render maximaal twee minuten met steeds ruimere tussenpozen. Je kunt ondertussen je concept blijven bewerken."} tone="info" />
      <Button variant="secondary" disabled={query.isFetching} onPress={() => { setObservation({ jobId: observation.jobId, startedAt: Date.now() }); void query.refetch(); }}>Renderstatus opnieuw ophalen</Button>
    </> : null}
    {query.isLoading ? <Skeleton height={250} /> : query.error && activeTenant && session ? <PendingStudioReceipt key={`${session.user.id}:${activeTenant.id}:${projectId}`} scope={{ userId: session.user.id, tenantId: activeTenant.id, projectId }} fallback={<AppError error={query.error} onRetry={() => void query.refetch()} />} /> : project && activeTenant && session ? <SyncProjectEditor
      key={`${session.user.id}:${activeTenant.id}:${project.id}`} project={project} userId={session.user.id} tenantId={activeTenant.id}
      onPollingAllowed={setPollingAllowed}
      paused={query.data!.authoringPaused} canEdit={activeTenant.capabilities.includes("tenant.studio.edit_own") || activeTenant.capabilities.includes("tenant.studio.edit_all")}
      canRender={activeTenant.capabilities.includes("tenant.studio.render")} canCreate={activeTenant.capabilities.includes("tenant.studio.create")} canArchive={activeTenant.capabilities.includes("tenant.studio.archive")}
      readCurrent={async () => (await query.refetch()).data?.projects.find(value => value.id === projectId) ?? null}
    /> : activeTenant && session ? <PendingStudioReceipt key={`${session.user.id}:${activeTenant.id}:${projectId}`} scope={{ userId: session.user.id, tenantId: activeTenant.id, projectId }} fallback={<InlineAlert title="Ontwerp niet beschikbaar" description="Dit ontwerp is niet beschikbaar in je huidige organisatie. Open Studio en kies een toegankelijk ontwerp." tone="warning" />} /> : null}
  </ScreenScrollView></AppShell>;
}

function SyncProjectEditor({ project, userId, tenantId, paused, canEdit, canRender, canCreate, canArchive, readCurrent, onPollingAllowed }: {
  project: MobileSyncStudioProjectV3; userId: string; tenantId: string; paused: boolean; canEdit: boolean; canRender: boolean; canCreate: boolean; canArchive: boolean;
  readCurrent: () => Promise<MobileSyncStudioProjectV3 | null>;
  onPollingAllowed: (allowed: boolean) => void;
}) {
  const router = useRouter();
  const recovery = useStudioRecovery({ userId, tenantId, projectId: project.id }, project.document, project.draftRevision);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [playlistPicker, setPlaylistPicker] = useState(false);
  const value = recovery.record;
  const locked = busy || paused || !canEdit || Boolean(value?.pending) || Boolean(value?.conflict);
  useEffect(() => {
    onPollingAllowed(Boolean(value && !value.dirty && !value.pending && !value.conflict && !value.seriesInput));
    return () => onPollingAllowed(false);
  }, [Boolean(value), value?.dirty, Boolean(value?.pending), value?.conflict, Boolean(value?.seriesInput), onPollingAllowed]);

  async function send(command: MobileSyncStudioRequestV3) {
    const current = recovery.latest.current;
    if (!current || busy) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const exact = current.pending ?? command;
      if (!await recovery.persist({ ...current, pending: exact })) return;
      const result = await mobileApi.mutateStudioV3(tenantId, exact, userId);
      assertSyncReceipt(exact, result);
      if (!recovery.alive.current) return;
      if (result.outcome === "conflict") {
        await recovery.persist({ ...current, pending: null, conflict: true });
        throw Error("Het ontwerp is intussen gewijzigd. Je lokale invoer is behouden; open de actuele serverversie voordat je verdergaat.");
      }
      const confirmed = { ...current, pending: null, conflict: false, dirty: exact.operation === "save" ? false : current.dirty, draftRevision: result.draftRevision, seriesInput: exact.operation === "series" && exact.action === "rename" ? null : current.seriesInput };
      await recovery.persist(confirmed);
      if (exact.operation === "series" && result.series?.nextProjectId && result.series.nextProjectId !== project.id) {
        router.replace(`/studio/designs/${result.series.nextProjectId}`);
        return;
      }
      await readCurrent();
      if (recovery.alive.current) setMessage(result.outcome === "saved" ? "Concept bevestigd door de server" : result.outcome === "queued" ? "Afspeelbestand aangevraagd; de worker controleert de uitvoer" : "Reekswijziging bevestigd door de server");
    } catch (value) { if (recovery.alive.current) setError(value); }
    finally { if (recovery.alive.current) setBusy(false); }
  }
  function save() {
    const current = recovery.latest.current;
    if (!current) return;
    void send({ operation: "save", projectId: project.id, expectedDraftRevision: current.draftRevision, document: current.document, idempotencyKey: Crypto.randomUUID() });
  }
  function render() {
    const current = recovery.latest.current;
    if (!current || current.dirty) return;
    void send({ operation: "render", projectId: project.id, expectedDraftRevision: current.draftRevision, outputKind: current.document.motion.enabled ? "mp4" : "png", idempotencyKey: Crypto.randomUUID() });
  }
  function series(action: Extract<MobileSyncStudioRequestV3, { operation: "series" }>["action"], memberIds: string[] | null = null) {
    const current = recovery.latest.current;
    if (!current || current.dirty) return;
    if (action !== "add" && !project.series) { setError(new Error("Voeg eerst een slide toe om een reeks te starten. Je huidige ontwerp blijft behouden.")); return; }
    void send({ operation: "series", projectId: project.id, draftRevision: current.draftRevision, seriesId: project.series?.id ?? null, seriesRevision: action === "rename" ? current.seriesInput?.expectedRevision ?? project.series?.revision ?? null : project.series?.revision ?? null, action, name: action === "rename" ? current.seriesInput?.name ?? project.series?.name ?? project.name : null, memberIds, idempotencyKey: Crypto.randomUUID() });
  }
  function openCurrent() {
    const current = recovery.latest.current;
    if (!current || current.pending) return;
    Alert.alert("Actuele serverversie openen?", "Hiermee vervang je de lokale invoer door de opgeslagen versie. Je gepubliceerde inhoud verandert niet.", [
      { text: "Lokale invoer behouden", style: "cancel" },
      { text: "Serverversie openen", style: "destructive", onPress: () => { void (async () => {
        setBusy(true);
        try { const latest = await readCurrent(); if (!latest) throw Error("De actuele versie kon niet worden bevestigd. Je invoer blijft behouden."); await recovery.persist(newSyncRecovery({ userId, tenantId, projectId: project.id }, latest.document, latest.draftRevision)); setError(null); }
        catch (value) { setError(value); } finally { setBusy(false); }
      })(); } },
    ]);
  }
  function edit(document: StudioDocument) { if (!locked) { recovery.edit(document); setMessage(null); } }
  if (!value) return recovery.error ? <AppError error={recovery.error} /> : <Skeleton height={220} />;
  const verifiedOutput = !value.dirty && !value.pending && !value.conflict && project.draftRevision === value.draftRevision && project.renderStatus === "completed" && Boolean(project.mediaAssetId);
  const seriesName = value.seriesInput?.name ?? project.series?.name ?? project.name;
  const seriesConflict = Boolean(value.seriesInput && value.seriesInput.expectedRevision !== project.series?.revision);
  const renderLabel = { unknown: "Status nog niet bevestigd", idle: "Nog geen actueel afspeelbestand", queued: "In de wachtrij", rendering: "Afspeelbestand wordt gemaakt", completed: "Afspeelbestand geverifieerd", failed: "Render mislukt; je concept is behouden", cancelled: "Render geannuleerd; je concept is behouden" }[project.renderStatus];
  return <>
    <PageHeader title={value.document.syncPresentation!.name || "Je ontwerp"} eyebrow={`Conceptversie ${value.draftRevision}`} />
    {paused ? <InlineAlert title="Authoring tijdelijk gepauzeerd" description="Je invoer blijft behouden. Nieuwe wijzigingen kunnen pas worden bevestigd wanneer authoring weer is vrijgegeven." tone="warning" /> : null}
    {value.pending ? <InlineAlert title="Ontvangstbewijs ontbreekt" description="Je opdracht is lokaal bewaard. Wijzigingen blijven geblokkeerd tot dezelfde opdracht opnieuw is bevestigd." tone="warning" /> : value.conflict ? <InlineAlert title="Een andere versie is opgeslagen" description="Je lokale invoer blijft zichtbaar. Open bewust de actuele serverversie om opnieuw te beginnen." tone="warning" /> : value.dirty ? <InlineAlert title="Lokaal concept hervat" description="Je wijzigingen zijn nog niet bevestigd door de server. Bewaar ze voordat je een nieuw afspeelbestand maakt." tone="info" /> : null}
    {message ? <InlineAlert title={message} description="Publiceren naar schermen gebeurt daarna via je playlist." tone="success" /> : null}
    {error || recovery.error ? <AppError error={error ?? recovery.error} /> : null}
    <SurfaceCard><View style={{ gap: mobileSpacing.default }}>
      {project.previewUrl ? <Image accessibilityLabel="Laatst geverifieerde renderpreview" source={{ uri: project.previewUrl }} style={{ width: "100%", aspectRatio: project.document.artboard.orientation === "portrait" ? 9 / 16 : 16 / 9 }} /> : null}
      <AppText>{renderLabel}</AppText>
      {value.dirty ? <AppText muted>Een eerder afspeelbestand toont je nieuwe wijzigingen nog niet.</AppText> : null}
    </View></SurfaceCard>
    <SyncStudioFields document={value.document} disabled={locked} onChange={edit} onError={setError} />
    {value.pending ? <Button loading={busy} onPress={() => void send(value.pending!)}>Dezelfde opdracht bevestigen</Button> : <>
      <Button disabled={!value.dirty || locked || Boolean(recovery.error)} loading={busy} onPress={save}>Concept bewaren</Button>
      <Button variant="secondary" disabled={value.dirty || value.conflict || paused || !canRender || busy || Boolean(recovery.error)} onPress={render}>Afspeelbestand maken</Button>
      <Button variant="secondary" disabled={!verifiedOutput || busy} onPress={() => setPlaylistPicker(open => !open)}>Gereed ontwerp aan playlist toevoegen</Button>
      <Button variant="ghost" disabled={busy} onPress={openCurrent}>Actuele serverversie openen</Button>
    </>}
    {playlistPicker && verifiedOutput && project.mediaAssetId ? <SyncPlaylistTargets mediaAssetId={project.mediaAssetId} duration={Math.max(3, Math.ceil(value.document.motion.durationMs / 1000))} /> : null}
    <SurfaceCard><View style={{ gap: mobileSpacing.default }}>
      <AppText variant="section">Reeks</AppText>
      {project.series ? <>
        <TextField label="Reeksnaam" value={seriesName} editable={!locked && !value.dirty} onChangeText={name => { const current = recovery.latest.current; if (current && project.series) void recovery.persist({ ...current, seriesInput: { name, expectedRevision: current.seriesInput?.expectedRevision ?? project.series.revision } }).catch(() => undefined); }} maxLength={120} />
        {seriesConflict ? <InlineAlert title="De reeks is intussen gewijzigd" description="Je ingevoerde naam blijft behouden. Neem bewust de actuele reeksnaam over voordat je opnieuw wijzigt." tone="warning" /> : null}
        <Button disabled={locked || value.dirty || !value.seriesInput || seriesName.trim().length < 2 || seriesConflict} variant="secondary" onPress={() => series("rename")}>Reeksnaam bewaren</Button>
        {value.seriesInput ? <Button variant="ghost" disabled={busy || Boolean(value.pending)} onPress={() => Alert.alert("Actuele reeksnaam overnemen?", "Je vervangt alleen de lokaal ingevoerde reeksnaam. Je ontwerp blijft behouden.", [{ text: "Invoer behouden", style: "cancel" }, { text: "Actuele naam overnemen", onPress: () => { const current = recovery.latest.current; if (current) void recovery.persist({ ...current, seriesInput: null }).catch(() => undefined); } }])}>Actuele reeksnaam overnemen</Button> : null}
        {project.series.members.map((member, index) => <View key={member.projectId} style={{ gap: mobileSpacing.compact }}>
          <Button variant="secondary" disabled={busy || Boolean(value.pending)} onPress={() => router.push(`/studio/designs/${member.projectId}`)}>{index + 1}. {member.name}</Button>
          <View style={{ flexDirection: "row", gap: mobileSpacing.compact }}>
            {([[-1, "Omhoog"], [1, "Omlaag"]] as const).map(([direction, label]) => <Button key={label} variant="ghost" disabled={locked || value.dirty || index + direction < 0 || index + direction >= project.series!.members.length} onPress={() => { const ids = project.series!.members.map(item => item.projectId); [ids[index], ids[index + direction]] = [ids[index + direction]!, ids[index]!]; series("reorder", ids); }}>{label}</Button>)}
          </View>
        </View>)}
      </> : <AppText muted>Dit ontwerp staat nog los. Je kunt er een reeks van maken.</AppText>}
      <Button variant="secondary" disabled={locked || value.dirty || !canCreate || (project.series?.members.length ?? 1) >= 20} onPress={() => series("add")}>Slide aan reeks toevoegen</Button>
      <Button variant="secondary" disabled={locked || value.dirty || !canCreate || !project.series || project.series.members.length >= 20} onPress={() => series("duplicate")}>Deze slide kopiëren</Button>
      {project.series && project.series.members.length > 1 ? <Button variant="dangerQuiet" disabled={locked || value.dirty || !canArchive} onPress={() => Alert.alert("Slide uit de reeks halen?", "Deze slide wordt herstelbaar gearchiveerd. Bestaande publicaties blijven bewaard.", [{ text: "Annuleren", style: "cancel" }, { text: "Uit reeks halen", style: "destructive", onPress: () => series("remove") }])}>Deze slide uit de reeks halen</Button> : null}
    </View></SurfaceCard>
  </>;
}

function SyncPlaylistTargets({ mediaAssetId, duration }: { mediaAssetId: string; duration: number }) {
  const query = useMobileContent();
  const router = useRouter();
  if (query.isLoading) return <Skeleton height={120} />;
  if (query.error) return <AppError error={query.error} onRetry={() => void query.refetch()} />;
  return <SurfaceCard><View style={{ gap: mobileSpacing.default }}>
    <AppText variant="section">Kies een playlist</AppText>
    <AppText muted>Je controleert de toevoeging in de bestaande playlisteditor. Publiceren volgt pas na de normale preflight.</AppText>
    {query.data?.data.playlists.filter(playlist => playlist.status !== "archived").map(playlist => <Button key={playlist.id} variant="secondary" disabled={query.data?.offline} onPress={() => router.push({ pathname: "/content/playlists/[playlistId]", params: { playlistId: playlist.id, syncAssetId: mediaAssetId, syncDuration: String(duration) } })}>{playlist.name}</Button>)}
    {!query.data?.data.playlists.length ? <Button variant="secondary" onPress={() => router.push("/content/playlists/new")}>Eerst een playlist maken</Button> : null}
  </View></SurfaceCard>;
}
