type AndroidInstallEligibilityInput = {
  referrer: string;
  standalone: boolean;
  userAgent: string;
};

const nativeAndroidTvShellPattern = /\bVeyoCastAndroidTV\//i;

export function isAndroidPwaInstallEligible({
  referrer,
  standalone,
  userAgent
}: AndroidInstallEligibilityInput) {
  const runsInsideInstalledAndroidApp =
    referrer.startsWith("android-app://") || nativeAndroidTvShellPattern.test(userAgent);

  return /Android/i.test(userAgent) && !standalone && !runsInsideInstalledAndroidApp;
}
