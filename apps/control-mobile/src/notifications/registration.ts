import * as Application from "expo-application";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { mobileApi } from "../api/mobile-api";

const deviceIdKey = "veyocast.control.notification-device";

export async function enablePushNotifications() {
  if (Platform.OS !== "android" || !Device.isDevice) {
    throw new Error(
      "Pushmeldingen kunnen alleen op een fysiek Android-apparaat worden ingeschakeld."
    );
  }
  await Notifications.setNotificationChannelAsync("screen-status", {
    description: "Operationele scherm- en Playerstatus",
    importance: Notifications.AndroidImportance.HIGH,
    name: "Schermstatus",
    vibrationPattern: [0, 250, 150, 250]
  });
  const current = await Notifications.getPermissionsAsync();
  const permission =
    current.status === "granted"
      ? current
      : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error(
      "Android heeft geen toestemming voor VeyoCast-meldingen gegeven."
    );
  }
  const nativeToken = await Notifications.getDevicePushTokenAsync();
  if (typeof nativeToken.data !== "string") {
    throw new Error("Android gaf geen bruikbaar FCM-token terug.");
  }
  const registration = await mobileApi.registerNotificationDevice({
    appVersion: Application.nativeApplicationVersion ?? "1.0.0",
    locale: Intl.DateTimeFormat().resolvedOptions().locale ?? null,
    pushToken: nativeToken.data,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  });
  await SecureStore.setItemAsync(deviceIdKey, registration.deviceId, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
  return registration.deviceId;
}

export async function disablePushNotifications() {
  const deviceId = await SecureStore.getItemAsync(deviceIdKey);
  if (deviceId) await mobileApi.revokeNotificationDevice(deviceId);
  await SecureStore.deleteItemAsync(deviceIdKey);
}

export async function hasPushRegistration() {
  return Boolean(await SecureStore.getItemAsync(deviceIdKey));
}
