export type LivenessStatus = Readonly<{
  environment: string;
  revision: string;
  service: string;
  status: "ok" | "error";
}>;

export type ReadinessStatus = Readonly<{
  checks?: Readonly<Record<string, "ok" | "unavailable">>;
  environment: string;
  revision: string;
  service: string;
  status: "ready" | "unavailable";
}>;

export type BusinessStatus = Readonly<{
  checkedAt: string;
  indicators: readonly Readonly<{
    code: string;
    state: "critical" | "healthy" | "warning";
    value: number;
  }>[];
  service: string;
  status: "degraded" | "healthy";
}>;
