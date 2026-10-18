import { AppShell, AppText, Button, InlineAlert, ScreenScrollView, Skeleton, SurfaceCard, TextField, mobileSpacing } from "@veyocast/mobile-design-system";
import { createSyncStudioStarter, updateSyncStudioDocument, type MobileSyncStudioRequestV3, type MobileSyncStudioWorkspaceV3 } from "@veyocast/studio/mobile-v3";
import type { SyncContentFamily } from "@veyocast/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import { useMemo, useState } from "react";
import { Image, View } from "react-native";
import { mobileApi } from "../../src/api/mobile-api";
import { AppError } from "../../src/components/app-error";
import { PageHeader } from "../../src/components/page-header";
import { useAuth } from "../../src/auth/auth-provider";
import { useTenant } from "../../src/tenant/tenant-provider";
import { useStudioRecovery } from "../../src/sync/use-studio-recovery";
import { assertSyncReceipt, prepareSyncCreate } from "../../src/sync/studio-recovery";

export default function NativeSyncStudio() {
  const { activeTenant } = useTenant();
  const { session } = useAuth();
  const { assetId, assetName } = useLocalSearchParams<{ assetId?: string; assetName?: string }>();
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const query = useQuery({ queryKey: ["sync-studio-v3", session?.user.id, activeTenant?.id, offset], enabled: Boolean(activeTenant && session), queryFn: () => mobileApi.studioV3(activeTenant!.id, undefined, offset) });
  return <AppShell><ScreenScrollView>
    <PageHeader title="Snelle clubpost" eyebrow="Van je telefoon naar je schermen" />
    {query.isLoading ? <Skeleton height={180} /> : query.error ? <AppError error={query.error} onRetry={() => void query.refetch()} /> : null}
    {query.data && activeTenant && session ? <NewSyncDesign key={`${session.user.id}:${activeTenant.id}`} workspace={query.data} tenantId={activeTenant.id} userId={session.user.id} tenantName={activeTenant.name} canCreate={activeTenant.capabilities.includes("tenant.studio.create")} assetId={assetId} assetName={assetName} /> : null}
    <AppText accessibilityRole="header" variant="section">Je recente ontwerpen</AppText>
    {query.data?.projects.map(project => <SurfaceCard key={project.id}><View style={{ gap: mobileSpacing.default }}>
      {project.previewUrl ? <Image source={{ uri: project.previewUrl }} accessibilityLabel={`Bevestigd renderresultaat ${project.name}`} style={{ width: "100%", aspectRatio: project.document.artboard.orientation === "portrait" ? 9 / 16 : 16 / 9 }} /> : null}
      <AppText variant="cardTitle">{project.name}</AppText><AppText muted>Conceptversie {project.draftRevision}{project.series ? ` · ${project.series.members.length} slides in de reeks` : ""}</AppText>
      <Button variant="secondary" onPress={() => router.push(`/studio/designs/${project.id}`)}>Ontwerp openen</Button>
    </View></SurfaceCard>)}
    {query.data && !query.data.projects.length ? <AppText muted>Hier verschijnen je opgeslagen Sync-ontwerpen.</AppText> : null}
    <View style={{ flexDirection: "row", gap: mobileSpacing.compact }}><Button variant="secondary" disabled={!offset} onPress={() => setOffset(value => Math.max(0, value - 8))}>Vorige</Button><Button variant="secondary" disabled={!query.data?.hasMore} onPress={() => setOffset(value => value + 8)}>Volgende</Button></View>
    <Button variant="secondary" onPress={() => router.push("/studio/legacy")}>Eerdere Sites-ontwerpen en reeksen</Button>
  </ScreenScrollView></AppShell>;
}

