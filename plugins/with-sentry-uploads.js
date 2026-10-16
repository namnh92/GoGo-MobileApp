/**
 * GoGo-MobileApp#340, ADR-0011 D-5 phase 2 — Sentry's Expo config plugin,
 * applied with this project's coordinates.
 *
 * A Release build uploads its JavaScript source map and (iOS) dSYMs to
 * gogo-mobile, so a crash reads as source file and line. The plugin writes
 * ios/ and android/ `sentry.properties` with the three values below and wires
 * the upload phases; `scripts/release-build.sh` decides per build, from
 * SENTRY_AUTH_TOKEN, whether they upload.
 *
 * Why a wrapper and not `['@sentry/react-native/expo', { … }]` in app.config.ts:
 * Expo serializes every `plugins` entry, options included, into the public
 * config embedded in the binary (`EXConstants.bundle/app.config`) and served
 * by the dev server. Registered here, the shipped config names only this file.
 *
 * Deliberately absent: `authToken` — it would be written into both
 * `sentry.properties` files — and `disableAutoUpload`, which would bake a fixed
 * answer into build.gradle and both Xcode phases.
 */
const { withSentry } = require('@sentry/react-native/expo')

const SENTRY_UPLOAD_TARGET = {
  organization: 'gogo-vn',
  project: 'gogo-mobile',
  url: 'https://sentry.io/',
}

function withSentryUploads(config) {
  return withSentry(config, SENTRY_UPLOAD_TARGET)
}

module.exports = withSentryUploads
module.exports.SENTRY_UPLOAD_TARGET = SENTRY_UPLOAD_TARGET
