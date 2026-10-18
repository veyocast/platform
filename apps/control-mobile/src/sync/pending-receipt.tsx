import { Button, InlineAlert, Skeleton, mobileSpacing } from "@veyocast/mobile-design-system";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { mobileApi } from "../api/mobile-api";
import { AppError } from "../components/app-error";
import { readRequiredTenantCache, removeRequiredTenantCache, writeRequiredTenantCache, tenantCacheGeneration } from "../storage/tenant-cache";
import { assertSyncReceipt, syncStudioRecoveryKey, syncStudioRecoverySchema, validateSyncRecovery, type SyncStudioScope, type SyncStudioRecovery } from "./studio-recovery";

/** An archived project's missing read does not erase its previous command receipt. */
export function PendingStudioReceipt({ scope, fallback }: { scope: SyncStudioScope; fallback: React.ReactNode }) {
  const router = useRouter();
  const [record, setRecord] = useState<SyncStudioRecovery | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const key = syncStudioRecoveryKey(scope);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void readRequiredTenantCache(scope.tenantId, key, syncStudioRecoverySchema).then(value => { if (active && value) setRecord(validateSyncRecovery(scope, value)); })
      .catch(() => { if (active) setError(new Error("Je lokale opdracht kon niet veilig worden gelezen. Er is geen nieuwe opdracht verstuurd; open Studio opnieuw.")); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; mounted.current = false; };
  }, [scope.tenantId, key]);
  async function retry() {
    if (!record?.pending || busy) return;
    const generation = tenantCacheGeneration(scope.tenantId, key);
    setBusy(true); setError(null);
    try {
      const result = await mobileApi.mutateStudioV3(scope.tenantId, record.pending, scope.userId);
      assertSyncReceipt(record.pending, result);
      if (!mounted.current || tenantCacheGeneration(scope.tenantId, key) !== generation) return;
      if (result.outcome === "conflict") {
        await writeRequiredTenantCache(scope.tenantId, key, { ...record, conflict: true, pending: null }, generation);
        setRecord({ ...record, conflict: true, pending: null });
        throw Error("De opdracht is afgewezen wegens een versieconflict. Je lokale invoer blijft bewaard; open de actuele versie vanuit Studio.");
      }
      await removeRequiredTenantCache(scope.tenantId, key);
      router.replace(`/studio/designs/${result.series?.nextProjectId ?? result.projectId}`);
    } catch (value) { if (mounted.current) setError(value); }
    finally { if (mounted.current) setBusy(false); }
  }
  if (!loaded) return <Skeleton height={100} />;
  return <View style={{ gap: mobileSpacing.default }}>
    {record?.pending ? <>
      <InlineAlert title="Eerdere opdracht nog niet bevestigd" description="Dit ontwerp kan momenteel niet worden geopend. Je eerder opgeslagen opdracht kan al zijn verwerkt; bevestig precies dezelfde opdracht om het ontvangstbewijs te herstellen." tone="warning" />
      <Button loading={busy} onPress={() => void retry()}>Dezelfde opdracht bevestigen</Button>
    </> : fallback}
    {error ? <AppError error={error} /> : null}
  </View>;
}
