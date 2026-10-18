type NativeSession = { user: { id: string } };

/** Publish the next actor only after all preceding actor data was removed. */
export async function applyNativeSessionTransition<T extends NativeSession>(
  actor: { current: string | null },
  next: T | null,
  boundary: {
    hide: () => void;
    cancelQueries: () => Promise<unknown>;
    clearQueries: () => void;
    clearTenantCaches: () => Promise<void>;
    publish: (session: T | null) => void;
  },
) {
  const nextUser = next?.user.id ?? null;
  if (actor.current !== nextUser) {
    const previousUser = actor.current;
    boundary.hide();
    await boundary.cancelQueries();
    boundary.clearQueries();
    if (previousUser) await boundary.clearTenantCaches();
    actor.current = nextUser;
  }
  boundary.publish(next);
}
