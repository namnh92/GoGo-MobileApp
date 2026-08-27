// Stand-in for expo-crypto under Node. `globalThis.crypto` is available from
// Node 19 on, so the tests get real UUIDs without pulling @types/node into a
// React Native project.
export function randomUUID(): string {
  return globalThis.crypto.randomUUID()
}
