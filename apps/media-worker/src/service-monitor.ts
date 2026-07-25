import { readFile, rename, writeFile } from "node:fs/promises";

export type MonitorTarget = Readonly<{ name: string; url: string }>;
export type MonitorEvent =
  | "monitor.notification.failed"
  | "monitor.target.checked";
export type MonitorState = Readonly<Record<string, {
  failures: number;
  firing: boolean;
}>>;

type ServiceMonitorOptions = Readonly<{
  environment: string;
  fetcher?: typeof fetch;
  intervalMs?: number;
  onEvent?: (event: MonitorEvent, fields: Record<string, unknown>) => void;
  signal: AbortSignal;
  statePath?: string;
  targets: readonly MonitorTarget[];
  webhookUrl: string;
}>;

export function nextMonitorState(
  state: MonitorState,
  target: string,
  healthy: boolean,
  threshold = 3
) {
  const current = state[target] ?? { failures: 0, firing: false };
  const failures = healthy ? 0 : current.failures + 1;
  const firing = healthy ? false : current.firing || failures >= threshold;
  return {
    notification: !current.firing && firing
      ? "firing"
      : current.firing && healthy
        ? "recovered"
        : null,
    state: { ...state, [target]: { failures, firing } }
  } as const;
}

export async function runServiceMonitor(options: ServiceMonitorOptions) {
  const fetcher = options.fetcher ?? fetch;
  const statePath = options.statePath ?? "/tmp/veyocast-monitor-state.json";
  let state = await readState(statePath);
  const intervalMs = options.intervalMs ?? 60_000;

  while (!options.signal.aborted) {
    for (const target of options.targets) {
      const healthy = await checkTarget(fetcher, target.url);
      const transition = nextMonitorState(state, target.name, healthy);
      state = transition.state;
      options.onEvent?.("monitor.target.checked", {
        healthy,
        target: target.name
      });
      if (transition.notification) {
        try {
          await notifySlack(fetcher, options, target, transition.notification);
        } catch {
          options.onEvent?.("monitor.notification.failed", {
            status: "network_error",
            target: target.name
          });
        }
      }
    }
    await writeState(statePath, state);
    await wait(intervalMs, options.signal);
  }
}

async function checkTarget(fetcher: typeof fetch, url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(url, {
      cache: "no-store",
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) return false;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return true;
    const body = await response.json() as { status?: unknown };
    return body.status === "ok";
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function notifySlack(
  fetcher: typeof fetch,
  options: ServiceMonitorOptions,
  target: MonitorTarget,
  transition: "firing" | "recovered"
) {
  const firing = transition === "firing";
  const response = await fetcher(options.webhookUrl, {
    body: JSON.stringify({
      text: firing
        ? `🚨 VeyoCast ${options.environment}: ${target.name} is na 3 controles onbereikbaar. Incidentprocedure: docs/runbooks/incident-response.md`
        : `✅ VeyoCast ${options.environment}: ${target.name} is hersteld.`
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
    redirect: "error"
  });
  if (!response.ok) {
    options.onEvent?.("monitor.notification.failed", {
      status: response.status,
      target: target.name
    });
  }
}

async function readState(path: string): Promise<MonitorState> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as MonitorState
      : {};
  } catch {
    return {};
  }
}

async function writeState(path: string, state: MonitorState) {
  const temporaryPath = `${path}.next`;
  await writeFile(temporaryPath, JSON.stringify(state), { mode: 0o600 });
  await rename(temporaryPath, path);
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}
