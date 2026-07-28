import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";

import { notificationDestination } from "./destination";

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
      const destination = notificationDestination(data);
      if (destination) router.push(destination as never);
    }
    void Notifications.getLastNotificationResponseAsync().then(route);
    const subscription =
      Notifications.addNotificationResponseReceivedListener(route);
    return () => subscription.remove();
  }, [router]);
  return null;
}
