import { useCallback, useEffect, useRef, useState } from "react";
import type { StudioDocument } from "@veyocast/studio/mobile-v3";
import { readRequiredTenantCache, writeRequiredTenantCache, removeRequiredTenantCache, tenantCacheGeneration } from "../storage/tenant-cache";
import { hydrateSyncRecovery, newSyncRecovery, syncStudioRecoveryKey, syncStudioRecoverySchema, validateSyncRecovery, type SyncStudioScope, type SyncStudioRecovery } from "./studio-recovery";

/** Mount this hook under a user/tenant/project key; no previous context can update the next editor. */
export function useStudioRecovery(scope: SyncStudioScope, initialDocument: StudioDocument, currentRevision: number) {
  const [record, setRecord] = useState<SyncStudioRecovery | null>(null);
  const [error, setError] = useState<unknown>(null);
  const latest = useRef<SyncStudioRecovery | null>(null);
  const alive = useRef(true);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const key = syncStudioRecoveryKey(scope);
  const scopeRef = useRef(scope);
  const generation = useRef(tenantCacheGeneration(scope.tenantId, key));

  useEffect(() => {
    let active = true;
    alive.current = true;
    const currentScope = scopeRef.current;
    void readRequiredTenantCache(currentScope.tenantId, key, syncStudioRecoverySchema).then(stored => {
      if (!active) return;
      const value = stored ? hydrateSyncRecovery(currentScope, stored, initialDocument, currentRevision) : newSyncRecovery(currentScope, initialDocument, currentRevision);
      latest.current = value;
      setRecord(value);
    }).catch(() => { if (active) setError(new Error("Je lokale concept kon niet veilig worden gelezen. Er is niets verstuurd; houd je huidige sessie open en probeer Studio opnieuw.")); });
    return () => { active = false; alive.current = false; };
    // Current reads are reconciled explicitly; refetch never replaces local input or a pending command.
  }, [key]);

  const persist = useCallback(async (next: SyncStudioRecovery) => {
    const checked = validateSyncRecovery(scopeRef.current, next);
    if (!alive.current) throw new Error("De organisatie of het ontwerp is gewijzigd. Open het ontwerp opnieuw.");
    latest.current = checked;
    setRecord(checked);
    const write = writeRequiredTenantCache(checked.tenantId, key, checked, generation.current);
    writes.current = write;
    try { await write; if (alive.current) setError(null); }
    catch (value) { if (alive.current) setError(new Error("Je invoer kon niet lokaal worden bevestigd. Er wordt geen nieuwe opdracht verstuurd. Houd dit scherm open en probeer opnieuw.", { cause: value })); throw value; }
    return alive.current;
  }, [key]);

  const edit = useCallback((document: StudioDocument) => {
    const value = latest.current;
    if (!value || value.pending) return;
    void persist({ ...value, document, fieldInput: {}, dirty: true }).catch(() => undefined);
  }, [persist]);

  const clear = useCallback(async () => {
    await writes.current.catch(() => undefined);
    if (!alive.current) return;
    await removeRequiredTenantCache(scopeRef.current.tenantId, key);
    const fresh = newSyncRecovery(scopeRef.current, initialDocument, currentRevision);
    latest.current = fresh;
    setRecord(fresh);
    setError(null);
  }, [key]);

  useEffect(() => {
    const value = latest.current;
    if (!value || value.draftRevision === currentRevision) return;
    const next = hydrateSyncRecovery(scopeRef.current, value, initialDocument, currentRevision);
    void persist(next).catch(() => undefined);
  }, [currentRevision, initialDocument, persist]);

  return { record, latest, error, persist, edit, clear, alive };
}
