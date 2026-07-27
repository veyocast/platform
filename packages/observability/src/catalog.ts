export const observabilityEvents = [
  "deployment.health.checked",
  "media.job.claimed",
  "media.job.completed",
  "media.job.failed",
  "media.queue.polled",
  "media.worker.draining",
  "media.worker.started",
  "media.worker.stopped",
  "monitor.disabled",
  "monitor.notification.failed",
  "monitor.target.checked",
  "player.release.activated",
  "player.startup.completed",
  "publisher.schedule.evaluated",
  "publisher.schedule.failed",
  "screen.heartbeat.received",
  "screen.release.sync_completed",
  "screen.release.sync_failed",
  "studio.render.completed",
  "studio.render.failed",
  "studio.render.queue_polled",
  "dynamic.render.completed",
  "dynamic.render.failed",
  "dynamic.render.queue_polled",
  "dynamic.rss.completed",
  "dynamic.rss.failed",
  "dynamic.rss.queue_polled",
  "support.bundle.exported"
] as const;

export type ObservabilityEvent = (typeof observabilityEvents)[number];

export function isObservabilityEvent(value: string): value is ObservabilityEvent {
  return (observabilityEvents as readonly string[]).includes(value);
}
