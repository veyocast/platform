const {
  AndroidConfig,
  withAndroidManifest
} = require("@expo/config-plugins");

module.exports = function withControlManifestHygiene(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(
      androidConfig.modResults
    );

    for (const intentFilter of mainActivity["intent-filter"] ?? []) {
      if (!intentFilter.$) continue;
      delete intentFilter.$["data-generated"];
      if (Object.keys(intentFilter.$).length === 0) {
        delete intentFilter.$;
      }
    }

    return androidConfig;
  });
};
