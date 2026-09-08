/**
 * NTF-APP-004 (#51) — pin OneSignalXCFramework to the Identity Verification beta.
 *
 * OneSignal support confirmed on 2026-09-08 that Identity Verification on iOS
 * requires OneSignalXCFramework 5.3.0-beta-03; the general 5.5.x releases do not
 * support it. The framework agrees: 5.5.6 ships only
 * `onJwtExpiredWithExpiredHandler:` and none of the identity APIs, while the
 * beta ships `addUserJwtInvalidatedListener:` / `updateUserJwtWithExternalId:token:`
 * and drops `onJwtExpired`. They are mutually exclusive, so this is not a
 * preference — the native module compiles against one or the other.
 *
 * Two edits, because two different constraints would otherwise win:
 *
 *   1. `react-native-onesignal`'s podspec hard-pins an exact version
 *      (`onesignal_xcframework_version = '5.5.6'`), not a range, so the
 *      resolver has no room to pick anything else;
 *   2. `onesignal-expo-plugin` writes `>= 5.0, < 6.0` for the notification
 *      service extension. A plain range never matches a pre-release in
 *      CocoaPods, so that target has to name the beta explicitly.
 *
 * Both files are generated — `ios/` by prebuild, the podspec by install — which
 * is exactly why this is a plugin rather than a hand edit: a `prebuild --clean`
 * or a reinstall would otherwise silently drop back to 5.5.6 and the module
 * would stop compiling with no obvious reason why.
 *
 * Remove this when a general release supports Identity Verification on iOS.
 */
const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

const BETA = '5.3.0-beta-03'

/**
 * A `post_install` hook that repairs a packaging bug in the beta's own header.
 *
 * `OneSignalFramework.h` declares `+addUserJwtInvalidatedListener:` and
 * `+removeUserJwtInvalidatedListener:` taking `id<OSUserJwtInvalidatedListener>`,
 * but its "Forward declarations for Objective-C++ compatibility" block lists
 * only `OSUser` and `OSLiveActivities`. In a `.mm` translation unit the
 * Swift-generated header is not visible, so the protocol is unknown and the
 * compile fails inside OneSignal's own header — observed in the
 * `react-native-onesignal` and `react-native-safe-area-context` targets, both
 * of which pull it in transitively.
 *
 * One forward declaration fixes it. Written as a Podfile hook rather than a
 * file edit because `pod install` restores the vendored headers every time.
 */
const POST_INSTALL_PATCH = `
  # NTF-APP-004: OneSignalXCFramework ${BETA} omits a forward declaration that
  # its own ObjC++ consumers need. See plugins/with-onesignal-identity-beta.js.
  Dir.glob(File.join(installer.sandbox.root, 'OneSignalXCFramework', '**', 'OneSignalFramework.h')).each do |header|
    contents = File.read(header)
    next if contents.include?('@protocol OSUserJwtInvalidatedListener;')
    next unless contents.include?('@protocol OSLiveActivities;')
    File.write(header, contents.sub('@protocol OSLiveActivities;', "@protocol OSLiveActivities;\\n@protocol OSUserJwtInvalidatedListener;"))
  end
`

function pinPodspec(projectRoot) {
  // Resolved rather than joined: pnpm keeps the real package under .pnpm.
  let podspec
  try {
    podspec = path.join(
      path.dirname(require.resolve('react-native-onesignal/package.json', { paths: [projectRoot] })),
      'react-native-onesignal.podspec',
    )
  } catch {
    return { changed: false, reason: 'react-native-onesignal not resolvable' }
  }
  if (!fs.existsSync(podspec)) return { changed: false, reason: 'podspec missing' }
  const before = fs.readFileSync(podspec, 'utf8')
  const after = before.replace(
    /onesignal_xcframework_version\s*=\s*'[^']+'/,
    `onesignal_xcframework_version = '${BETA}'`,
  )
  if (after === before) return { changed: false, reason: 'already pinned or shape changed' }
  fs.writeFileSync(podspec, after)
  return { changed: true }
}

function pinPodfile(iosRoot) {
  const podfile = path.join(iosRoot, 'Podfile')
  if (!fs.existsSync(podfile)) return { changed: false, reason: 'Podfile missing' }
  const before = fs.readFileSync(podfile, 'utf8')
  let after = before.replace(
    /pod 'OneSignalXCFramework',\s*'>= 5\.0',\s*'< 6\.0'/g,
    `pod 'OneSignalXCFramework', '${BETA}'`,
  )
  // Append the header repair inside the existing post_install block.
  if (!after.includes('@protocol OSUserJwtInvalidatedListener;')) {
    after = after.replace(/(\n\s*post_install do \|installer\|\n)/, `$1${POST_INSTALL_PATCH}`)
  }
  if (after === before) return { changed: false, reason: 'no range constraint found' }
  fs.writeFileSync(podfile, after)
  return { changed: true }
}

module.exports = function withOneSignalIdentityBeta(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot
      const iosRoot = cfg.modRequest.platformProjectRoot
      const spec = pinPodspec(projectRoot)
      const file = pinPodfile(iosRoot)
      // Loud on failure: a silent no-op here surfaces much later as a Swift
      // compile error about a missing symbol, which reads like our bug.
      if (!spec.changed && spec.reason !== 'already pinned or shape changed') {
        console.warn(`[onesignal-identity-beta] podspec not pinned: ${spec.reason}`)
      }
      if (!file.changed && file.reason !== 'no range constraint found') {
        console.warn(`[onesignal-identity-beta] Podfile not pinned: ${file.reason}`)
      }
      return cfg
    },
  ])
}
