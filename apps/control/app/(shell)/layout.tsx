import type { ReactNode } from "react";

import { ControlShell } from "./_components/control-shell";
import {
  demoControlSession,
  getNavigationGroupsForRoles
} from "./_lib/control-navigation";

export default function ShellLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  const navigationGroups = getNavigationGroupsForRoles(demoControlSession.roles);

  return (
    <ControlShell
      navigationGroups={navigationGroups}
      session={demoControlSession}
    >
      {children}
    </ControlShell>
  );
}
