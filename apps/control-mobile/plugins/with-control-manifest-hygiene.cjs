const fs = require("node:fs/promises");
const path = require("node:path");
const {
  AndroidConfig,
  withAndroidManifest,
  withAndroidStyles,
  withDangerousMod
} = require("@expo/config-plugins");

const splashBehaviorName = "android:windowSplashScreenBehavior";

module.exports = function withControlManifestHygiene(config) {
  config = withAndroidManifest(config, (androidConfig) => {
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

  config = withAndroidStyles(config, (androidConfig) => {
    const splashStyle = androidConfig.modResults.resources.style?.find(
      (style) => style.$?.name === "Theme.App.SplashScreen"
    );
    if (splashStyle?.item) {
      splashStyle.item = splashStyle.item.filter(
        (item) => item.$?.name !== splashBehaviorName
      );
    }
    return androidConfig;
  });

  return withDangerousMod(config, [
    "android",
    async (androidConfig) => {
      const valuesV33 = path.join(
        androidConfig.modRequest.projectRoot,
        "android",
        "app",
        "src",
        "main",
        "res",
        "values-v33"
      );
      await fs.mkdir(valuesV33, { recursive: true });
      await fs.writeFile(
        path.join(valuesV33, "styles.xml"),
        `<resources>
  <style name="Theme.App.SplashScreen">
    <item name="${splashBehaviorName}">icon_preferred</item>
  </style>
</resources>
`
      );
      return androidConfig;
    }
  ]);
};
