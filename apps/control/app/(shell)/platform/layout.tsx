import type { ReactNode } from "react";

import { requireControlCapability } from "../../../lib/control-session";

export default async function PlatformLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  await requireControlCapability("platform.system.read");

  return children;
}
