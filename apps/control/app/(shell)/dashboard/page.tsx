import { hasCapability } from "@veyocast/auth";
import { requireTenantControlSession } from "../../../lib/control-session";
import { loadTenantOverview } from "../../../lib/control-overview";
import { loadContentSchedules } from "./planning/data";
import type { ContentScheduleListItem } from "./planning/planning-types";
import DashboardLoading from "./loading";
import { createTodayVisualFixture, resolveTodayVisualState } from "./visual-qa-fixtures";
import { SyncOverview } from "./sync-overview";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ dismiss?: string; visualState?: string }>;
}) {
  const session = await requireTenantControlSession();
  const { visualState: requestedVisualState } = await searchParams;
  const visualState = resolveTodayVisualState(requestedVisualState);

  if (visualState === "loading") return <DashboardLoading />;

  if (visualState) {
    const data = createTodayVisualFixture(visualState);
    return (
      <SyncOverview
        canCreateStudio
        canManageScreens
        data={data}
        schedules={createVisualScheduleFixture(visualState)}
        tenant="Duindorp SV"
        userName={session.userName}
        visualState={visualState}
      />
    );
  }

  if (!session.isLive) {
    return (
      <SyncOverview
        canCreateStudio={false}
        canManageScreens={false}
        data={createTodayVisualFixture("empty-unconfigured")}
        schedules={[]}
        tenant={session.tenant}
        userName={session.userName}
        timezone={session.timezoneName}
      />
    );
  }

  const [data, planning] = await Promise.all([
    loadTenantOverview(session.tenantId!),
    loadContentSchedules(session.tenantId!)
  ]);

  return (
    <SyncOverview
      canCreateStudio={session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.studio.create")}
      canManageScreens={session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.screen.manage")}
      data={data}
      planningError={planning.error}
      schedules={planning.schedules}
      tenant={session.tenant}
      userName={session.userName}
      tenantId={session.tenantId}
      timezone={session.timezoneName}
    />
  );
}

function createVisualScheduleFixture(
  state: Exclude<ReturnType<typeof resolveTodayVisualState>, "loading" | null>
): ContentScheduleListItem[] {
  if (state !== "healthy") return [];
  const now = new Date();
  const starts = [9, 10, 14, 19, 20, 20, 21, 21, 22, 22, 23, 23];
  const names = ["Trainingstijden jeugd", "Wedstrijd Heren 1", "Sponsor van de week", "Bingoavond"];
  const targets = ["Kantine", "Hoofdveld", "Clubhuis", "Kantine"];
  return starts.map((hour, index) => {
    const start = new Date(now);
    start.setHours(
      hour,
      index === 1 || index === 3 || (index > 3 && index % 2 === 1) ? 30 : 0,
      0,
      0
    );
    const end = new Date(start.getTime() + 60 * 60_000);
    return {
      enabled: true,
      endsAt: end.toISOString(),
      id: `visual-schedule-${index}`,
      name: names[index] ?? `Clubmoment ${index + 1}`,
      playlistId: "visual-playlist-1",
      playlistName: "Clubhuis vandaag",
      priority: index,
      recurrence: {},
      releaseId: "visual-release-1",
      releaseVersion: 7,
      revision: 1,
      scheduleKind: "once",
      source: "schedule",
      startsAt: start.toISOString(),
      targetId: `visual-target-${index}`,
      targetKind: "screen",
      targetName: targets[index] ?? `Zone ${index + 1}`,
      timezoneName: "Europe/Amsterdam"
    };
  });
}
