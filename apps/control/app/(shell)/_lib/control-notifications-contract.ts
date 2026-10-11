export type ControlNotification = {
  createdAt: string;
  href: "/dashboard/activity";
  id: string;
  result: "success" | "denied" | "failed";
  title: string;
};

export type ControlNotifications = {
  notifications: ControlNotification[];
  tenantId: string;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseControlNotifications(value: unknown, tenantId: string): ControlNotifications | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  if (payload.tenantId !== tenantId || !Array.isArray(payload.notifications) || payload.notifications.length > 20) return null;
  const notifications: ControlNotification[] = [];
  for (const entry of payload.notifications) {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || !uuid.test(row.id)
      || typeof row.title !== "string" || !row.title.trim() || row.title.length > 100
      || typeof row.createdAt !== "string" || !Number.isFinite(Date.parse(row.createdAt))
      || row.href !== "/dashboard/activity"
      || !["success", "denied", "failed"].includes(String(row.result))) return null;
    notifications.push({ id: row.id, title: row.title, createdAt: row.createdAt, href: row.href, result: row.result as ControlNotification["result"] });
  }
  return { tenantId, notifications };
}
