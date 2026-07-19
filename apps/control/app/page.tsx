import { redirect } from "next/navigation";

import {
  getControlLandingPath,
  getControlSession
} from "../lib/control-session";

export const dynamic = "force-dynamic";

export default async function ControlPage() {
  const session = await getControlSession();

  redirect(session ? getControlLandingPath(session) : "/login");
}
