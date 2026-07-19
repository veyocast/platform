import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { deviceLabCookieName, isValidDeviceLabSession } from "../_lib/device-lab-auth";
import { DeviceLabClient } from "./device-lab-client";
import { readPlayerAppVersion } from "../_lib/runtime-health";

type DeviceLabPageProps = { searchParams: Promise<{ token?: string }> };

export default async function DeviceLabPage({ searchParams }: DeviceLabPageProps) {
  const { token } = await searchParams;
  if (token) redirect(`/api/device-lab/session?token=${encodeURIComponent(token)}`);

  const cookieStore = await cookies();
  if (!isValidDeviceLabSession(cookieStore.get(deviceLabCookieName)?.value)) notFound();

  return (
    <DeviceLabClient
      appVersion={readPlayerAppVersion()}
      deploymentSha={process.env.VERCEL_GIT_COMMIT_SHA?.trim() || process.env.DEPLOYMENT_SHA?.trim() || "local"}
    />
  );
}
