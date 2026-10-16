/**
 * GoGo-MobileApp#340, ADR-0011 D-5 phase 2. Expo's default Metro config plus
 * Sentry's serializer, which stamps each bundle and its source map with the
 * same Debug ID, so Sentry matches a crash to its map by identity rather than
 * by release/dist strings computed twice.
 *
 * Every optional behaviour is off and named, so nothing here changes what the
 * app sends (`src/shared/observability/sentry.ts` stays the only boundary):
 * no source-context middleware on the dev server, no `sentry.options.json`
 * merged into the bundle, no release constant injected for web, no component
 * annotation or error-boundary wrapping, and the web-only replay and feedback
 * packages resolve to empty on every platform (their default is "bundled if
 * reached"; the app uses neither — ADR 0010). What remains beyond the Debug ID
 * is what `getSentryExpoConfig` always applies: Sentry frames collapsed in
 * LogBox (development only) and server-only Sentry modules resolved to empty.
 */
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

module.exports = getSentryExpoConfig(__dirname, {
  enableSourceContextInDevelopment: false,
  optionsFile: false,
  injectReleaseForWeb: false,
  annotateReactComponents: false,
  autoWrapExpoRouterErrorBoundary: false,
  includeWebReplay: false,
  includeWebFeedback: false,
})
