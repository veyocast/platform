/** Account-changing UI actions and MFA share the existing client's session in order. */
let sessionOperation: Promise<void> = Promise.resolve();
export function runNativeSessionOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = sessionOperation.then(operation);
  sessionOperation = result.then(() => undefined, () => undefined);
  return result;
}