function NewSyncDesign({ workspace, tenantId, userId, tenantName, canCreate, assetId, assetName }: {
  workspace: MobileSyncStudioWorkspaceV3; tenantId: string; userId: string; tenantName: string; canCreate: boolean; assetId?: string | undefined; assetName?: string | undefined;
}) {
  const router = useRouter();
  const initial = useMemo(() => createSyncStudioStarter({ family: "club-story", tenantName }), [tenantName]);
  const queryClient = useQueryClient();
  const recovery = useStudioRecovery({ userId, tenantId, projectId: "new" }, initial, 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const value = recovery.record;
  const disabled = busy || !canCreate || workspace.authoringPaused || Boolean(value?.pending);
  const requestedImage = useQuery({
    queryKey: ["sync-image-handoff", userId, tenantId, assetId, assetName], enabled: Boolean(assetId),
    queryFn: async () => {
      if (!assetId || !/^[a-f0-9-]{36}$/i.test(assetId)) throw Error("Deze afbeelding kan niet veilig worden geopend. Kies haar opnieuw uit Media.");
      for (let offset = 0; offset < 240; offset += 48) {
        const page = await mobileApi.libraryV2(tenantId, "media", offset, (assetName ?? "").slice(0, 160));
        const entry = page.entries.find(entry => entry.id === assetId && entry.assetReference?.kind === "tenant");
        if (entry?.assetReference?.kind === "tenant") return entry;
        if (!page.hasMore) break;
      }
      throw Error("De gereedstaande afbeelding is niet gevonden. Vernieuw Media en kies haar opnieuw; er is geen ander beeld ingevuld.");
    },
  });
  function selectFamily(family: SyncContentFamily) {
    if (disabled) return;
    recovery.edit(createSyncStudioStarter({ family, tenantName }));
    setTemplatesOpen(false);
  }
  function editInput(field: "name" | "title" | "body", input: string) {
    const current = recovery.latest.current;
    if (!current || disabled) return;
    let document = current.document;
    try { document = updateSyncStudioDocument(document, { ...document.syncPresentation!, [field]: input }); }
    catch { /* Transient input is kept separately until the complete document is valid. */ }
    void recovery.persist({ ...current, document, dirty: true, fieldInput: { ...current.fieldInput, [field]: input } }).catch(() => undefined);
  }
  async function create(command?: MobileSyncStudioRequestV3) {
    const current = recovery.latest.current;
    if (!current || busy || !canCreate || workspace.authoringPaused) return;
    setBusy(true); setError(null);
    try {
      const next = command ?? prepareSyncCreate(current, () => Crypto.randomUUID());
      if (!await recovery.persist({ ...current, document: next.operation === "create" ? next.document : current.document, pending: next })) return;
      const result = await mobileApi.mutateStudioV3(tenantId, next, userId);
      assertSyncReceipt(next, result);
      if (!recovery.alive.current) return;
      if (result.outcome === "conflict") throw Error("De server kon deze nieuwe keuze niet bevestigen. Behoud dezelfde opdracht en probeer opnieuw.");
      await recovery.clear();
      void queryClient.invalidateQueries({ queryKey: ["sync-studio-v3", userId, tenantId] });
      router.push(`/studio/designs/${result.projectId}`);
    } catch (value) { if (recovery.alive.current) setError(value); }
    finally { if (recovery.alive.current) setBusy(false); }
  }
  if (recovery.error && !value) return <AppError error={recovery.error} />;
  if (!value) return <Skeleton height={150} />;
  const slide = value.document.syncPresentation!;
  return <SurfaceCard><View style={{ gap: mobileSpacing.default }}>
    {workspace.authoringPaused ? <InlineAlert title="Authoring tijdelijk gepauzeerd" description="Je opgeslagen ontwerpen blijven beschikbaar. Nieuwe wijzigingen kunnen pas worden bevestigd zodra authoring weer is vrijgegeven." tone="warning" /> : null}
    {!canCreate ? <InlineAlert title="Ontwerpen bekijken" description="Je rol kan hier geen nieuw ontwerp maken. Vraag je beheerder om aanmaakrechten." tone="info" /> : null}
    {requestedImage.error ? <AppError error={requestedImage.error} onRetry={() => void requestedImage.refetch()} /> : requestedImage.data ? <>
      {requestedImage.data.previewUrl ? <Image source={{ uri: requestedImage.data.previewUrl }} style={{ width: "100%", aspectRatio: 16 / 9 }} accessibilityLabel={requestedImage.data.title} /> : null}
      <Button disabled={disabled} variant="secondary" onPress={() => {
        const asset = requestedImage.data?.assetReference;
        if (asset?.kind !== "tenant") return;
        const doc = createSyncStudioStarter({ family: "club-story", tenantName });
        recovery.edit(updateSyncStudioDocument(doc, { ...doc.syncPresentation!, name: requestedImage.data!.title.slice(0, 120), style: { ...doc.syncPresentation!.style, background: "photo", backgroundAsset: asset } }));
      }}>Gebruik deze afbeelding voor een clubpost</Button>
    </> : requestedImage.isFetching ? <AppText muted>Je eigen afbeelding controleren…</AppText> : null}
    <TextField label="Ontwerpnaam" value={value.fieldInput.name ?? slide.name} maxLength={120} editable={!disabled} onChangeText={name => editInput("name", name)} />
    <TextField label="Titel" value={value.fieldInput.title ?? slide.title} maxLength={400} editable={!disabled} onChangeText={title => editInput("title", title)} />
    <TextField label="Bericht" value={value.fieldInput.body ?? slide.body} maxLength={4000} multiline editable={!disabled} onChangeText={body => editInput("body", body)} />
    <AppText muted>Je lokale concept blijft beschikbaar. Bewaren maakt een echt ontwerp in de gedeelde bibliotheek; daarna maak je het afspeelbestand voor je playlist.</AppText>
    {value.pending ? <InlineAlert title="Opdracht nog niet bevestigd" description="Je keuze en ontvangstcode blijven behouden. Bevestig dezelfde opdracht opnieuw om veilig verder te gaan." tone="warning" /> : null}
    {error || recovery.error ? <AppError error={error ?? recovery.error} /> : null}
    <Button loading={busy} disabled={!canCreate || workspace.authoringPaused || (value.fieldInput.name ?? slide.name).trim().length < 2} onPress={() => void create()}>{value.pending ? "Dezelfde aanmaak bevestigen" : value.dirty ? "Concept bewaren" : "Nieuwe clubpost maken"}</Button>
    <Button variant="secondary" disabled={disabled} onPress={() => setTemplatesOpen(open => !open)}>Ander startpunt kiezen</Button>
    {templatesOpen ? workspace.templates.map(template => <Button key={template.id} variant="secondary" disabled={disabled} onPress={() => selectFamily(template.id)}>{template.name}</Button>) : null}
  </View></SurfaceCard>;
}
