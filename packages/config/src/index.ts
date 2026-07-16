export type CastivoAppId = "control" | "player" | "marketing" | "media-worker";

export type CastivoAppConfig = {
  id: CastivoAppId;
  name: string;
  port: number;
};

export const CASTIVO_PORTS = {
  control: 3000,
  player: 3001,
  marketing: 3002,
  "media-worker": 3100
} as const satisfies Record<CastivoAppId, number>;

export const CASTIVO_APPS = {
  control: {
    id: "control",
    name: "Castivo Control",
    port: CASTIVO_PORTS.control
  },
  player: {
    id: "player",
    name: "Castivo Player",
    port: CASTIVO_PORTS.player
  },
  marketing: {
    id: "marketing",
    name: "Castivo Marketing",
    port: CASTIVO_PORTS.marketing
  },
  "media-worker": {
    id: "media-worker",
    name: "Castivo Media Worker",
    port: CASTIVO_PORTS["media-worker"]
  }
} as const satisfies Record<CastivoAppId, CastivoAppConfig>;

export function getLocalUrl(appId: CastivoAppId) {
  return `http://localhost:${CASTIVO_PORTS[appId]}`;
}
