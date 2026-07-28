import {
  AppShell,
  ScreenScrollView,
  StateView
} from "@veyocast/mobile-design-system";
import { ShieldAlert } from "lucide-react-native";

import { useAuth } from "../../src/auth/auth-provider";

export default function ConfigurationErrorScreen() {
  const { configurationError } = useAuth();
  return (
    <AppShell>
      <ScreenScrollView>
        <StateView
          description={
            configurationError ??
            "De appconfiguratie is niet geldig voor deze omgeving."
          }
          icon={<ShieldAlert color="#C7322B" size={36} />}
          title="Buildconfiguratie ontbreekt"
        />
      </ScreenScrollView>
    </AppShell>
  );
}
