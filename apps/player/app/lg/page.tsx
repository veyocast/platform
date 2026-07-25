import type { Metadata } from "next";

import { LgSignageBridge } from "../_components/lg-signage-bridge";
import { PlayerRuntime } from "../_components/player-runtime";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://player.veyocast.nl/lg"
  },
  robots: {
    follow: false,
    index: false
  },
  title: "VeyoCast Player voor LG webOS Signage"
};

export default function LgSignagePlayerPage() {
  return (
    <>
      <LgSignageBridge />
      <PlayerRuntime />
    </>
  );
}
