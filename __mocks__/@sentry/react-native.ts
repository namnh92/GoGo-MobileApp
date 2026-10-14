/**
 * jest stand-in for `@sentry/react-native` (mapped in `jest.config.js`). Only
 * `src/shared/observability/sentry.ts` imports the SDK; this records what that
 * file asks of it so the oracle's `init` rows can be checked without a native
 * runtime, and so no spec can ever send an event.
 */
export const init = jest.fn()
export const captureException = jest.fn()
export const setUser = jest.fn()
export const wrap = jest.fn(<T>(component: T): T => component)

/** A scope whose setters record what would be forwarded to the native SDKs. */
function fakeScope() {
  const scope = {
    forwarded: [] as [string, ...unknown[]][],
    setUser: jest.fn(),
    setTag: jest.fn(),
    setTags: jest.fn(),
    setExtra: jest.fn(),
    setExtras: jest.fn(),
    setContext: jest.fn(),
    setAttribute: jest.fn(),
    setAttributes: jest.fn(),
  }
  for (const name of ['setUser', 'setTag', 'setTags', 'setExtra', 'setExtras', 'setContext', 'setAttribute', 'setAttributes'] as const) {
    scope[name] = jest.fn((...args: unknown[]) => {
      scope.forwarded.push([name, ...args])
      return scope
    })
  }
  return scope
}

export let globalScope = fakeScope()
export let isolationScope = fakeScope()
export const getGlobalScope = jest.fn(() => globalScope)
export const getIsolationScope = jest.fn(() => isolationScope)
export function resetScopesForTests() {
  globalScope = fakeScope()
  isolationScope = fakeScope()
}
