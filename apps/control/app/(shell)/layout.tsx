import type { ReactNode } from "react";

import { requireControlSession } from "../../lib/control-session";
import { ControlShell } from "./_components/control-shell";
import { getNavigationGroupsForRoles } from "./_lib/control-navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ShellLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  const session = await requireControlSession();
  const navigationGroups = getNavigationGroupsForRoles(session.roles);

  return (
    <ControlShell
      navigationGroups={navigationGroups}
      session={session}
    >
      {children}
    </ControlShell>
  );
}
