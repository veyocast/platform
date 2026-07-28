import type { ConfigContext, ExpoConfig } from "expo/config";

const packageName = "nl.veyocast.control";
const versionCode = Number.parseInt(
  process.env.VEYOCAST_CONTROL_VERSION_CODE ?? "300000001",
  10
);

if (!Number.isInteger(versionCode) || versionCode < 300_000_000 || versionCode > 399_999_999) {
  throw new Error(
    "VEYOCAST_CONTROL_VERSION_CODE moet tussen 300000000 en 399999999 liggen."
  );
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "VeyoCast Control",
  slug: "veyocast-control",
  owner: "veyocast",
  version: process.env.VEYOCAST_CONTROL_VERSION_NAME ?? "1.0.0",
  orientation: "default",
  icon: "../../assets/brand/veyocast-social-avatar-1024.png",
  scheme: "veyocast-control",
  userInterfaceStyle: "automatic",
  experiments: {
    typedRoutes: true
  },
  android: {
    allowBackup: false,
    package: packageName,
    versionCode,
    adaptiveIcon: {
      foregroundImage: "../../assets/brand/veyocast-icon-512.png",
      backgroundColor: "#121212"
    },
    permissions: [
      "android.permission.CAMERA",
      "android.permission.POST_NOTIFICATIONS"
    ],
    blockedPermissions: [
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.READ_CONTACTS",
      "android.permission.WRITE_CONTACTS",
      "android.permission.READ_PHONE_STATE",
      "android.permission.RECORD_AUDIO",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "com.google.android.gms.permission.AD_ID"
    ],
    ...(process.env.ANDROID_CONTROL_GOOGLE_SERVICES_FILE
      ? {
          googleServicesFile:
            process.env.ANDROID_CONTROL_GOOGLE_SERVICES_FILE
        }
      : {}),
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "veyocast-control"
          },
          {
            scheme: "https",
            host: "control.veyocast.nl",
            pathPrefix: "/mobile"
          }
        ],
        category: ["BROWSABLE", "DEFAULT"]
      }
    ]
  },
  plugins: [
    "expo-router",
    "./plugins/with-control-signing.cjs",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#F7F3EC",
        image: "../../assets/brand/veyocast-icon-512.png",
        imageWidth: 152,
        dark: {
          backgroundColor: "#10100F",
          image: "../../assets/brand/veyocast-icon-512.png"
        }
      }
    ],
    [
      "expo-camera",
      {
        cameraPermission:
          "VeyoCast Control gebruikt de camera alleen om een schermcode te scannen of een foto te maken.",
        recordAudioAndroid: false
      }
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Kies alleen media die je via VeyoCast op jouw schermen wilt publiceren.",
        cameraPermission:
          "VeyoCast Control gebruikt de camera alleen wanneer je zelf een foto wilt maken.",
        microphonePermission: false
      }
    ],
    [
      "expo-notifications",
      {
        color: "#FF5C20",
        defaultChannel: "screen-status"
      }
    ],
    [
      "expo-local-authentication",
      {
        faceIDPermission:
          "Gebruik biometrie om VeyoCast Control opnieuw te ontgrendelen."
      }
    ],
    [
      "expo-secure-store",
      {
        configureAndroidBackup: false,
        faceIDPermission:
          "Gebruik biometrie om VeyoCast Control opnieuw te ontgrendelen."
      }
    ],
    [
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          minSdkVersion: 26,
          buildToolsVersion: "36.0.0",
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          usesCleartextTraffic: false
        }
      }
    ]
  ],
  extra: {
    controlOrigin:
      process.env.EXPO_PUBLIC_CONTROL_ORIGIN ?? "https://control.veyocast.nl",
    packageName
  }
});
