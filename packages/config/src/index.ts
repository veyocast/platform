export type VeyoCastAppId = "control" | "player" | "marketing" | "media-worker";

export type VeyoCastAppConfig = {
  id: VeyoCastAppId;
  name: string;
  port: number;
};

export const VEYOCAST_PORTS = {
  control: 3000,
  player: 3001,
  marketing: 3002,
  "media-worker": 3100
} as const satisfies Record<VeyoCastAppId, number>;

export const VEYOCAST_APPS = {
  control: {
    id: "control",
    name: "VeyoCast Control",
    port: VEYOCAST_PORTS.control
  },
  player: {
    id: "player",
    name: "VeyoCast Player",
    port: VEYOCAST_PORTS.player
  },
  marketing: {
    id: "marketing",
    name: "VeyoCast Marketing",
    port: VEYOCAST_PORTS.marketing
  },
  "media-worker": {
    id: "media-worker",
    name: "VeyoCast Media Worker",
    port: VEYOCAST_PORTS["media-worker"]
  }
} as const satisfies Record<VeyoCastAppId, VeyoCastAppConfig>;

export function getLocalUrl(appId: VeyoCastAppId) {
  return `http://localhost:${VEYOCAST_PORTS[appId]}`;
}
