import {
  Button,
  InlineAlert,
  StateView
} from "@veyocast/mobile-design-system";
import { AlertTriangle, RotateCcw } from "lucide-react-native";
import { View } from "react-native";

import { MobileApiError } from "../api/mobile-api";

export function AppError({
  error,
  onRetry
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const apiError = error instanceof MobileApiError ? error : null;
  const message =
    apiError?.message ??
    (error instanceof Error
      ? error.message
      : "Deze inhoud kon niet worden geladen.");
  const recovery =
    apiError?.recovery ??
    "Controleer je verbinding en probeer het opnieuw.";
  return (
    <View style={{ gap: 16 }}>
      <InlineAlert
        description={recovery}
        title={message}
        tone="critical"
      />
      {apiError?.requestId ? (
        <InlineAlert
          description={`Aanvraagcode: ${apiError.requestId}`}
          title={`Foutcode: ${apiError.code}`}
          tone="info"
        />
      ) : null}
      {onRetry ? (
        <Button
          icon={<RotateCcw color="#1A1917" size={20} />}
          onPress={onRetry}
          variant="secondary"
        >
          Opnieuw proberen
        </Button>
      ) : null}
    </View>
  );
}

export function FullScreenError({
  error,
  retry
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <StateView
      actionLabel="App opnieuw proberen"
      description={`${error.message}. Je gegevens zijn niet gewijzigd. Open herstel als dit blijft gebeuren.`}
      icon={<AlertTriangle color="#C7322B" size={32} />}
      onAction={retry}
      title="VeyoCast Control liep vast"
    />
  );
}
