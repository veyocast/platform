import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export function NotificationRouter() {
  const router = useRouter();
  useEffect(() => {
    function route(response: Notifications.NotificationResponse | null) {
      if (!response) return;
      const data = response.notification.request.content.data ?? {};
      const screenId =
        typeof data.screenId === "string" && isUuid(data.screenId)
          ? data.screenId
          : null;
      if (screenId) {
        router.push(`/screens/${screenId}`);
        return;
      }
      const destination = data.destination;
      if (destination === "content") router.push("/(tabs)/content");
      if (destination === "today") router.push("/(tabs)/vandaag");
    }
    void Notifications.getLastNotificationResponseAsync().then(route);
    const subscription =
      Notifications.addNotificationResponseReceivedListener(route);
    return () => subscription.remove();
  }, [router]);
  return null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
