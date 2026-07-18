import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { deviceLabCookieName, isValidDeviceLabSession } from "../_lib/device-lab-auth";
import { DeviceLabClient } from "./device-lab-client";

type DeviceLabPageProps = { searchParams: Promise<{ token?: string }> };

export default async function DeviceLabPage({ searchParams }: DeviceLabPageProps) {
  const { token } = await searchParams;
  if (token) redirect(`/api/device-lab/session?token=${encodeURIComponent(token)}`);

  const cookieStore = await cookies();
  if (!isValidDeviceLabSession(cookieStore.get(deviceLabCookieName)?.value)) notFound();

  return (
    <DeviceLabClient
      appVersion={process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "development"}
      deploymentSha={process.env.VERCEL_GIT_COMMIT_SHA?.trim() || process.env.DEPLOYMENT_SHA?.trim() || "local"}
    />
  );
}
