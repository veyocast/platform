const { withAppBuildGradle } = require("@expo/config-plugins");

const signingEnvironment = [
  "ANDROID_SIGNING_STORE_FILE",
  "ANDROID_SIGNING_STORE_PASSWORD",
  "ANDROID_SIGNING_KEY_ALIAS",
  "ANDROID_SIGNING_KEY_PASSWORD"
];

module.exports = function withControlSigning(config) {
  return withAppBuildGradle(config, (androidConfig) => {
    const supplied = signingEnvironment.filter((name) => process.env[name]);
    if (supplied.length === 0) return androidConfig;
    if (supplied.length !== signingEnvironment.length) {
      throw new Error(
        `Onvolledige Android Control-signingconfiguratie: ${signingEnvironment
          .filter((name) => !process.env[name])
          .join(", ")} ontbreekt.`
      );
    }
    const source = androidConfig.modResults.contents;
    const signingMarker = "    signingConfigs {";
    const debugSigning = "signingConfig signingConfigs.debug";
    if (!source.includes(signingMarker) || !source.includes(debugSigning)) {
      throw new Error(
        "De gegenereerde Gradle-config heeft niet de verwachte signingstructuur."
      );
    }
    const withReleaseConfig = source.replace(
      signingMarker,
      `${signingMarker}
        release {
            storeFile file(System.getenv("ANDROID_SIGNING_STORE_FILE"))
            storePassword System.getenv("ANDROID_SIGNING_STORE_PASSWORD")
            keyAlias System.getenv("ANDROID_SIGNING_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_SIGNING_KEY_PASSWORD")
        }`
    );
    const releaseSigningIndex = withReleaseConfig.lastIndexOf(debugSigning);
    androidConfig.modResults.contents =
      withReleaseConfig.slice(0, releaseSigningIndex) +
      "signingConfig signingConfigs.release" +
      withReleaseConfig.slice(releaseSigningIndex + debugSigning.length);
    return androidConfig;
  });
};
