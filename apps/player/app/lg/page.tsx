import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LgSignageBridge } from "../_components/lg-signage-bridge";
import { PlayerRuntime } from "../_components/player-runtime";

export const dynamic = "force-dynamic";

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

export default async function LgSignagePlayerPage() {
  const userAgent = (await headers()).get("user-agent") ?? "";

  if (/web0s|webos|netcast|lg browser|\blge\b/i.test(userAgent)) {
    redirect("/lg/legacy");
  }

  return (
    <>
      <LgSignageBridge />
      <PlayerRuntime />
    </>
  );
}
