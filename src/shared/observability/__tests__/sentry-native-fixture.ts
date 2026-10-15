import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * A native project in the shape `@sentry/react-native/expo` 8.30.0 generates
 * (taken from a real `expo prebuild` of this app, trimmed to the parts the
 * Sentry checks read). Each `Partial` field replaces one file's text, so a test
 * states exactly which piece it breaks.
 *
 * Two native targets, as in the real project: the app and OneSignal's
 * notification-service extension. The plugin adds its dSYM phase to the first
 * target; a phase hanging off the extension only is the shape the checker has
 * to reject.
 */

/** The bundle phase as the plugin rewrites it: the project's `.xcode.env*` sourcing, then sentry-xcode.sh wrapping react-native-xcode.sh. */
export const BUNDLE_SCRIPT =
  'if [[ -f \\"$PODS_ROOT/../.xcode.env\\" ]]; then\\n  source \\"$PODS_ROOT/../.xcode.env\\"\\nfi\\n' +
  'if [[ -f \\"$PODS_ROOT/../.xcode.env.local\\" ]]; then\\n  source \\"$PODS_ROOT/../.xcode.env.local\\"\\nfi\\n\\n' +
  '/bin/sh \\"`\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'@sentry/react-native/package.json\')) + \'/scripts/sentry-xcode.sh\'\\"`\\" \\"`\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\"`\\"\\n\\n'

/** The dSYM phase as `getDebugFilesUploadScript()` writes it. */
export const SYMBOLS_SCRIPT =
  '/bin/sh \\"`${NODE_BINARY:-node} --print \\"require(\'path\').dirname(require.resolve(\'@sentry/react-native/package.json\')) + \'/scripts/sentry-xcode-debug-files.sh\'\\"`\\"'

/** What the plugin prepends to both phases for `disableAutoUpload: true`. */
export const BAKED_DISABLE = 'export SENTRY_DISABLE_AUTO_UPLOAD=true\\n'

const APP_TARGET = '13B07F861A680F5B00A75B9A'
const EXTENSION_TARGET = '7A9C1B2D3E4F5A6B7C8D9E0F'
const BUNDLE_ID = '00DD1BFF1BD5951E006B06BC'
const SYMBOLS_ID = '83BA35611DB044ABA3C5EDCD'
const SOURCES_ID = '13B07F871A680F5B00A75B9A'
const EXT_SOURCES_ID = '1F2E3D4C5B6A798877665544'

type Membership = 'app' | 'extension' | 'none'

export function pbxproj({
  bundleScript = BUNDLE_SCRIPT,
  symbolsScript = SYMBOLS_SCRIPT as string | null,
  bundleIn = 'app' as Membership,
  symbolsIn = 'app' as Membership,
  appProductType = 'com.apple.product-type.application',
} = {}): string {
  const phaseLine = (id: string, name: string) => `\t\t\t\t${id} /* ${name} */,`
  const target = (id: string, name: string, productType: string, phases: string[]) => [
    `\t\t${id} /* ${name} */ = {`,
    '\t\t\tisa = PBXNativeTarget;',
    '\t\t\tbuildConfigurationList = 13B07F931A680F5B00A75B9A;',
    '\t\t\tbuildPhases = (',
    ...phases,
    '\t\t\t);',
    `\t\t\tname = ${name};`,
    `\t\t\tproductType = "${productType}";`,
    '\t\t};',
  ]
  const shellPhase = (id: string, name: string, script: string) => [
    `\t\t${id} /* ${name} */ = {`,
    '\t\t\tisa = PBXShellScriptBuildPhase;',
    `\t\t\tname = "${name}";`,
    '\t\t\tshellPath = /bin/sh;',
    `\t\t\tshellScript = "${script}";`,
    '\t\t};',
  ]
  const member = (where: Membership, here: Membership, id: string, name: string) =>
    where === here ? [phaseLine(id, name)] : []
  const symbolsPresent = symbolsScript !== null
  return [
    '// !$*UTF8*$!',
    '{',
    '\tobjects = {',
    '/* Begin PBXNativeTarget section */',
    ...target(APP_TARGET, 'GoGoDev', appProductType, [
      phaseLine(SOURCES_ID, 'Sources'),
      ...member(bundleIn, 'app', BUNDLE_ID, 'Bundle React Native code and images'),
      ...(symbolsPresent ? member(symbolsIn, 'app', SYMBOLS_ID, 'Upload Debug Symbols to Sentry') : []),
    ]),
    ...target(EXTENSION_TARGET, 'OneSignalNotificationServiceExtension', 'com.apple.product-type.app-extension', [
      phaseLine(EXT_SOURCES_ID, 'Sources'),
      ...member(bundleIn, 'extension', BUNDLE_ID, 'Bundle React Native code and images'),
      ...(symbolsPresent ? member(symbolsIn, 'extension', SYMBOLS_ID, 'Upload Debug Symbols to Sentry') : []),
    ]),
    '/* End PBXNativeTarget section */',
    '/* Begin PBXShellScriptBuildPhase section */',
    ...shellPhase(BUNDLE_ID, 'Bundle React Native code and images', bundleScript),
    ...(symbolsPresent ? shellPhase(SYMBOLS_ID, 'Upload Debug Symbols to Sentry', symbolsScript as string) : []),
    '/* End PBXShellScriptBuildPhase section */',
    `\t\t${SOURCES_ID} /* Sources */ = {`,
    '\t\t\tisa = PBXSourcesBuildPhase;',
    '\t\t\tfiles = (',
    '\t\t\t);',
    '\t\t};',
    '\t};',
    '}',
    '',
  ].join('\n')
}

