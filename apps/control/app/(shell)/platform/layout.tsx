import type { ReactNode } from "react";

import { requireControlCapability } from "../../../lib/control-session";
import s from "./sites-platform.module.css";

export default async function PlatformLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  await requireControlCapability("platform.system.read");

  return <div className={s.platform}>{children}</div>;
}
