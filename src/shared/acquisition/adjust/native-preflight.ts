/**
 * GoGo-MobileApp#367 (PR #369 Astra F-01) — whether `react-native-adjust` may
 * be evaluated at all on this build.
 *
 * The wrapper reads `NativeModules.Adjust` and builds a `NativeEventEmitter`
 * while it is evaluated (`react-native-adjust/index.js:9-16`); on iOS the
 * emitter is `NativeModules.AdjustEventEmitter`, and `NativeEventEmitter`
 * refuses a null module on iOS. A build whose native side is missing (stale
 * pods, a failed New Architecture interop) therefore throws from the module
 * factory — and a `try/catch` around `import()` does not see that first:
 * Metro's `require` runs a deferred factory through `guardedLoadModule`, which
 * reports an evaluation error with `ErrorUtils.reportFatalError` before the
 * caller's promise rejects (metro-runtime `polyfills/require.js`). In a release
 * build that is a crash. So the modules the wrapper touches are checked here,
 * on the same `NativeModules` surface the wrapper reads, and the wrapper is
 * loaded only when they exist. Reading a missing name answers null on both the
 * bridge and the bridgeless proxy; it never throws.
 */
export const ADJUST_NATIVE_MODULES = { ios: ['Adjust', 'AdjustEventEmitter'], android: ['Adjust'] } as const

export function adjustNativeAvailable(
  os: string,
  nativeModules: Readonly<Record<string, unknown>> | null | undefined,
): boolean {
  if (os !== 'ios' && os !== 'android') return false
  if (!nativeModules) return false
  return ADJUST_NATIVE_MODULES[os].every(name => nativeModules[name] != null)
}