export const APPLY_SENTRY_GRADLE =
  'apply from: new File(["node", "--print", "require(\'path\').dirname(require.resolve(\'@sentry/react-native/package.json\'))"].execute(null, rootDir).text.trim(), "sentry.gradle.kts")'

/** What the plugin appends after the apply line for `disableAutoUpload: true`. */
export const BAKED_GRADLE_DISABLE = 'project.ext.shouldSentryAutoUploadGeneral = { -> return false }'

export const SENTRY_PROPERTIES =
  'defaults.url=https://sentry.io/\ndefaults.org=gogo-vn\ndefaults.project=gogo-mobile\n# Using SENTRY_AUTH_TOKEN environment variable'

/** The `ios/.xcode.env` prebuild writes: NODE_BINARY only. */
export const XCODE_ENV =
  '# This `.xcode.env` file is versioned and is used to source the environment\n# used when running script phases inside Xcode.\nexport NODE_BINARY=$(command -v node)\n'

export function writeNativeProject(
  root: string,
  files: Partial<{
    pbxproj: string
    appGradle: string
    iosProperties: string | null
    androidProperties: string | null
    xcodeEnv: string
    xcodeEnvLocal: string
    xcodeEnvUpdates: string
  }> = {},
) {
  mkdirSync(path.join(root, 'ios/GoGoDev.xcodeproj'), { recursive: true })
  writeFileSync(path.join(root, 'ios/GoGoDev.xcodeproj/project.pbxproj'), files.pbxproj ?? pbxproj())
  writeFileSync(path.join(root, 'ios/.xcode.env'), files.xcodeEnv ?? XCODE_ENV)
  if (files.xcodeEnvLocal !== undefined) writeFileSync(path.join(root, 'ios/.xcode.env.local'), files.xcodeEnvLocal)
  if (files.xcodeEnvUpdates !== undefined) writeFileSync(path.join(root, 'ios/.xcode.env.updates'), files.xcodeEnvUpdates)
  mkdirSync(path.join(root, 'android/app'), { recursive: true })
  writeFileSync(
    path.join(root, 'android/app/build.gradle'),
    files.appGradle ?? `def jscFlavor = 'x'\n\n${APPLY_SENTRY_GRADLE}\n\nandroid {\n}\n`,
  )
  const ios = files.iosProperties === undefined ? SENTRY_PROPERTIES : files.iosProperties
  const android = files.androidProperties === undefined ? SENTRY_PROPERTIES : files.androidProperties
  if (ios !== null) writeFileSync(path.join(root, 'ios/sentry.properties'), ios)
  if (android !== null) writeFileSync(path.join(root, 'android/sentry.properties'), android)
}
