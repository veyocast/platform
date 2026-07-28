import { Redirect } from "expo-router";

import { useAuth } from "../src/auth/auth-provider";

export default function IndexRoute() {
  const { configurationError, session } = useAuth();
  if (configurationError) {
    return <Redirect href="/(auth)/configuration-error" />;
  }
  return <Redirect href={session ? "/(tabs)/vandaag" : "/(auth)/login"} />;
}
