import Link from "next/link";

import { hasCapability } from "@veyocast/auth";
import { Button, PageHeader } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../../../lib/supabase/server";
import { createBirthdaySlide, refreshBirthdays } from "./actions";
import { BirthdayWizard } from "./birthday-wizard";

type Props = { searchParams: Promise<{ fout?: string; succes?: string }> };

export default async function BirthdayNewPage({ searchParams }: Props) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const params = await searchParams;
  const data = session.isLive && session.tenantId
    ? await loadBirthdayWizardData(session.tenantId)
    : emptyData();
  return <>
    <PageHeader
      actions={<Button asChild variant="secondary"><Link href="/dashboard/studio/new">Annuleren</Link></Button>}
      breadcrumbs={[{ href: "/dashboard/studio", label: "Studio" }, { href: "/dashboard/studio/new", label: "Nieuwe slide" }, { label: "Verjaardagen" }]}
      description="Maak één levende Sportlink-slide. De Player kiest bij iedere weergave opnieuw de juiste verjaardagen in de tenanttijdzone."
      title="Sportlink — Verjaardagen"
    />
    {params.fout ? <p className="notice notice--critical" role="alert"><strong>Actie niet uitgevoerd.</strong> {params.fout}</p> : null}
    {params.succes ? <p className="notice notice--success" role="status">{params.succes}</p> : null}
    {!data.connection ? <p className="notice notice--warning"><strong>Sportlink is nog niet gekoppeld.</strong> Koppel eerst een geldige Client ID onder Databronnen. <Link href="/dashboard/data-sources/sportlink">Sportlink openen</Link></p> : null}
    {data.connection && !data.status.active ? <p className="notice notice--warning"><strong>Verjaardagen zijn nog niet geactiveerd.</strong> Activeer de module onder de Sportlink-integratie; een Club.Data-token is hiervoor niet nodig. <Link href="/dashboard/data-sources/sportlink#verjaardagen">Instellingen openen</Link></p> : null}
    <BirthdayWizard
      action={createBirthdaySlide}
      canManage={hasCapability(session.capabilities, "tenant.data_source.manage")}
      refreshAction={refreshBirthdays}
      {...data}
    />
  </>;
}

async function loadBirthdayWizardData(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return emptyData();
  const connectionResult = await supabase.from("sportlink_connections")
    .select("id,data_source_id,detected_club_name,timezone,privacy_birthdays_enabled")
    .eq("tenant_id", tenantId).eq("status", "active").maybeSingle();
  const connection = connectionResult.data;
  if (!connection) return emptyData();
  const [statusResult, birthdaysResult, teamsResult, templatesResult, mediaResult] = await Promise.all([
    supabase.rpc("get_sportlink_birthday_status_v1", { p_connection_id: connection.id }),
    supabase.rpc("get_sportlink_birthday_preview_v1", { p_connection_id: connection.id }),
    supabase.from("sports_teams").select("external_id,name").eq("tenant_id", tenantId).eq("source_connection_id", connection.id).eq("active", true).order("name"),
    supabase.from("dynamic_templates").select("orientation,current_published_version_id").eq("slide_type", "sport_birthdays").eq("status", "published"),
    supabase.from("media_assets").select("id,title,width,height,media_variants(storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,kind,status)").eq("tenant_id", tenantId).eq("kind", "image").eq("source_kind", "user").eq("status", "ready").is("deleted_at", null).order("title").limit(100)
  ]);
  const media = await Promise.all((mediaResult.data ?? []).flatMap((asset) => {
    const variants = Array.isArray(asset.media_variants) ? asset.media_variants : [];
    const variant = variants.find((candidate) => candidate.status === "ready" && ["display", "source", "thumbnail"].includes(candidate.kind));
    return variant ? [{ asset, variant }] : [];
  }).map(async ({ asset, variant }) => {
    const signed = await supabase.storage.from(variant.storage_bucket).createSignedUrl(variant.storage_path, 3600);
    return {
      bytes: Number(variant.file_size_bytes), checksumSha256: variant.checksum_sha256,
      height: asset.height, id: asset.id, mimeType: variant.mime_type,
      name: asset.title, url: signed.data?.signedUrl ?? "", width: asset.width
    };
  }));
  return {
    birthdays: normalizeBirthdayPreview(birthdaysResult.data),
    connection: {
      clubName: connection.detected_club_name, dataSourceId: connection.data_source_id,
      id: connection.id, timezone: connection.timezone
    },
    media: media.filter((asset) => asset.url && asset.checksumSha256 && asset.bytes > 0),
    status: normalizeStatus(statusResult.data),
    teams: teamsResult.data ?? [],
    templates: (templatesResult.data ?? []).flatMap((template) => template.current_published_version_id
      ? [{ orientation: template.orientation as "landscape" | "portrait", versionId: template.current_published_version_id }]
      : [])
  };
}

function teamNames(value: unknown) {
  return Array.isArray(value) ? value.flatMap((team) => {
    if (!team || typeof team !== "object" || Array.isArray(team)) return [];
    const record = team as Record<string, unknown>;
    return typeof record.name === "string" && typeof record.externalId === "string"
      ? [{ externalId: record.externalId, name: record.name }]
      : [];
  }) : [];
}

function normalizeBirthdayPreview(value: unknown) {
  return Array.isArray(value) ? value.flatMap((birthday) => {
    if (!birthday || typeof birthday !== "object" || Array.isArray(birthday)) return [];
    const record = birthday as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.displayName !== "string") return [];
    return [{
      age: typeof record.age === "number" ? record.age : null,
      day: Number(record.day), displayName: record.displayName, id: record.id,
      matchStatus: String(record.matchStatus ?? "unmatched"), month: Number(record.month),
      photoAvailable: record.photoAvailable === true,
      role: typeof record.role === "string" ? record.role : null,
      sourceFetchedAt: String(record.sourceFetchedAt ?? ""),
      teams: teamNames(record.teamAssignments)
    }];
  }) : [];
}

function normalizeStatus(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyData().status;
  const status = value as Record<string, unknown>;
  const counts = status.counts && typeof status.counts === "object" && !Array.isArray(status.counts)
    ? status.counts as Record<string, unknown> : {};
  return {
    active: status.active === true, counts: {
      ambiguous: Number(counts.ambiguous ?? 0), birthdays: Number(counts.birthdays ?? 0),
      knownAge: Number(counts.knownAge ?? 0), matched: Number(counts.matched ?? 0),
      withPhoto: Number(counts.withPhoto ?? 0)
    }, freshness: String(status.freshness ?? "never"),
    lastSuccessAt: typeof status.lastSuccessAt === "string" ? status.lastSuccessAt : null,
    nextSyncAt: typeof status.nextSyncAt === "string" ? status.nextSyncAt : null
  };
}

function emptyData() { return {
  birthdays: [], connection: null,
  media: [], status: { active: false, counts: { ambiguous: 0, birthdays: 0, knownAge: 0, matched: 0, withPhoto: 0 }, freshness: "never", lastSuccessAt: null, nextSyncAt: null },
  teams: [], templates: []
}; }
