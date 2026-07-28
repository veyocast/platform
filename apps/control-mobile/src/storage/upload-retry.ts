export function uploadFailureStatus(error: unknown): "failed" | "pending" {
  if (!error || typeof error !== "object" || !("status" in error)) {
    return "pending";
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && status < 500 ? "failed" : "pending";
}
