export function relationName(value: unknown) {
  const item = Array.isArray(value) ? value[0] : value;
  return item && typeof item === "object" && "name" in item
    ? String(item.name)
    : "—";
}

export function statusLabel(status: string) {
  return ({
    closed: "Gesloten",
    in_progress: "In behandeling",
    open: "Open",
    resolved: "Opgelost",
    waiting_for_customer: "Wacht op klant"
  } as Record<string, string>)[status] ?? status;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
