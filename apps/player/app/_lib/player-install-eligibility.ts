type AndroidInstallEligibilityInput = {
  referrer: string;
  standalone: boolean;
  userAgent: string;
};

const nativeAndroidShellPattern = /\bVeyoCastAndroid(?:TV)?\//i;

export function isAndroidPwaInstallEligible({
  referrer,
  standalone,
  userAgent
}: AndroidInstallEligibilityInput) {
  const runsInsideInstalledAndroidApp =
    referrer.startsWith("android-app://") || nativeAndroidShellPattern.test(userAgent);

  return /Android/i.test(userAgent) && !standalone && !runsInsideInstalledAndroidApp;
}
