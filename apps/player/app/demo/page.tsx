import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  acceptsPlayerDemoSession,
  playerDemoCookieName
} from "../_lib/player-demo-auth";
import { DemoPlayerRuntime } from "./_components/demo-player-runtime";

export const dynamic = "force-dynamic";

export default async function PlayerDemoPage() {
  const cookieStore = await cookies();
  if (
    !acceptsPlayerDemoSession(cookieStore.get(playerDemoCookieName)?.value)
  ) {
    redirect("/");
  }

  return <DemoPlayerRuntime />;
}
