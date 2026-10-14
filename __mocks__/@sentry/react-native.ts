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
