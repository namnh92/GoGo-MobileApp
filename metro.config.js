/**
 * GoGo-MobileApp#340, ADR-0011 D-5 phase 2. Expo's default Metro config plus
 * Sentry's serializer, which stamps each bundle and its source map with the
 * same Debug ID, so Sentry matches a crash to its map by identity rather than
 * by release/dist strings computed twice. Default options only: no component
 * annotation, no error-boundary wrapping — nothing that changes what the app
 * sends (`src/shared/observability/sentry.ts` stays the only boundary).
 */
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

module.exports = getSentryExpoConfig(__dirname)
