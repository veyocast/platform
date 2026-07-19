import type { ReactNode } from "react";

import { requireTenantControlSession } from "../../../lib/control-session";

export default async function TenantLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  await requireTenantControlSession();

  return children;
}
