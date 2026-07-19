import type { ReactNode } from "react";

import { requireControlRole } from "../../../lib/control-session";

export default async function PlatformLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  await requireControlRole("platform_admin");

  return children;
}
