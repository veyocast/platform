import { CASTIVO_APPS, getLocalUrl } from "@castivo/config";

export type WorkerHealth = {
  service: string;
  status: "ok";
  checkedAt: string;
  controlUrl: string;
};

export function getWorkerHealth(now = new Date()): WorkerHealth {
  return {
    service: CASTIVO_APPS["media-worker"].name,
    status: "ok",
    checkedAt: now.toISOString(),
    controlUrl: getLocalUrl("control")
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  console.log(JSON.stringify(getWorkerHealth(), null, 2));
}
